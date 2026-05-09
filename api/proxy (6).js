export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const ORIGIN = "https://rolexcoderz.com";
  const MY_PROXY = "https://mj-study-squad.vercel.app/api/proxy";

  try {
    const { path } = req.query;
    if (!path) return res.status(400).send("Missing path");

    // ── m3u8 / ts chunks — direct proxy karo ──
    if (path.includes(".m3u8") || path.includes(".ts") || path.includes(".key")) {
      const streamUrl = path.startsWith("http") ? path : `${ORIGIN}/${path}`;
      const streamRes = await fetch(streamUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
          "Referer": `${ORIGIN}/`,
          "Origin": ORIGIN,
        },
      });

      const ct = streamRes.headers.get("content-type") || "application/octet-stream";

      // m3u8 — rewrite chunk URLs to go through proxy
      if (path.includes(".m3u8")) {
        let m3u8 = await streamRes.text();
        // Rewrite every .ts and .m3u8 line to go through proxy
        m3u8 = m3u8.replace(/^(https?:\/\/[^\s]+)$/gm, (line) => {
          return `${MY_PROXY}?path=${encodeURIComponent(line)}`;
        });
        // Relative URLs
        m3u8 = m3u8.replace(/^(?!#)(?!https?:\/\/)([^\s]+\.(ts|m3u8|key))$/gm, (line) => {
          const base = path.substring(0, path.lastIndexOf("/") + 1);
          const fullUrl = base.startsWith("http") ? base + line : `${ORIGIN}/${base}${line}`;
          return `${MY_PROXY}?path=${encodeURIComponent(fullUrl)}`;
        });
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).send(m3u8);
      }

      // .ts / .key — binary pass karo
      const buf = await streamRes.arrayBuffer();
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.status(streamRes.status).send(Buffer.from(buf));
    }

    // ── Normal page fetch ──
    const targetUrl = path.startsWith("?")
      ? `${ORIGIN}/MissionJeet/content/index.php${path}`
      : `${ORIGIN}/${path}`;

    console.log("Fetching:", targetUrl);

    const upstream = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "Referer": `${ORIGIN}/`,
        "Origin": ORIGIN,
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    const ct = upstream.headers.get("content-type") || "";

    if (!ct.includes("text/html")) {
      const buf = await upstream.arrayBuffer();
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.status(upstream.status).send(Buffer.from(buf));
    }

    let html = await upstream.text();

    // 1. Remove guard scripts
    html = html.replace(/<script[^>]*rolexcoderz\.in[^>]*><\/script>/gi, "");
    html = html.replace(/<script[^>]*guard[^>]*><\/script>/gi, "");
    html = html.replace(/<script[^>]*disable-devtool[^>]*><\/script>/gi, "");

    // 2. Remove base tag
    html = html.replace(/<base[^>]*>/gi, "");

    // 3. Fix static assets
    html = html
      .replace(/src="\/([^"]+)"/g, `src="${ORIGIN}/$1"`)
      .replace(/src='\/([^']+)'/g, `src='${ORIGIN}/$1'`)
      .replace(/href="\/([^"]+\.(css|woff2?|ttf|eot|ico))"/gi, `href="${ORIGIN}/$1"`)
      .replace(/href='\/([^']+\.(css|woff2?|ttf|eot|ico))'/gi, `href='${ORIGIN}/$1'`);

    // 4. Rewrite rolexcoderz.com links
    function proxyHref(rest) {
      if (!rest || rest === "/") return null;
      let p = rest.startsWith("/") ? rest.slice(1) : rest;
      if (!p || p.startsWith("?")) {
        const qs = rest.includes("?") ? rest.slice(rest.indexOf("?")) : "";
        p = "MissionJeet/content/index.php" + qs;
      }
      return `${MY_PROXY}?path=${encodeURIComponent(p)}`;
    }

    html = html.replace(/href="https?:\/\/rolexcoderz\.com([^"]*)"/gi, (m, r) => {
      const u = proxyHref(r); return u ? `href="${u}"` : m;
    });
    html = html.replace(/href='https?:\/\/rolexcoderz\.com([^']*)'/gi, (m, r) => {
      const u = proxyHref(r); return u ? `href='${u}'` : m;
    });
    html = html.replace(/href="\/MissionJeet\/([^"]*)"/gi,
      (m, r) => `href="${MY_PROXY}?path=${encodeURIComponent("MissionJeet/" + r)}"`);
    html = html.replace(/href='\/MissionJeet\/([^']*)'/gi,
      (m, r) => `href='${MY_PROXY}?path=${encodeURIComponent("MissionJeet/" + r)}'`);

    // 5. HLS fetch intercept — m3u8 URLs ko proxy se route karo
    const hlsIntercept = `
<script>
(function(){
  var PROXY = "${MY_PROXY}";
  var ORIGIN = "${ORIGIN}";

  // Intercept HLS.js loadSource — m3u8 URL proxy se route karo
  var _XHRopen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === "string") {
      // Block guard/devtool domains
      if (url.includes("rolexcoderz.in") || url.includes("disable-devtool")) {
        url = "about:blank";
      }
      // m3u8, ts, key — proxy se route karo
      else if (url.includes(".m3u8") || url.includes(".ts") || url.includes(".key")) {
        if (!url.startsWith(PROXY)) {
          url = PROXY + "?path=" + encodeURIComponent(url);
        }
      }
      // rolexcoderz.com links
      else if (url.startsWith(ORIGIN) && !url.startsWith(PROXY)) {
        var p = url.slice(ORIGIN.length);
        if (p.startsWith("/")) p = p.slice(1);
        url = PROXY + "?path=" + encodeURIComponent(p);
      }
    }
    return _XHRopen.apply(this, arguments);
  };

  // fetch intercept
  var _fetch = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === "string") {
      if (url.includes("rolexcoderz.in") || url.includes("disable-devtool")) {
        return Promise.resolve(new Response("", {status: 200}));
      }
      if ((url.includes(".m3u8") || url.includes(".ts") || url.includes(".key")) && !url.startsWith(PROXY)) {
        url = PROXY + "?path=" + encodeURIComponent(url);
      } else if (url.startsWith(ORIGIN) && !url.startsWith(PROXY)) {
        var p = url.slice(ORIGIN.length);
        if (p.startsWith("/")) p = p.slice(1);
        url = PROXY + "?path=" + encodeURIComponent(p);
      }
    }
    return _fetch.call(this, url, opts);
  };

  // Click interceptor
  function toProxy(href) {
    if (!href || href === "#" || href.startsWith("javascript") || href.startsWith("mailto") || href.startsWith(PROXY)) return null;
    var abs; try { abs = new URL(href, ORIGIN + "/").href; } catch(e) { return null; }
    if (!abs.startsWith(ORIGIN)) return null;
    var p = abs.slice(ORIGIN.length);
    if (p.startsWith("/")) p = p.slice(1);
    if (!p || p.startsWith("?")) {
      var q = abs.indexOf("?");
      p = "MissionJeet/content/index.php" + (q > -1 ? abs.slice(q) : "");
    }
    return PROXY + "?path=" + encodeURIComponent(p);
  }

  document.addEventListener("click", function(e) {
    var el = e.target.closest("a[href]"); if (!el) return;
    var href = el.getAttribute("href");
    if (href && (href.includes("rolexcoderz.in"))) { e.preventDefault(); e.stopPropagation(); return; }
    var u = toProxy(href); if (!u) return;
    e.preventDefault(); e.stopPropagation(); location.href = u;
  }, true);

  var _push = history.pushState;
  history.pushState = function(s,t,u) {
    if (u) { var p = toProxy(String(u)); if (p) { location.href = p; return; } }
    return _push.apply(this, arguments);
  };

  var _replace = history.replaceState;
  history.replaceState = function(s,t,u) {
    if (u) { var p = toProxy(String(u)); if (p) { location.href = p; return; } }
    return _replace.apply(this, arguments);
  };

  console.log("[PROXY] v8 HLS active");
})();
<\/script>`;

    html = html.includes("</head>")
      ? html.replace("<head>", "<head>" + hlsIntercept)
      : hlsIntercept + html;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(html);

  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
