// =====================================================
// PROXY — api/proxy.js
// Final fix: sab links proxy se route honge
// =====================================================

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let { path } = req.query;

    if (!path) return res.status(400).send("Missing path");

    const ORIGIN = "https://rolexcoderz.com";
    const MY_PROXY = "https://mj-study-squad.vercel.app/api/proxy";

    const targetUrl = ORIGIN + "/" + path;
    console.log("Fetching:", targetUrl);

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "Referer": ORIGIN + "/",
        "Origin": ORIGIN,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    const contentType = response.headers.get("content-type") || "";

    // Non-HTML direct pass karo
    if (!contentType.includes("text/html")) {
      const buffer = await response.arrayBuffer();
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.status(response.status).send(Buffer.from(buffer));
    }

    let html = await response.text();

    // STEP 1: <base> tag hatao
    html = html.replace(/<base[^>]*>/gi, "");

    // STEP 2: Static assets fix
    html = html
      .replace(/src="\/([^"]*?)"/g, `src="${ORIGIN}/$1"`)
      .replace(/src='\/([^']*?)'/g, `src='${ORIGIN}/$1'`)
      .replace(/href="\/([^"]*?\.(css|woff2?|ttf|eot|ico))"/gi, `href="${ORIGIN}/$1"`)
      .replace(/href='\/([^']*?\.(css|woff2?|ttf|eot|ico))'/gi, `href='${ORIGIN}/$1'`);

    // STEP 3: Interceptor inject karo
    const interceptor = `
<script>
(function() {
  var PROXY = "${MY_PROXY}";
  var ORIGIN = "${ORIGIN}";

  function toProxy(href) {
    if (!href) return null;
    if (href === "#" || href.startsWith("javascript") || href.startsWith("mailto")) return null;

    var abs;
    try {
      abs = new URL(href, ORIGIN + "/").href;
    } catch(e) { return null; }

    if (!abs.startsWith(ORIGIN)) return null;

    // ORIGIN ke baad ka path lo
    var path = abs.slice(ORIGIN.length); // e.g. "/MissionJeet/content/index.php?..."
    if (path.startsWith("/")) path = path.slice(1); // leading slash hata do

    return PROXY + "?path=" + encodeURIComponent(path);
  }

  // Click interceptor
  document.addEventListener("click", function(e) {
    var el = e.target.closest("a[href]");
    if (!el) return;
    var proxyUrl = toProxy(el.getAttribute("href"));
    if (!proxyUrl) return;
    e.preventDefault();
    e.stopPropagation();
    window.location.href = proxyUrl;
  }, true);

  // fetch intercept
  var _fetch = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === "string") { var p = toProxy(url); if (p) url = p; }
    return _fetch.call(this, url, opts);
  };

  // XHR intercept
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === "string") { var p = toProxy(url); if (p) url = p; }
    return _open.apply(this, arguments);
  };

  // history.pushState intercept
  var _push = history.pushState;
  history.pushState = function(state, title, url) {
    if (url) { var p = toProxy(String(url)); if (p) { window.location.href = p; return; } }
    return _push.apply(this, arguments);
  };

  // history.replaceState intercept
  var _replace = history.replaceState;
  history.replaceState = function(state, title, url) {
    if (url) { var p = toProxy(String(url)); if (p) { window.location.href = p; return; } }
    return _replace.apply(this, arguments);
  };

  console.log("[PROXY] Interceptor active v3 ✅");
})();
<\/script>`;

    if (html.includes("</body>")) {
      html = html.replace("</body>", interceptor + "\n</body>");
    } else {
      html += interceptor;
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(html);

  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
