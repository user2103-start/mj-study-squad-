// api/proxy.js — Credentials hidden server side

const NT_BASE = "https://course.nexttoppers.com";
const APP_ID = "1772100600";
const USER_ID = "3245033";
const TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozMjQ1MDMzLCJhcHBfaWQiOiIxNzcyMTAwNjAwIiwiZGV2aWNlX2lkIjoiNzZjYjlmMGYtNzQ0Ni00ZTJlLThmMjUtOGJmOTJjMTlhMzIzIiwicGxhdGZvcm0iOiIzIiwidXNlcl90eXBlIjoxLCJpYXQiOjE3NzgyMDg4NzQsImV4cCI6MTc4MDgwMDg3NH0.PYW_poPgm1rEUhf6U7x6TJ_2t4eDQgRTxpCms3X0iL8";

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { action } = req.query;
    const body = req.body || {};

    // ── all-content (folders + videos) ──
    if (action === "content") {
      const r = await fetch(`${NT_BASE}/course/all-content`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({
          course_id: body.course_id || "151",
          folder_id: body.folder_id || "0",
          is_free: "",
          keyword: "",
          limit: "1000",
          page: "1",
          parent_course_id: "0"
        })
      });
      return res.status(200).json(await r.json());
    }

    // ── course details (overview) ──
    if (action === "course") {
      const r = await fetch(`${NT_BASE}/course/course-details`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({
          course_id: body.course_id || "151",
          parent_id: "0"
        })
      });
      return res.status(200).json(await r.json());
    }

    // ── video/content details ──
    if (action === "video") {
      const { content_id, course_id } = req.query;
      const r = await fetch(
        `${NT_BASE}/course/content-details?content_id=${content_id}&course_id=${course_id}`,
        { method: "GET", headers: HEADERS }
      );
      return res.status(200).json(await r.json());
    }

    return res.status(400).json({ error: "Invalid action" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
