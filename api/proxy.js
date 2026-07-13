// ============================================================
// api/proxy.js - CLEAN PROXY (Auth handled in Frontend)
// ============================================================

const AUTH = "https://auth.nexttoppers.com";
const NT   = "https://course.nexttoppers.com";
const TEST = "https://test.nexttoppers.com";

const APP_ID = "1772100600";

const requestCounts = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const userLimit = requestCounts.get(ip);
  if (!userLimit || now > userLimit.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + 60000 });
    return true;
  }
  if (userLimit.count >= 150) return false;
  userLimit.count++;
  return true;
}

// ============================================================
// HEADER BUILDER - Uses exactly what frontend sends
// ============================================================
function buildHeaders(accessToken, userId) {
  return {
    "accept": "application/json, text/plain, */*",
    "app_id": APP_ID,
    "content-type": "application/json",
    "origin": "https://missionjeet.in",
    "referer": "https://missionjeet.in/",
    "platform": "3",
    "version": "1",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "authorization": accessToken.startsWith("Bearer ") ? accessToken : `Bearer ${accessToken}`,
    "user_id": String(userId)
  };
}

// ============================================================
// HTML EMBEDDED RENDERERS
// ============================================================
function getPDFViewerHTML(pdfUrl) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Mission JEET - PDF Viewer</title><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#f0f0f0;height:100vh;overflow:hidden;font-family:system-ui,sans-serif;}iframe{width:100%;height:100%;border:none;}.download-btn{position:fixed;bottom:20px;right:20px;background:#1a1a2e;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;z-index:100;box-shadow:0 2px 10px rgba(0,0,0,0.2);font-weight:500;}.download-btn:hover{background:#2d2d44;}.back-btn{position:fixed;bottom:20px;left:20px;background:#1a1a2e;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;z-index:100;box-shadow:0 2px 10px rgba(0,0,0,0.2);}.back-btn:hover{background:#2d2d44;}</style></head><body><iframe src="${pdfUrl}" title="PDF Viewer"></iframe><a href="${pdfUrl}" class="download-btn" download>📥 Download PDF</a><a href="javascript:history.back()" class="back-btn">← Back</a></body></html>`;
}

function getHLSPlayerHTML(videoUrl, title = "Video Player") {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Mission JEET - ${title}</title><script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#000;font-family:system-ui,sans-serif;}.container{width:100%;height:100vh;display:flex;flex-direction:column;}.video-wrapper{flex:1;background:#000;position:relative;}video{width:100%;height:100%;object-fit:contain;}.controls-bar{background:#1a1a2e;padding:10px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-top:1px solid #2d2d44;}select{background:#2d2d44;color:white;border:none;padding:6px 12px;border-radius:6px;cursor:pointer;}.back-btn{background:#667eea;color:white;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;}.title{color:white;flex:1;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}</style></head><body><div class="container"><div class="video-wrapper"><video id="video" controls></video></div><div class="controls-bar"><button class="back-btn" onclick="history.back()">← Back</button><div class="title">${title}</div><select id="speedSelect"><option value="0.5">0.5x</option><option value="0.75">0.75x</option><option value="1" selected>1x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option><option value="2">2x</option></select></div></div><script>const videoUrl=decodeURIComponent("${videoUrl}");const video=document.getElementById('video');if(Hls.isSupported()){const hls=new Hls({maxBufferLength:30,enableWorker:true});hls.loadSource(videoUrl);hls.attachMedia(video);hls.on(Hls.Events.MANIFEST_PARSED,function(){video.play().catch(()=>{});});}else if(video.canPlayType('application/vnd.apple.mpegurl')){video.src=videoUrl;}document.getElementById('speedSelect').onchange=function(){video.playbackRate=parseFloat(this.value);};}</script></body></html>`;
}

