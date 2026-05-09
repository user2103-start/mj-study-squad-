// =====================================================
// FIXED PROXY — api/proxy.js (Vercel / Next.js)
// Sab fixes:
//   1. path ka & encode issue fixed
//   2. HTML ke andar links rewrite hote hain proxy se
//   3. Base tag inject hoti hai JS redirects ke liye
//   4. Relative paths sahi se handle hote hain
// =====================================================

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    let { path } = req.query;

    if (!path) {
      return res.status(400).send("Missing path — URL mein ?path=... daalo");
    }

    // path already decoded hoga (Next.js karta hai), direct use karo
    const targetUrl = "https://rolexcoderz.com/" + path;

    console.log("Fetching:", targetUrl);

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        Referer: "https://rolexcoderz.com/",
        Origin: "https://rolexcoderz.com",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    const contentType = response.headers.get("content-type") || "";

    // -------------------------------------------------------
    // Non-HTML (images, CSS, JS, fonts etc.) — direct paas karo
    // -------------------------------------------------------
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/xml")
    ) {
      const buffer = await response.arrayBuffer();
      res.setHeader("Content-Type", contentType);
      res.status(response.status).send(Buffer.from(buffer));
      return;
    }

    // -------------------------------------------------------
    // HTML — rewrite karo
    // -------------------------------------------------------
    let data = await response.text();

    // Proxy ka apna base URL (Vercel pe jo URL hai)
    // ⚠️ APNA URL YAHAN DAALO
    const MY_PROXY = "https://YOUR-PROXY-URL.vercel.app/api/proxy";
    const ORIGIN = "https://rolexcoderz.com";

    // ---- FIX 1: <head> mein base tag inject karo ----
    // Ye JS redirects aur relative paths dono handle karta hai
    data = data.replace(
      /<head([^>]*)>/i,
      `<head$1><base href="${ORIGIN}/">`
    );

    // ---- FIX 2: Absolute asset paths fix karo ----
    data = data
      .replace(/src="\/([^"]+)"/g, `src="${ORIGIN}/$1"`)
      .replace(/href="\/([^"]+)"/g, (match, p1) => {
        // CSS/fonts — direct ORIGIN pe bhejo
        if (p1.match(/\.(css|woff|woff2|ttf|eot|svg|png|jpg|jpeg|gif|ico)(\?|$)/i)) {
          return `href="${ORIGIN}/${p1}"`;
        }
        // PHP pages — proxy se route karo
        if (p1.match(/\.php/i) || p1.includes("MissionJeet")) {
          return `href="${MY_PROXY}?path=${encodeURIComponent(p1)}"`;
        }
        return `href="${ORIGIN}/${p1}"`;
      });

    // ---- FIX 3: action attributes (forms) ----
    data = data.replace(
      /action="\/([^"]+)"/g,
      (match, p1) => `action="${MY_PROXY}?path=${encodeURIComponent(p1)}"`
    );

    // ---- FIX 4: JavaScript mein window.location aur fetch calls ----
    // Ye dangerous hai kyunki regex se JS nahi parse hoti — isliye
    // ek small JS snippet inject karte hain jo runtime pe handle kare
    const interceptScript = `
<script>
(function() {
  var PROXY = "${MY_PROXY}";
  var ORIGIN = "${ORIGIN}";

  // Intercept fetch calls
  var origFetch = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === "string" && url.startsWith(ORIGIN)) {
      var path = url.replace(ORIGIN + "/", "");
      url = PROXY + "?path=" + encodeURIComponent(path);
    }
    return origFetch.call(this, url, opts);
  };

  // Intercept XMLHttpRequest
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === "string" && url.startsWith(ORIGIN)) {
      var path = url.replace(ORIGIN + "/", "");
      url = PROXY + "?path=" + encodeURIComponent(path);
    }
    return origOpen.apply(this, arguments);
  };
})();
<\/script>`;

    // Inject before </head>
    data = data.replace("</head>", interceptScript + "</head>");

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Cache nahi karo
    res.setHeader("Cache-Control", "no-store");
    res.status(response.status).send(data);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
