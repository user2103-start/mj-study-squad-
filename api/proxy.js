// ============================================================
// api/index.js - VERCEL SERVERLESS FUNCTION
// Clean Proxy - No MQTT API
// ============================================================

const AUTH_API = "https://auth.nexttoppers.com";
const COURSE_API = "https://course.nexttoppers.com";
const TEST_API = "https://test.nexttoppers.com";

const APP_ID = "1772100600";
const JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozMjMwNTYxLCJhcHBfaWQiOiIxNzcyMTAwNjAwIiwiZGV2aWNlX2lkIjoiMmNmZGVhZWEtYWI2Mi00MWY4LTlmN2QtNjU2ODMzNGUxODI2IiwicGxhdGZvcm0iOiIzIiwidXNlcl90eXBlIjoxLCJpYXQiOjE3ODAyNzkxNzUsImV4cCI6MTc4Mjg3MTE3NX0.RvUaNoJoe4bHYGrrbZnyA3moPDr5fCzsIYdrx7RTf68";
const USER_ID = "3230561";

function getHeaders() {
  return {
    "user_id": USER_ID,
    "platform": "3",
    "Version": "1",
    "app_id": APP_ID,
    "Authorization": `Bearer ${JWT_TOKEN}`,
    "Content-Type": "application/json"
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    // ============================================================
    // COURSE APIS
    // ============================================================
    
    if (action === 'all-course') {
      const { page = "1", limit = "10", cat_id = "", view_type = "grid" } = req.query;
      const response = await fetch(`${COURSE_API}/course/all-course`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ view_type, cat_id, page, limit })
      });
      return res.json(await response.json());
    }

    if (action === 'course-details') {
      const { course_id } = req.query;
      const response = await fetch(`${COURSE_API}/course/course-details`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ course_id })
      });
      return res.json(await response.json());
    }

    if (action === 'all-content') {
      const { course_id, folder_id = "0", page = "1", limit = "100" } = req.query;
      const response = await fetch(`${COURSE_API}/course/all-content`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ course_id, folder_id, page, limit, keyword: "", is_free: "" })
      });
      return res.json(await response.json());
    }

    // Returns direct video URL - THE VULNERABILITY
    if (action === 'content-details') {
      const { content_id, course_id } = req.query;
      const response = await fetch(`${COURSE_API}/course/content-details?content_id=${content_id}&course_id=${course_id}`, {
        method: "GET",
        headers: getHeaders()
      });
      return res.json(await response.json());
    }

    if (action === 'classes') {
      const response = await fetch(`${COURSE_API}/course/classes`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ page: "1", limit: "10" })
      });
      return res.json(await response.json());
    }

    if (action === 'mycourses') {
      const { type = "COURSE", page = "1", limit = "20" } = req.query;
      const response = await fetch(`${COURSE_API}/course/mycourses?type=${type}&page=${page}&limit=${limit}`, {
        method: "GET",
        headers: getHeaders()
      });
      return res.json(await response.json());
    }

    // ============================================================
    // TEST APIS
    // ============================================================

    if (action === 'test-instructions') {
      const { test_id } = req.query;
      const response = await fetch(`${TEST_API}/test/get-test-instructions?test_id=${test_id}`, {
        method: "GET",
        headers: getHeaders()
      });
      return res.json(await response.json());
    }

    if (action === 'test-data') {
      const { test_id } = req.query;
      const response = await fetch(`${TEST_API}/test/get-test-data?test_id=${test_id}&attempt_mode=live`, {
        method: "GET",
        headers: getHeaders()
      });
      return res.json(await response.json());
    }

    if (action === 'submit-test') {
      const response = await fetch(`${TEST_API}/test/submit`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(req.body)
      });
      return res.json(await response.json());
    }

    if (action === 'result') {
      const { test_id } = req.query;
      const response = await fetch(`${TEST_API}/test/result?test_id=${test_id}`, {
        method: "GET",
        headers: getHeaders()
      });
      return res.json(await response.json());
    }

    if (action === 'leaderboard') {
      const { test_id } = req.query;
      const response = await fetch(`${TEST_API}/test/leaderboard?test_id=${test_id}`, {
        method: "GET",
        headers: getHeaders()
      });
      return res.json(await response.json());
    }

    // ============================================================
    // AUTH APIS
    // ============================================================

    if (action === 'profile') {
      const response = await fetch(`${AUTH_API}/user/my-profile`, {
        method: "GET",
        headers: getHeaders()
      });
      return res.json(await response.json());
    }

    // ============================================================
    // CURRENT AFFAIRS APIS
    // ============================================================

    if (action === 'current-affairs-categories') {
      const response = await fetch(`${AUTH_API}/current-affairs/categories`, {
        method: "GET",
        headers: getHeaders()
      });
      return res.json(await response.json());
    }

    if (action === 'current-affairs-list') {
      const { category_id, page = "1", limit = "10" } = req.query;
      const response = await fetch(`${AUTH_API}/current-affairs/current-affairs-list?category_id=${category_id}&page=${page}&limit=${limit}`, {
        method: "GET",
        headers: getHeaders()
      });
      return res.json(await response.json());
    }

    // ============================================================
    // BLOG APIS
    // ============================================================

    if (action === 'blog-categories') {
      const response = await fetch(`https://home.nexttoppers.com/home/blog-category`, {
        method: "GET",
        headers: getHeaders()
      });
      return res.json(await response.json());
    }

    if (action === 'blog-list') {
      const { page = "1", limit = "10" } = req.query;
      const response = await fetch(`https://home.nexttoppers.com/home/blog-lists`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ page, limit })
      });
      return res.json(await response.json());
    }

    // ============================================================
    // SEARCH API
    // ============================================================

    if (action === 'search') {
      const { keyword, page = "1", limit = "10" } = req.query;
      const response = await fetch(`https://home.nexttoppers.com/home/search?keyword=${encodeURIComponent(keyword)}&page=${page}&limit=${limit}`, {
        method: "GET",
        headers: getHeaders()
      });
      return res.json(await response.json());
    }

    // ============================================================
    // GET IN TOUCH
    // ============================================================

    if (action === 'get-in-touch') {
      const response = await fetch(`https://home.nexttoppers.com/home/get-in-touch`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(req.body)
      });
      return res.json(await response.json());
    }

    // ============================================================
    // DEFAULT
    // ============================================================

    return res.status(400).json({
      success: false,
      error: "Invalid action",
      available_actions: [
        "all-course", "course-details", "all-content", "content-details",
        "classes", "mycourses", "test-instructions", "test-data",
        "submit-test", "result", "leaderboard", "profile",
        "current-affairs-categories", "current-affairs-list",
        "blog-categories", "blog-list", "search", "get-in-touch"
      ]
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
