// =====================================================
// PROXY — api/proxy.js
// Fix: guard.js remove + server side link rewriting
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

    // path se targetUrl banao
    let targetUrl = "";
    if (path.startsWith("?")) {
      targetUrl = `${ORIGIN}/MissionJeet/content/index.php${path}`;
    } else {
      targetUrl = `${ORIGIN}/${path}`;
    }

    console.log("[PROXY] Fetching:", targetUrl);

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "Referer": `${ORIGIN}/`,
        "Origin": ORIGIN,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    const contentType = response.headers.get("content-type") || "";

    // Non-HTML direct pass
    if (!contentType.includes("text/html")) {
      const buffer = await response.arrayBuffer();
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.status(response.status).send(Buffer.from(buffer));
    }

    let html = await response.text();

    // ── STEP 1: Harmful scripts remove karo ──
    // guard.js — ye proxy detect karke redirect karta hai
    html = html.replace(/<script[^>]*rolexcoderz\.in[^>]*><\/script>/gi, "");
    html = html.replace(/<script[^>]*guard\.js[^>]*><\/script>/gi, "");
    // Koi bhi rolexcoderz.in script
    html = html.replace(/<script[^>]*rolexcoderz\.in[^>]*>[\s\S]*?<\/script>/gi, "");

    // ── STEP 2: <base> tag hatao ──
    html = html.replace(/<base[^>]*>/gi, "");

    // ── STEP 3: Static assets fix ──
    html = html
      .replace(/src="\/([^"]*?)"/g, `src="${ORIGIN}/$1"`)
      .replace(/src='\/([^']*?)'/g, `src='${ORIGIN}/$1'`)
      .replace(/href="\/([^"]*?\.(css|woff2?|ttf|eot|ico))"/gi, `href="${ORIGIN}/$1"`)
      .replace(/href='\/([^']*?\.(css|woff2?|ttf|eot|ico))'/gi, `href='${ORIGIN}/$1'`);

    // ── STEP 4: Server side — sab rolexcoderz.com links rewrite karo ──
    html = html.replace(
      /href="https?:\/\/rolexcoderz\.com([^"]*)"/gi,
      (match, rest) => {
        let p = rest;
        if (p === "/" || p === "") return match; // home link — chhodo
        if (p.startsWith("/")) p = p.slice(1);
        // Root query string — folder links
        if (p === "" || p.startsWith("?")) {
          const qs = rest.startsWith("?") ? rest : rest.slice(rest.indexOf("?"));
          p = `MissionJeet/content/index.php${qs}`;
        }
        return `href="${MY_PROXY}?path=${encodeURIComponent(p)}"`;
      }
    );

    html = html.replace(
      /href='https?:\/\/rolexcoderz\.com([^']*)'/gi,
      (match, rest) => {
        let p = rest;
        if (p === "/" || p === "") return match;
        if (p.startsWith("/")) p = p.slice(1);
        if (p === "" || p.startsWith("?")) {
          const qs = rest.startsWith("?") ? rest : rest.slice(rest.indexOf("?"));
          p = `MissionJeet/content/index.php${qs}`;
        }
        return `href='${MY_PROXY}?path=${encodeURIComponent(p)}'`;
      }
    );

    // Relative MissionJeet links
    html = html.replace(
      /href="\/MissionJeet\/([^"]*)"/gi,
      (match, rest) => `href="${MY_PROXY}?path=${encodeURIComponent("MissionJeet/" + rest)}"`
    );

    // ── STEP 5: JS interceptor — backup + guard block ──
    const interceptor = `
<script>
(function() {
  var PROXY = "${MY_PROXY}";
  var ORIGIN = "${ORIGIN}";

  // Guard — koi bhi rolexcoderz.in pe redirect hone se roko
  var _loc = Object.getOwnPropertyDescriptor(window, 'location');
  var blockedDomains = ["rolexcoderz.in"];

  function isBlocked(url) {
    try {
      var u = new URL(url, window.location.href);
      return blockedDomains.some(function(d) { return u.hostname.includes(d); });
    } catch(e) { return false; }
  }

  function toProxy(href) {
    if (!href) return null;
    if (href === "#" || href.startsWith("javascript") || href.startsWith("mailto")) return null;
    if (href.startsWith(PROXY)) return null;

    var abs;
    try { abs = new URL(href, ORIGIN + "/").href; } catch(e) { return null; }
    if (!abs.startsWith(ORIGIN)) return null;

    var path = abs.slice(ORIGIN.length);
    if (path.startsWith("/")) path = path.slice(1);

    if (path === "" || path.startsWith("?")) {
      var qIdx = abs.indexOf("?");
      var qs = qIdx !== -1 ? abs.slice(qIdx) : "";
      path = "MissionJeet/content/index.php" + qs;
    }

    return PROXY + "?path=" + encodeURIComponent(path);
  }

  // Click interceptor
  document.addEventListener("click", function(e) {
    var el = e.target.closest("a[href]");
    if (!el) return;
    var href = el.getAttribute("href");
    if (!href || href.startsWith(PROXY)) return;

    // Blocked domain — rok do
    if (isBlocked(href)) { e.preventDefault(); e.stopPropagation(); return; }

    var proxyUrl = toProxy(href);
    if (!proxyUrl) return;
    e.preventDefault();
    e.stopPropagation();
    window.location.href = proxyUrl;
  }, true);

  // fetch intercept
  var _fetch = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === "string") {
      if (isBlocked(url)) return Promise.resolve(new Response("", {status: 200}));
      var p = toProxy(url); if (p) url = p;
    }
    return _fetch.call(this, url, opts);
  };

  // XHR intercept
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === "string") {
      if (isBlocked(url)) url = "about:blank";
      else { var p = toProxy(url); if (p) url = p; }
    }
    return _open.apply(this, arguments);
  };

  // pushState intercept
  var _push = history.pushState;
  history.pushState = function(state, title, url) {
    if (url) {
      if (isBlocked(String(url))) return;
      var p = toProxy(String(url)); if (p) { window.location.href = p; return; }
    }
    return _push.apply(this, arguments);
  };

  // replaceState intercept
  var _replace = history.replaceState;
  history.replaceState = function(state, title, url) {
    if (url) {
      if (isBlocked(String(url))) return;
      var p = toProxy(String(url)); if (p) { window.location.href = p; return; }
    }
    return _replace.apply(this, arguments);
  };

  console.log("[PROXY] Interceptor active v5 ✅ — guard blocked");
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
