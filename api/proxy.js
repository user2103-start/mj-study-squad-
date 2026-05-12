// api/proxy.js
// Nexttoppers API — Complete login system + all endpoints

const NT = "https://course.nexttoppers.com";
const AUTH = "https://auth.nexttoppers.com";
const APP_ID = "1772100600";
const DEVICE_ID = "ae2fa506-85ca-418d-a449-ec5068dc6665";

// Fallback token (used if user not logged in)
const FALLBACK_TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozMjQ1MDMzLCJhcHBfaWQiOiIxNzcyMTAwNjAwIiwiZGV2aWNlX2lkIjoiYWUyZmE1MDYtODVjYS00MThkLWE0NDktZWM1MDY4ZGM2NjY1IiwicGxhdGZvcm0iOiIzIiwidXNlcl90eXBlIjoxLCJpYXQiOjE3Nzg0OTQ5NjcsImV4cCI6MTc4MTA4Njk2N30.40g-NIb1n2f8oA7PPIqTgD3Y1zDrsQCpCxBajwpMaJY";
const FALLBACK_USER_ID = "3245033";

// In-memory token store (per serverless instance)
// For production, use Vercel KV or Redis
let tokenStore = {};

function getHeaders(token, userId) {
  return {
    "accept": "application/json, text/plain, */*",
    "app_id": APP_ID,
    "authorization": token || FALLBACK_TOKEN,
    "content-type": "application/json",
    "origin": "https://missionjeet.in",
    "platform": "3",
    "referer": "https://missionjeet.in/",
    "user_id": userId || FALLBACK_USER_ID,
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "version": "1"
  };
}

