// api/proxy.js — Study Squad
// Base: https://api.thescholarverse.site/missionjeet

const BASE = "https://api.thescholarverse.site/missionjeet";
const DEVICE_ID = "ae2fa506-85ca-418d-a449-ec5868dc6665";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-User-Token");
  if (req.method === "OPTIONS") return res.status(200).end();

  let body = req.body || {};
  if (typeof body === "string") { try { body = JSON.parse(body); } catch(e) { body = {}; } }

  const { action } = req.query;
  const token = req.headers["x-user-token"] || null;

  function authHeaders() {
    const h = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }

  try {

    // ══════════════════════════════
    // AUTH
    // ══════════════════════════════

    // Check user + send OTP
    if (action === "sendotp") {
      const { mobile } = body;
      if (!mobile) return res.status(400).json({ success: false, error: "mobile required" });
      const r = await fetch(
        `${BASE}/auth/check-user?mobile=${mobile}&device_id=${DEVICE_ID}`
      );
      const data = await r.json();
      return res.status(200).json(data);
    }

    // Verify OTP → get token
    if (action === "verifyotp") {
      const { mobile, otp, name } = body;
      if (!mobile || !otp) return res.status(400).json({ success: false, error: "mobile and otp required" });
      const r = await fetch(
        `${BASE}/auth/verify-otp?mobile=${mobile}&otp=${otp}&device_id=${DEVICE_ID}&name=${name || ""}`
      );
      const data = await r.json();
      return res.status(200).json({
        success: data.success,
        token: data.data?.token || data.token || null,
        user: data.data?.user || data.user || null,
        message: data.message || ""
      });
    }

    // ══════════════════════════════
    // COURSES
    // ══════════════════════════════

    // All courses (landing page cards)
    if (action === "allcourses") {
      const r = await fetch(`${BASE}/course/all-course`, { headers: authHeaders() });
      return res.status(200).json(await r.json());
    }

    // Course details by id
    if (action === "course") {
      const { course_id } = req.query;
      if (!course_id) return res.status(400).json({ error: "course_id required" });
      const r = await fetch(`${BASE}/course/course-details/${course_id}`, { headers: authHeaders() });
      return res.status(200).json(await r.json());
    }

    // Course content (folders + videos)
    if (action === "content") {
      const { course_id, folder_id } = req.query;
      if (!course_id) return res.status(400).json({ error: "course_id required" });
      const url = folder_id
        ? `${BASE}/course/all-content/${course_id}?folder_id=${folder_id}`
        : `${BASE}/course/all-content/${course_id}`;
      const r = await fetch(url, { headers: authHeaders() });
      return res.status(200).json(await r.json());
    }

    // ══════════════════════════════
    // LIVE / UPCOMING / COMPLETED
    // ══════════════════════════════

    // Live classes
    if (action === "live") {
      const { course_id } = req.query;
      const id = course_id || "151";
      const r = await fetch(`${BASE}/course/classes?type=live&id=${id}`, { headers: authHeaders() });
      return res.status(200).json(await r.json());
    }

    // Upcoming classes
    if (action === "upcoming") {
      const { course_id } = req.query;
      const id = course_id || "151";
      const r = await fetch(`${BASE}/course/classes?type=upcoming&id=${id}`, { headers: authHeaders() });
      return res.status(200).json(await r.json());
    }

    // Completed classes
    if (action === "completed") {
      const { course_id } = req.query;
      const id = course_id || "151";
      const r = await fetch(`${BASE}/course/classes?type=completed&id=${id}`, { headers: authHeaders() });
      return res.status(200).json(await r.json());
    }

    return res.status(400).json({
      success: false,
      error: "Invalid action",
      available: ["sendotp","verifyotp","allcourses","course","content","live","upcoming","completed"]
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
