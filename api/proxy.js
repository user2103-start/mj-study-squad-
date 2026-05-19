// api/proxy.js — Study Squad
// Auth: auth.nexttoppers.com
// Course: course.nexttoppers.com
// Test: test.nexttoppers.com

const AUTH = "https://auth.nexttoppers.com";
const NT   = "https://course.nexttoppers.com";
const TEST = "https://test.nexttoppers.com";

const APP_ID      = "1772100600";
const USER_COURSE = "3186295";
const USER_TEST   = "4071072";
const DEVICE_ID   = "ae2fa506-85ca-418d-a449-ec5868dc6665";

// Fallback token — update every 30 days
// Current expiry: 11 June 2026
const FALLBACK = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozMjQ1MDMzLCJhcHBfaWQiOiIxNzcyMTAwNjAwIiwiZGV2aWNlX2lkIjoiMTQ0N2Y0MjYtZjg4Yy00NTNkLTk0NTgtOWM2Y2ZkM2VhMDY4IiwicGxhdGZvcm0iOiIzIiwidXNlcl90eXBlIjoxLCJpYXQiOjE3Nzg4NTc2ODIsImV4cCI6MTc4MTQ0OTY4Mn0.XrQ2a-xFIP5GFy2mloA0H6lMc5v5ahuSwqdHLn7cHOo";