async function ntPost(endpoint, body, token, userId) {
  const r = await fetch(`${NT}${endpoint}`, {
    method: "POST",
    headers: getHeaders(token, userId),
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Upstream ${r.status}: ${r.statusText}`);
  return r.json();
}

async function ntGet(endpoint, token, userId) {
  const r = await fetch(`${NT}${endpoint}`, {
    method: "GET",
    headers: getHeaders(token, userId)
  });
  if (!r.ok) throw new Error(`Upstream ${r.status}: ${r.statusText}`);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-User-Token, X-User-Id");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action } = req.query;
  const body = req.body || {};

  // Get user token from request header (if logged in)
  const userToken = req.headers["x-user-token"] || null;
  const userId = req.headers["x-user-id"] || null;
  const token = userToken ? `Bearer ${userToken}` : FALLBACK_TOKEN;
  const uid = userId || FALLBACK_USER_ID;

  try {

    // ══════════════════════════════════════════
    // LOGIN SYSTEM
    // ══════════════════════════════════════════

    // action=send-otp — Mobile pe OTP bhejo
    if (action === "send-otp") {
      const { mobile } = body;
      if (!mobile) return res.status(400).json({ error: "mobile required" });

      // Try multiple OTP endpoint patterns
      const endpoints = [
        `${AUTH}/auth/send-otp`,
        `${AUTH}/auth/login`,
        `${AUTH}/auth/check-user`,
      ];

      let lastError = null;
      for (const ep of endpoints) {
        try {
          const r = await fetch(ep, {
            method: "POST",
            headers: {
              "accept": "application/json",
              "app_id": APP_ID,
              "content-type": "application/json",
              "origin": "https://missionjeet.in",
              "platform": "3",
              "version": "1"
            },
            body: JSON.stringify({
              mobile,
              device_id: DEVICE_ID,
              mobile_otp_login: 1,
              otp: ""
            })
          });
          const data = await r.json();
          if (data.success || data.responseCode) {
            return res.status(200).json({ ...data, _endpoint: ep });
          }
          lastError = data;
        } catch(e) { lastError = { error: e.message }; }
      }
      return res.status(200).json({ success: false, error: "OTP send failed", details: lastError });
    }

    // action=verify-otp — OTP verify karke token lo
    if (action === "verify-otp") {
      const { mobile, otp } = body;
      if (!mobile || !otp) return res.status(400).json({ error: "mobile and otp required" });

      const r = await fetch(`${AUTH}/auth/verify-otp`, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "app_id": APP_ID,
          "content-type": "application/json",
          "origin": "https://missionjeet.in",
          "platform": "3",
          "version": "1"
        },
        body: JSON.stringify({
          mobile,
          otp,
          signup_needed: "0",
          device_id: DEVICE_ID
        })
      });

      const data = await r.json();

      // Extract token from response
      const newToken = data.data?.token || data.token || data.data?.access_token || null;
      const newUserId = data.data?.user_id || data.user_id || null;

      return res.status(200).json({
        success: data.success || !!newToken,
        token: newToken,
        user_id: newUserId,
        message: data.message || "",
        raw: data
      });
    }

    // ══════════════════════════════════════════
    // COURSE APIs
    // ══════════════════════════════════════════

    // action=course — Course overview
    if (action === "course") {
      const data = await ntPost("/course/course-details", {
        course_id: String(body.course_id),
        parent_id: String(body.parent_id || "0")
      }, token, uid);
      return res.status(200).json(data);
    }

    // action=content — Folders + Videos
    if (action === "content") {
      const data = await ntPost("/course/all-content", {
        course_id: String(body.course_id),
        folder_id: String(body.folder_id || "0"),
        is_free: "",
        keyword: "",
        limit: "1000",
        page: "1",
        parent_course_id: String(body.parent_course_id || "0")
      }, token, uid);
      return res.status(200).json(data);
    }

    // action=video — Video details + stream URL
    if (action === "video") {
      const { content_id, course_id } = req.query;
      if (!content_id || !course_id) {
        return res.status(400).json({ error: "content_id and course_id required" });
      }
      const data = await ntGet(
        `/course/content-details?content_id=${content_id}&course_id=${course_id}`,
        token, uid
      );
      return res.status(200).json(data);
    }

    // action=live — Live classes
    if (action === "live") {
      const data = await ntPost("/course/all-content", {
        course_id: String(body.course_id),
        folder_id: "0",
        is_free: "",
        keyword: "",
        limit: "100",
        page: "1",
        parent_course_id: "0"
      }, token, uid);
      const items = data.data || [];
      const lives = items.filter(i =>
        i.data?.is_live === 1 ||
        i.type === "live" ||
        i.data?.content_type === 4
      );
      return res.status(200).json({ ...data, data: lives });
    }

    // ══════════════════════════════════════════
    // TEST APIs
    // ══════════════════════════════════════════

    // action=test-list — Course ke tests
    if (action === "test-list") {
      const data = await ntPost("/course/all-content", {
        course_id: String(body.course_id),
        folder_id: String(body.folder_id || "0"),
        is_free: "",
        keyword: "",
        limit: "1000",
        page: "1",
        parent_course_id: "0"
      }, token, uid);
      const items = data.data || [];
      // Filter test type items
      const tests = items.filter(i =>
        i.type === "test" ||
        i.data?.file_type === 3 ||
        i.data?.content_type === 3
      );
      return res.status(200).json({ ...data, data: tests });
    }

    // action=test-info — Test instructions
    if (action === "test-info") {
      const { test_id } = req.query;
      if (!test_id) return res.status(400).json({ error: "test_id required" });

      const testHeaders = {
        "accept": "application/json, text/plain, */*",
        "app_id": APP_ID,
        "authorization": token,
        "user_id": uid,
        "platform": "3",
        "version": "1",
        "origin": "https://missionjeet.in",
        "user-agent": "Mozilla/5.0"
      };

      const r = await fetch(
        `https://test.nexttoppers.com/test/get-test-instructions?test_id=${test_id}`,
        { method: "GET", headers: testHeaders }
      );
      const data = await r.json();
      return res.status(200).json(data);
    }

    // action=test-data — Test questions
    if (action === "test-data") {
      const { test_id } = req.query;
      if (!test_id) return res.status(400).json({ error: "test_id required" });

      const testHeaders = {
        "accept": "application/json, text/plain, */*",
        "app_id": APP_ID,
        "authorization": token,
        "user_id": uid,
        "platform": "3",
        "version": "1",
        "origin": "https://missionjeet.in",
        "user-agent": "Mozilla/5.0"
      };

      const r = await fetch(
        `https://test.nexttoppers.com/test/get-test-data?test_id=${test_id}`,
        { method: "GET", headers: testHeaders }
      );
      const data = await r.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({
      success: false,
      error: "Invalid action",
      available: ["send-otp","verify-otp","course","content","video","live","test-list","test-info","test-data"]
    });

  } catch (err) {
    console.error("[PROXY ERROR]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