// ============================================================
// CORS HANDLER
// ============================================================
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, User-Id, X-Requested-With, Accept, Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// ============================================================
// MAIN ROUTER PROCESSOR
// ============================================================
module.exports = async function handler(req, res) {
  setCorsHeaders(res);
  
  if (req.method === "OPTIONS") return res.status(200).end();
  
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ success: false, error: "Too many requests. Slow down bro!" });
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }
  body = Object.assign({}, req.query, body);

  const { action } = req.query;

  // Extract tokens directly from frontend headers
  let userToken = req.headers["authorization"];
  let userId = req.headers["user-id"] || body.user_id;

  try {
    // 1. SEND OTP
    if (action === "sendotp") {
      const { mobile } = body;
      if (!mobile) return res.status(400).json({ success: false, error: "mobile required" });
      const response = await fetch(`${AUTH}/auth/check-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "app_id": APP_ID, "platform": "3", "version": "1" },
        body: JSON.stringify({ mobile: String(mobile), device_id: "", mobile_otp_login: 1, otp: "" })
      });
      return res.status(200).json(await response.json());
    }

    // 2. VERIFY OTP
    if (action === "verifyotp") {
      const { mobile, otp, name } = body;
      if (!mobile || !otp) return res.status(400).json({ success: false, error: "mobile & otp required" });
      const response = await fetch(`${AUTH}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "app_id": APP_ID, "platform": "3", "version": "1" },
        body: JSON.stringify({ mobile: String(mobile), otp: String(otp), signup_needed: "0", device_id: "", ...(name ? { name } : {}) })
      });
      return res.status(200).json(await response.json());
    }

    // 3. COURSE DETAILS
    if (action === "course") {
      const { course_id, parent_id } = req.query;
      const response = await fetch(`${NT}/course/course-details`, {
        method: "POST",
        headers: buildHeaders(userToken, userId),
        body: JSON.stringify({ course_id: String(course_id), parent_id: String(parent_id || "0") })
      });
      return res.status(200).json(await response.json());
    }

    // 4. CONTENT LIST
    if (action === "content") {
      const { course_id, folder_id, parent_course_id } = req.query;
      const response = await fetch(`${NT}/course/all-content`, {
        method: "POST",
        headers: buildHeaders(userToken, userId),
        body: JSON.stringify({
          course_id: String(course_id), folder_id: String(folder_id || "0"),
          is_free: "", keyword: "", limit: "1000", page: "1", parent_course_id: String(parent_course_id || "0")
        })
      });
      const data = await response.json();
      if (data.success && data.data && Array.isArray(data.data)) {
        const groupedMap = new Map();
        for (const item of data.data) {
          const title = item.title;
          if (!groupedMap.has(title)) groupedMap.set(title, { title, video: null, pdf: null, other: [] });
          const group = groupedMap.get(title);
          if (item.data?.file_type === 2) group.video = item;
          else if (item.data?.file_type === 1) group.pdf = item;
          else group.other.push(item);
        }
        data.grouped = Array.from(groupedMap.values());
      }
      return res.status(200).json(data);
    }

    // 5. VIDEO/PDF SOURCE DETAILS
    if (action === "video") {
      const { content_id, course_id } = req.query;
      const response = await fetch(`${NT}/course/content-details?content_id=${content_id}&course_id=${course_id}`, {
        method: "GET",
        headers: buildHeaders(userToken, userId)
      });
      const data = await response.json();
      if (data.success && data.data) {
        const content = data.data;
        if (content.file_url) {
          content.directUrl = content.file_url;
          if (content.file_type === 1) {
            content.playerType = "pdf";
            content.viewerUrl = `/api/proxy?action=pdf&url=${encodeURIComponent(content.file_url)}`;
          } else if (content.file_type === 2) {
            content.playerType = "video";
            content.viewerUrl = `/api/proxy?action=player&url=${encodeURIComponent(content.file_url)}&title=${encodeURIComponent(content.title || 'Video')}`;
          }
        }
      }
      return res.status(200).json(data);
    }

    // 6. LIVE CHAT EXTRACTOR
    if (action === "livechat") {
      const { content_id, course_id } = req.query;
      if (!content_id || !course_id) return res.status(400).json({ error: "content_id and course_id required" });

      const response = await fetch(`${NT}/course/content-details?content_id=${content_id}&course_id=${course_id}`, {
        method: "GET", headers: buildHeaders(userToken, userId)
      });
      const data = await response.json();

      if (data.success && data.data) {
        const liveInfo = data.data;
        return res.status(200).json({
          success: true,
          title: liveInfo.title,
          streamUrl: liveInfo.file_url,
          thumbnailUrl: liveInfo.thumbnail,
          mqttHost: "mqtt-ws.nexttoppers.com",
          publicTopic: `${liveInfo.chat_node || liveInfo.content_id}_public`,
          settingTopic: `${liveInfo.chat_node || liveInfo.content_id}_setting`,
          liveFrom: liveInfo.live_date_timestamp || Math.floor(Date.now() / 1000),
          liveTo: (liveInfo.live_date_timestamp || Math.floor(Date.now() / 1000)) + 10800
        });
      }
      return res.status(400).json({ success: false, error: "Live class payload data mapping failed" });
    }

    // 7. MQTT URL
    if (action === "mqtt-url") {
      const cleanToken = userToken.startsWith("Bearer ") ? userToken.slice(7) : userToken;
      const wsUrl = `wss://mqtt-ws.nexttoppers.com/mqtt?uid=${userId}&token=${encodeURIComponent(cleanToken)}&appId=${APP_ID}`;
      return res.status(200).json({ success: true, wsUrl: wsUrl, clientId: String(userId) });
    }

    // 8. HLS PLAYER
    if (action === "player") {
      const { url, title } = req.query;
      if (!url) return res.status(400).json({ error: "url parameter required" });
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(getHLSPlayerHTML(decodeURIComponent(url), title ? decodeURIComponent(title) : "Video Player"));
    }

    // 9. PDF VIEWER
    if (action === "pdf") {
      const { url } = req.query;
      if (!url) return res.status(400).json({ error: "url parameter required" });
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(getPDFViewerHTML(decodeURIComponent(url)));
    }

    // 10. USER PROFILE
    if (action === "profile") {
      const response = await fetch(`${AUTH}/user/my-profile`, {
        method: "GET", headers: buildHeaders(userToken, userId)
      });
      return res.status(200).json(await response.json());
    }

    // 11. TEST INFO
    if (action === "testinfo") {
      const { test_id } = req.query;
      const response = await fetch(`${TEST}/test/get-test-instructions?test_id=${test_id}`, {
        method: "GET", headers: buildHeaders(userToken, userId)
      });
      return res.status(200).json(await response.json());
    }

    // 12. TEST DATA
    if (action === "testdata") {
      const { test_id } = req.query;
      const response = await fetch(`${TEST}/test/get-test-data?test_id=${test_id}`, {
        method: "GET", headers: buildHeaders(userToken, userId)
      });
      return res.status(200).json(await response.json());
    }

    // 13. SUBMIT TEST
    if (action === "submit-test") {
      const { test_id, course_id, answers, total_time_spent } = body;
      const response = await fetch(`${TEST}/test/submit-test`, {
        method: "POST",
        headers: buildHeaders(userToken, userId),
        body: JSON.stringify({ test_id: String(test_id), course_id: String(course_id || ""), user_id: userId, answers, total_time_spent: total_time_spent || 0 })
      });
      return res.status(200).json(await response.json());
    }

    // 14. STATS
    if (action === "stats") {
      return res.status(200).json({ success: true, status: "healthy", activeUsersCached: requestCounts.size, timestamp: Date.now() });
    }

    return res.status(400).json({ success: false, error: "Invalid action routing query options" });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || "Internal server crash" });
  }
};