// In-memory cache (5 min TTL)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function cacheGet(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > CACHE_TTL) { cache.delete(key); return null; }
  return item.data;
}
function cacheSet(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

// Extract user_id from JWT
function getUserId(tok) {
  try {
    if (!tok) return USER_COURSE;
    const jwt = tok.startsWith("Bearer ") ? tok.slice(7) : tok;
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
    return String(payload.user_id || USER_COURSE);
  } catch(e) { return USER_COURSE; }
}

function cH(tok) {
  const uid = getUserId(tok ? tok.replace("Bearer ", "") : null);
  return {
    "accept": "application/json, text/plain, */*",
    "app_id": APP_ID,
    "authorization": tok || FALLBACK,
    "content-type": "application/json",
    "origin": "https://missionjeet.in",
    "referer": "https://missionjeet.in/",
    "platform": "3",
    "version": "1",
    "user_id": uid,
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  };
}

function tH(tok) {
  return {
    "accept": "application/json, text/plain, */*",
    "app_id": APP_ID,
    "authorization": tok || FALLBACK,
    "platform": "3",
    "version": "1",
    "user_id": USER_TEST,
    "origin": "https://missionjeet.in",
    "user-agent": "Mozilla/5.0"
  };
}

function aH() {
  return {
    "Content-Type": "application/json",
    "app_id": APP_ID,
    "platform": "3",
    "version": "1",
    "origin": "https://missionjeet.in"
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-User-Token");
  if (req.method === "OPTIONS") return res.status(200).end();

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }
  body = Object.assign({}, req.query, body);

  const { action } = req.query;
  const userToken = req.headers["x-user-token"] || null;
  const token = userToken ? `Bearer ${userToken}` : FALLBACK;

  try {

    // ══════════════════════════════════════
    // AUTH
    // ══════════════════════════════════════

    // Send OTP
    if (action === "sendotp") {
      const { mobile } = body;
      if (!mobile) return res.status(400).json({ success: false, error: "mobile required" });
      const r = await fetch(`${AUTH}/auth/check-user`, {
        method: "POST",
        headers: aH(),
        body: JSON.stringify({
          mobile: String(mobile),
          device_id: DEVICE_ID,
          mobile_otp_login: 1,
          otp: ""
        })
      });
      return res.status(200).json(await r.json());
    }

    // Verify OTP → JWT token
    if (action === "verifyotp") {
      const { mobile, otp, name } = body;
      if (!mobile || !otp) return res.status(400).json({ success: false, error: "mobile and otp required" });
      const r = await fetch(`${AUTH}/auth/verify-otp`, {
        method: "POST",
        headers: aH(),
        body: JSON.stringify({
          mobile: String(mobile),
          otp: String(otp),
          signup_needed: "0",
          device_id: DEVICE_ID,
          ...(name ? { name } : {})
        })
      });
      const data = await r.json();
      const tok = data.data?.accessToken || data.data?.token || data.accessToken || data.token || null;
      const usr = data.data || data.user || { mobile };
      return res.status(200).json({
        success: !!tok || data.success || false,
        token: tok,
        user: usr,
        message: data.message || ""
      });
    }

    // ══════════════════════════════════════
    // COURSE APIs
    // ══════════════════════════════════════

    // Course details/overview
    if (action === "course") {
      const { course_id, parent_id } = req.query;
      if (!course_id) return res.status(400).json({ error: "course_id required" });
      const ckey = `course_${course_id}`;
      const cached = cacheGet(ckey);
      if (cached) return res.status(200).json(cached);
      const r = await fetch(`${NT}/course/course-details`, {
        method: "POST",
        headers: cH(token),
        body: JSON.stringify({
          course_id: String(course_id),
          parent_id: String(parent_id || "0")
        })
      });
      const data = await r.json();
      cacheSet(ckey, data);
      return res.status(200).json(data);
    }

    // All content — folders + videos + pdfs + live
    if (action === "content") {
      const { course_id, folder_id, parent_course_id } = req.query;
      if (!course_id) return res.status(400).json({ error: "course_id required" });
      const ckey = `content_${course_id}_${folder_id||"0"}_${parent_course_id||"0"}`;
      const cached = cacheGet(ckey);
      if (cached) return res.status(200).json(cached);
      const r = await fetch(`${NT}/course/all-content`, {
        method: "POST",
        headers: cH(token),
        body: JSON.stringify({
          course_id: String(course_id),
          folder_id: String(folder_id || "0"),
          is_free: "",
          keyword: "",
          limit: "1000",
          page: "1",
          parent_course_id: String(parent_course_id || "0")
        })
      });
      const data = await r.json();
      cacheSet(ckey, data);
      return res.status(200).json(data);
    }

    // Content details — video stream URL + PDF URL
    // file_type=2 → video (vdc_id se URL build karo)
    // file_type=1 → PDF (file_url full aati hai)
    // video_type=3, is_live=1 → live class (file_url full aati hai)
    if (action === "video") {
      const { content_id, course_id } = req.query;
      if (!content_id || !course_id) return res.status(400).json({ error: "content_id and course_id required" });
      const r = await fetch(
        `${NT}/course/content-details?content_id=${content_id}&course_id=${course_id}`,
        { method: "GET", headers: cH(token) }
      );
      const text = await r.text();
      try {
        return res.status(200).json(JSON.parse(text));
      } catch(e) {
        return res.status(200).send(text);
      }
    }

    // Live classes
    if (action === "live") {
      const { course_id } = req.query;
      const r = await fetch(`${NT}/course/all-content`, {
        method: "POST",
        headers: cH(token),
        body: JSON.stringify({
          course_id: String(course_id || "151"),
          folder_id: "0",
          is_free: "",
          keyword: "",
          limit: "100",
          page: "1",
          parent_course_id: "0"
        })
      });
      const data = await r.json();
      // Live: file_type=2, video_type=3, is_live=1
      const lives = (data.data || []).filter(i =>
        i.data?.is_live === 1 ||
        (i.data?.file_type === 2 && i.data?.video_type === 3)
      );
      return res.status(200).json({ ...data, data: lives });
    }

    // Upcoming classes
    if (action === "upcoming") {
      const { course_id } = req.query;
      const r = await fetch(`${NT}/course/all-content`, {
        method: "POST",
        headers: cH(token),
        body: JSON.stringify({
          course_id: String(course_id || "151"),
          folder_id: "0",
          is_free: "",
          keyword: "",
          limit: "100",
          page: "1",
          parent_course_id: "0"
        })
      });
      const data = await r.json();
      const now = Math.floor(Date.now() / 1000);
      const upcoming = (data.data || []).filter(i =>
        i.data?.is_upcoming === 1 ||
        (i.data?.start_time && Number(i.data.start_time) > now && i.data?.is_live !== 1)
      );
      return res.status(200).json({ ...data, data: upcoming });
    }

    // ══════════════════════════════════════
    // TEST APIs
    // ══════════════════════════════════════

    if (action === "testinfo") {
      const { test_id } = req.query;
      if (!test_id) return res.status(400).json({ error: "test_id required" });
      const r = await fetch(
        `${TEST}/test/get-test-instructions?test_id=${test_id}`,
        { method: "GET", headers: tH(token) }
      );
      return res.status(200).json(await r.json());
    }

    if (action === "testdata") {
      const { test_id } = req.query;
      if (!test_id) return res.status(400).json({ error: "test_id required" });
      const r = await fetch(
        `${TEST}/test/get-test-data?test_id=${test_id}`,
        { method: "GET", headers: tH(token) }
      );
      return res.status(200).json(await r.json());
    }

    return res.status(400).json({
      success: false,
      error: "Invalid action",
      available: ["sendotp","verifyotp","course","content","video","live","upcoming","testinfo","testdata"]
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
