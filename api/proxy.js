// ============================================================
// MISSION JEET PROXY - Complete Implementation
// Features: Auto-refresh, PDF/Video handling, Grouping, Player
// ============================================================

const AUTH = "https://auth.nexttoppers.com";
const NT   = "https://course.nexttoppers.com";
const TEST = "https://test.nexttoppers.com";

const APP_ID      = "1772100600";
const USER_COURSE = "3186295";
const USER_TEST   = "4071072";
const DEVICE_ID   = "ae2fa506-85ca-418d-a449-ec5868dc6665";

// Fresh token (valid for ~30 days)
const FALLBACK = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozMjMwNTYxLCJhcHBfaWQiOiIxNzcyMTAwNjAwIiwiZGV2aWNlX2lkIjoiYWUyZmE1MDYtODVjYS00MThkLWE0NDktZWM1ODY4ZGM2NjY1IiwicGxhdGZvcm0iOiIzIiwidXNlcl90eXBlIjoxLCJpYXQiOjE3NzkzNzM5MTMsImV4cCI6MTc4MTk2NTkxM30.a9aCx3uzCS0W69KsiD_m4vwX11znneFvIn7JKSSPjQU";

// Token cache (in-memory)
const tokenCache = new Map();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
    const payload = JSON.parse(Buffer.from(cleanToken.split('.')[1], 'base64').toString());
    return Date.now() >= (payload.exp * 1000 - 5 * 60 * 1000);
  } catch(e) {
    return true;
  }
}

function getTokenExpiry(token) {
  try {
    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
    const payload = JSON.parse(Buffer.from(cleanToken.split('.')[1], 'base64').toString());
    return payload.exp * 1000;
  } catch(e) {
    return Date.now() + 30 * 24 * 60 * 60 * 1000;
  }
}

