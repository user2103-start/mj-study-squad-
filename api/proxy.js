// api/proxy.js
// Nexttoppers API — all credentials hidden server side
// Endpoints: course, content, video, live, upcoming

const NT = "https://course.nexttoppers.com";
const APP_ID = "1772100600";
const USER_ID = "3245033";
const TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozMjQ1MDMzLCJhcHBfaWQiOiIxNzcyMTAwNjAwIiwiZGV2aWNlX2lkIjoiYWUyZmE1MDYtODVjYS00MThkLWE0NDktZWM1MDY4ZGM2NjY1IiwicGxhdGZvcm0iOiIzIiwidXNlcl90eXBlIjoxLCJpYXQiOjE3Nzg0OTQ5NjcsImV4cCI6MTc4MTA4Njk2N30.40g-NIb1n2f8oA7PPIqTgD3Y1zDrsQCpCxBajwpMaJY";

const HEADERS = {
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

async function ntPost(endpoint, body) {
  const r = await fetch(`${NT}${endpoint}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Upstream ${r.status}: ${r.statusText}`);
  return r.json();
}

async function ntGet(endpoint) {
  const r = await fetch(`${NT}${endpoint}`, {
    method: "GET",
    headers: HEADERS
  });
  if (!r.ok) throw new Error(`Upstream ${r.status}: ${r.statusText}`);
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

    // ══════════════════════════════════════════
    // action=course
    // Course overview — title, description (HTML),
    // thumbnail, pricing, packages, FAQs etc.
    // Body: { course_id, parent_id? }
    // ══════════════════════════════════════════
    if (action === "course") {
      const data = await ntPost("/course/course-details", {
        course_id: String(body.course_id),
        parent_id: String(body.parent_id || "0")
      });
      return res.status(200).json(data);
    }

    // ══════════════════════════════════════════
    // action=content
    // Folders + Videos + Live inside a course/folder
    // Body: { course_id, folder_id?, parent_course_id? }
    // Notes:
    //   - folder_id="0" → root level
    //   - parent_course_id needed for package courses
    //     e.g. course_id=107, parent_course_id=151
    //   - limit=1000 so new content auto-appears
    // ══════════════════════════════════════════
    if (action === "content") {
      const data = await ntPost("/course/all-content", {
        course_id: String(body.course_id),
        folder_id: String(body.folder_id || "0"),
        is_free: "",
        keyword: "",
        limit: "1000",
        page: "1",
        parent_course_id: String(body.parent_course_id || "0")
      });
      return res.status(200).json(data);
    }

    // ══════════════════════════════════════════
    // action=video
    // Video details — hls_url, vdc_id, duration etc.
    // Query params: content_id, course_id
    // ══════════════════════════════════════════
    if (action === "video") {
      const { content_id, course_id } = req.query;
      if (!content_id || !course_id) {
        return res.status(400).json({ error: "content_id and course_id required" });
      }
      const data = await ntGet(
        `/course/content-details?content_id=${content_id}&course_id=${course_id}`
      );
      return res.status(200).json(data);
    }

    // ══════════════════════════════════════════
    // action=live
    // Live classes for a course (root level only)
    // Body: { course_id, parent_course_id? }
    // Returns only items where is_live=1
    // ══════════════════════════════════════════
    if (action === "live") {
      const data = await ntPost("/course/all-content", {
        course_id: String(body.course_id),
        folder_id: "0",
        is_free: "",
        keyword: "",
        limit: "100",
        page: "1",
        parent_course_id: String(body.parent_course_id || "0")
      });
      const items = data.data || [];
      const lives = items.filter(i =>
        i.data?.is_live === 1 ||
        i.type === "live" ||
        i.data?.content_type === 4  // live type
      );
      return res.status(200).json({ ...data, data: lives });
    }

    // ══════════════════════════════════════════
    // action=upcoming
    // Upcoming classes for a course
    // Body: { course_id, parent_course_id? }
    // Returns only upcoming items
    // ══════════════════════════════════════════
    if (action === "upcoming") {
      const data = await ntPost("/course/all-content", {
        course_id: String(body.course_id),
        folder_id: "0",
        is_free: "",
        keyword: "",
        limit: "100",
        page: "1",
        parent_course_id: String(body.parent_course_id || "0")
      });
      const items = data.data || [];
      const now = Math.floor(Date.now() / 1000);
      const upcoming = items.filter(i =>
        i.data?.is_upcoming === 1 ||
        i.type === "upcoming" ||
        (i.data?.start_time && i.data.start_time > now && i.data?.is_live !== 1)
      );
      return res.status(200).json({ ...data, data: upcoming });
    }

    return res.status(400).json({ success: false, error: "Invalid action. Use: course, content, video, live, upcoming" });

  } catch (err) {
    console.error("[PROXY ERROR]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}
