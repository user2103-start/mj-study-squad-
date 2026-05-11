// api/proxy.js
// Nexttoppers API — credentials hidden server side

const NT = "https://course.nexttoppers.com";
const APP_ID = "1772100600";
const USER_ID = "3245033";
const TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozMjQ1MDMzLCJhcHBfaWQiOiIxNzcyMTAwNjAwIiwiZGV2aWNlX2lkIjoiNzZjYjlmMGYtNzQ0Ni00ZTJlLThmMjUtOGJmOTJjMTlhMzIzIiwicGxhdGZvcm0iOiIzIiwidXNlcl90eXBlIjoxLCJpYXQiOjE3NzgyMDg4NzQsImV4cCI6MTc4MDgwMDg3NH0.PYW_poPgm1rEUhf6U7x6TJ_2t4eDQgRTxpCms3X0iL8";

const H = {
  "accept": "application/json, text/plain, */*",
  "app_id": APP_ID,
  "authorization": TOKEN,
  "content-type": "application/json",
  "origin": "https://missionjeet.in",
  "platform": "3",
  "referer": "https://missionjeet.in/",
  "user_id": USER_ID,
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
  "version": "1"
};

async function post(endpoint, body) {
  const r = await fetch(`${NT}${endpoint}`, { method: "POST", headers: H, body: JSON.stringify(body) });
  return r.json();
}

async function get(endpoint) {
  const r = await fetch(`${NT}${endpoint}`, { method: "GET", headers: H });
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { action } = req.query;
  const body = req.body || {};

  try {

    // ── Course overview/details ──
    // Returns: title, description (HTML), thumbnail, pricing, packages, FAQs etc.
    // Used for: Overview tab
    if (action === "course") {
      const data = await post("/course/course-details", {
        course_id: body.course_id,
        parent_id: body.parent_id || "0"
      });
      return res.status(200).json(data);
    }

    // ── All content (folders + videos + live) ──
    // Returns: type="folder" or type="file" items
    // Used for: Content tab, folder navigation
    if (action === "content") {
      const data = await post("/course/all-content", {
        course_id: body.course_id,
        folder_id: body.folder_id || "0",
        is_free: "",
        keyword: "",
        limit: "1000",
        page: "1",
        parent_course_id: body.parent_course_id || "0"
      });
      return res.status(200).json(data);
    }

    // ── Video/content details ──
    // Returns: hls_url, vdc_id, duration, thumbnail etc.
    // Used for: Video player
    if (action === "video") {
      const { content_id, course_id } = req.query;
      const data = await get(`/course/content-details?content_id=${content_id}&course_id=${course_id}`);
      return res.status(200).json(data);
    }

    // ── Live classes ──
    // Returns: live sessions for a course
    // Used for: Live section
    if (action === "live") {
      const data = await post("/course/all-content", {
        course_id: body.course_id,
        folder_id: "0",
        is_free: "",
        keyword: "",
        limit: "100",
        page: "1",
        parent_course_id: "0"
      });
      // Filter only live items
      const items = data.data || [];
      const lives = items.filter(i => i.data?.is_live === 1 || i.type === "live");
      return res.status(200).json({ ...data, data: lives });
    }

    // ── Package course content ──
    // Used for: Package courses (like id=107 bundled with 151)
    if (action === "package") {
      const data = await post("/course/course-details", {
        course_id: body.course_id,
        parent_id: body.parent_id
      });
      return res.status(200).json(data);
    }

    return res.status(400).json({ success: false, error: "Invalid action" });

  } catch (err) {
    console.error("[PROXY ERROR]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
  }