async function getValidToken(userToken, refreshToken, sessionId) {
  if (userToken && !isTokenExpired(userToken)) {
    return `Bearer ${userToken}`;
  }
  
  if (sessionId && tokenCache.has(sessionId)) {
    const cached = tokenCache.get(sessionId);
    if (!isTokenExpired(cached.accessToken)) {
      return cached.accessToken;
    }
  }
  
  if (refreshToken) {
    try {
      const refreshRes = await fetch(`${AUTH}/auth/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });
      const refreshData = await refreshRes.json();
      const newToken = refreshData.accessToken || refreshData.data?.accessToken;
      if (newToken) {
        const bearerToken = `Bearer ${newToken}`;
        if (sessionId) {
          tokenCache.set(sessionId, { accessToken: bearerToken, refreshToken });
        }
        return bearerToken;
      }
    } catch(e) {}
  }
  
  return userToken ? `Bearer ${userToken}` : FALLBACK;
}

function cH(tok) {
  const uid = getUserId(tok);
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

function aH() {
  return {
    "Content-Type": "application/json",
    "app_id": APP_ID,
    "platform": "3",
    "version": "1",
    "origin": "https://missionjeet.in"
  };
}

function getUserId(tok) {
  try {
    if (!tok) return USER_COURSE;
    const clean = tok.startsWith("Bearer ") ? tok.slice(7) : tok;
    const payload = JSON.parse(Buffer.from(clean.split('.')[1], 'base64').toString());
    return String(payload.user_id || USER_COURSE);
  } catch(e) {
    return USER_COURSE;
  }
}

// ============================================================
// PLAYER HTML PAGES
// ============================================================

function getHLSPlayer(url) {
  const decodedUrl = decodeURIComponent(url);
  return `<!DOCTYPE html>
<html>
<head><title>Video Player</title>
<link href="https://vjs.zencdn.net/8.10.0/video-js.css" rel="stylesheet">
<script src="https://vjs.zencdn.net/8.10.0/video.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
<style>body{margin:0;background:#000;}.video-js{width:100%;height:100vh;}</style>
</head>
<body>
<video id="player" class="video-js vjs-default-skin vjs-big-play-centered" controls></video>
<script>
const videoUrl = "${decodedUrl}";
const player = videojs('player');
if (Hls.isSupported()) {
  const hls = new Hls();
  hls.loadSource(videoUrl);
  hls.attachMedia(player.tech_.el_);
  hls.on(Hls.Events.MANIFEST_PARSED, () => player.play());
} else if (player.tech_.el_.canPlayType('application/vnd.apple.mpegurl')) {
  player.tech_.el_.src = videoUrl;
  player.tech_.el_.addEventListener('loadedmetadata', () => player.play());
}
</script>
</body>
</html>`;
}

function getPDFViewer(url) {
  const decodedUrl = decodeURIComponent(url);
  return `<!DOCTYPE html>
<html>
<head><title>PDF Viewer</title>
<style>body{margin:0;height:100vh;}</style>
</head>
<body>
<iframe src="${decodedUrl}" width="100%" height="100%" style="border:none;"></iframe>
</body>
</html>`;
}

// ============================================================
// MAIN HANDLER
// ============================================================

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,X-User-Token,X-Refresh-Token,X-Session-Id");
  if (req.method === "OPTIONS") return res.status(200).end();

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }
  body = Object.assign({}, req.query, body);

  const { action } = req.query;
  const userToken = req.headers["x-user-token"] || null;
  const refreshTokenHeader = req.headers["x-refresh-token"] || null;
  const sessionId = req.headers["x-session-id"] || null;

  try {
    // ============================================================
    // 1. SEND OTP
    // ============================================================
    if (action === "sendotp") {
      const { mobile } = body;
      if (!mobile) return res.status(400).json({ success: false, error: "mobile required" });
      const r = await fetch(`${AUTH}/auth/check-user`, {
        method: "POST",
        headers: aH(),
        body: JSON.stringify({ mobile: String(mobile), device_id: DEVICE_ID, mobile_otp_login: 1, otp: "" })
      });
      return res.status(200).json(await r.json());
    }

    // ============================================================
    // 2. VERIFY OTP (returns tokens)
    // ============================================================
    if (action === "verifyotp") {
      const { mobile, otp, name } = body;
      if (!mobile || !otp) return res.status(400).json({ success: false, error: "mobile and otp required" });
      
      const r = await fetch(`${AUTH}/auth/verify-otp`, {
        method: "POST",
        headers: aH(),
        body: JSON.stringify({
          mobile: String(mobile), otp: String(otp), signup_needed: "0",
          device_id: DEVICE_ID, ...(name ? { name } : {})
        })
      });
      const data = await r.json();
      const accessToken = data.data?.accessToken || data.accessToken;
      const refreshToken = data.data?.refreshToken || data.refreshToken;
      
      if (accessToken && refreshToken) {
        const newSessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        tokenCache.set(newSessionId, { accessToken: `Bearer ${accessToken}`, refreshToken });
        return res.json({ success: true, accessToken, refreshToken, sessionId: newSessionId, expiresIn: getTokenExpiry(accessToken) });
      }
      return res.json(data);
    }

    // ============================================================
    // 3. REFRESH TOKEN
    // ============================================================
    if (action === "refresh") {
      const refreshToken = body.refreshToken || refreshTokenHeader;
      if (!refreshToken) return res.status(400).json({ success: false, error: "Refresh token required" });
      
      try {
        const refreshRes = await fetch(`${AUTH}/auth/refresh-token`, {
          method: "POST", headers: aH(), body: JSON.stringify({ refreshToken })
        });
        const refreshData = await refreshRes.json();
        const newToken = refreshData.accessToken || refreshData.data?.accessToken;
        
        if (newToken) {
          if (sessionId && tokenCache.has(sessionId)) {
            const cached = tokenCache.get(sessionId);
            tokenCache.set(sessionId, { accessToken: `Bearer ${newToken}`, refreshToken: cached.refreshToken });
          }
          return res.json({ success: true, accessToken: newToken, expiresIn: getTokenExpiry(newToken) });
        }
        return res.status(401).json({ success: false, error: "Refresh token expired" });
      } catch(err) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    // ============================================================
    // 4. PLAYER (HLS)
    // ============================================================
    if (action === "player") {
      const { url } = req.query;
      if (!url) return res.status(400).json({ error: "url required" });
      res.setHeader('Content-Type', 'text/html');
      return res.send(getHLSPlayer(url));
    }

    // ============================================================
    // 5. PDF VIEWER
    // ============================================================
    if (action === "pdf") {
      const { url } = req.query;
      if (!url) return res.status(400).json({ error: "url required" });
      res.setHeader('Content-Type', 'text/html');
      return res.send(getPDFViewer(url));
    }

    // ============================================================
    // 6. COURSE DETAILS
    // ============================================================
    if (action === "course") {
      const { course_id, parent_id } = req.query;
      if (!course_id) return res.status(400).json({ error: "course_id required" });
      const validToken = await getValidToken(userToken, refreshTokenHeader, sessionId);
      const r = await fetch(`${NT}/course/course-details`, {
        method: "POST", headers: cH(validToken),
        body: JSON.stringify({ course_id: String(course_id), parent_id: String(parent_id || "0") })
      });
      return res.status(200).json(await r.json());
    }

    // ============================================================
    // 7. FOLDER CONTENT (with grouping)
    // ============================================================
    if (action === "content") {
      const { course_id, folder_id, parent_course_id } = req.query;
      if (!course_id) return res.status(400).json({ error: "course_id required" });
      const validToken = await getValidToken(userToken, refreshTokenHeader, sessionId);
      const r = await fetch(`${NT}/course/all-content`, {
        method: "POST", headers: cH(validToken),
        body: JSON.stringify({
          course_id: String(course_id), folder_id: String(folder_id || "0"),
          is_free: "", keyword: "", limit: "1000", page: "1", parent_course_id: String(parent_course_id || "0")
        })
      });
      const data = await r.json();
      
      if (data.success && data.data) {
        const grouped = new Map();
        for (const item of data.data) {
          const title = item.title;
          if (!grouped.has(title)) grouped.set(title, { title, video: null, pdf: null });
          const g = grouped.get(title);
          if (item.data?.file_type === 2) g.video = item;
          if (item.data?.file_type === 1) g.pdf = item;
        }
        data.grouped = Array.from(grouped.values());
      }
      return res.json(data);
    }

    // ============================================================
    // 8. VIDEO/CONTENT DETAILS
    // ============================================================
    if (action === "video") {
      const { content_id, course_id } = req.query;
      if (!content_id || !course_id) return res.status(400).json({ error: "content_id and course_id required" });
      const validToken = await getValidToken(userToken, refreshTokenHeader, sessionId);
      const r = await fetch(`${NT}/course/content-details?content_id=${content_id}&course_id=${course_id}`, {
        method: "GET", headers: cH(validToken)
      });
      const data = await r.json();
      
      if (data.success && data.data) {
        const c = data.data;
        if (c.file_url) {
          if (c.file_url.includes('.m3u8')) {
            c.playerUrl = `/api/proxy?action=player&url=${encodeURIComponent(c.file_url)}`;
            c.playerType = "hls";
          } else if (c.file_type === 1 && c.file_url.includes('.pdf')) {
            c.playerUrl = `/api/proxy?action=pdf&url=${encodeURIComponent(c.file_url)}`;
            c.playerType = "pdf";
          }
        } else if (c.vdc_id) {
          c.playerUrl = `https://play.vdocipher.com/v2/${c.vdc_id}`;
          c.playerType = "vdocipher";
        }
      }
      return res.json(data);
    }

    // ============================================================
    // 9. LIVE CLASSES
    // ============================================================
    if (action === "live") {
      const { course_id } = req.query;
      const validToken = await getValidToken(userToken, refreshTokenHeader, sessionId);
      const r = await fetch(`${NT}/course/all-content`, {
        method: "POST", headers: cH(validToken),
        body: JSON.stringify({
          course_id: String(course_id || "152"), folder_id: "0",
          is_free: "", keyword: "", limit: "100", page: "1", parent_course_id: "0"
        })
      });
      const data = await r.json();
      const lives = (data.data || []).filter(i => i.data?.is_live === 1 || (i.data?.file_type === 2 && i.data?.video_type === 3));
      return res.json({ ...data, data: lives });
    }

    // ============================================================
    // 10. UPCOMING CLASSES
    // ============================================================
    if (action === "upcoming") {
      const { course_id } = req.query;
      const validToken = await getValidToken(userToken, refreshTokenHeader, sessionId);
      const r = await fetch(`${NT}/course/all-content`, {
        method: "POST", headers: cH(validToken),
        body: JSON.stringify({
          course_id: String(course_id || "152"), folder_id: "0",
          is_free: "", keyword: "", limit: "100", page: "1", parent_course_id: "0"
        })
      });
      const data = await r.json();
      const now = Math.floor(Date.now() / 1000);
      const upcoming = (data.data || []).filter(i => i.data?.is_upcoming === 1 || (i.data?.start_time && Number(i.data.start_time) > now));
      return res.json({ ...data, data: upcoming });
    }

    // ============================================================
    // 11. TEST APIs
    // ============================================================
    if (action === "testinfo") {
      const { test_id } = req.query;
      if (!test_id) return res.status(400).json({ error: "test_id required" });
      const r = await fetch(`${TEST}/test/get-test-instructions?test_id=${test_id}`, {
        method: "GET", headers: cH(validToken)
      });
      return res.json(await r.json());
    }

    if (action === "testdata") {
      const { test_id } = req.query;
      if (!test_id) return res.status(400).json({ error: "test_id required" });
      const r = await fetch(`${TEST}/test/get-test-data?test_id=${test_id}`, {
        method: "GET", headers: cH(validToken)
      });
      return res.json(await r.json());
    }

    // ============================================================
    // DEFAULT
    // ============================================================
    return res.status(400).json({
      success: false,
      error: "Invalid action",
      available: ["sendotp", "verifyotp", "refresh", "player", "pdf", "course", "content", "video", "live", "upcoming", "testinfo", "testdata"]
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};
