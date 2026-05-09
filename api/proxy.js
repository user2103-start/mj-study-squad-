// =====================================================
// PROXY â€” api/proxy.js (Vercel / Next.js)
// 100% working â€” sab links proxy se route honge
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
      return res.status(400).send("Missing path");
    }

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

    // â”€â”€ Non-HTML (images, CSS, JS, fonts) â€” direct pass karo â”€â”€
    if (!contentType.includes("text/html")) {
      const buffer = await response.arrayBuffer();
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.status(response.status).send(Buffer.from(buffer));
    }

    // â”€â”€ HTML â€” process karo â”€â”€
    let html = await response.text();

    // STEP 1: <base> tag hatao â€” ye sabse badi problem thi
    html = html.replace(/<base[^>]*>/gi, "");

    // STEP 2: Static assets direct ORIGIN se serve karo
    html = html
      .replace(/src="\/([^"]*?)"/g, `src="${ORIGIN}/$1"`)
      .replace(/src='\/([^']*?)'/g, `src='${ORIGIN}/$1'`)
      .replace(
        /href="\/([^"]*?\.(css|woff|woff2|ttf|eot|ico|png|jpg|jpeg|gif|svg))"/gi,
        `href="${ORIGIN}/$1"`
      )
      .replace(
        /href='\/([^']*?\.(css|woff|woff2|ttf|eot|ico|png|jpg|jpeg|gif|svg))'/gi,
        `href='${ORIGIN}/$1'`
      );

    // STEP 3: JS interceptor â€” click, fetch, XHR, history sab handle karega
    const interceptor = `
<script>
(function() {
  var PROXY = "${MY_PROXY}";
  var ORIGIN = "${ORIGIN}";

  function toProxyUrl(href) {
    if (!href) return null;
    if (href.startsWith("#") || href.startsWith("javascript") || href.startsWith("mailto")) return null;

    var abs = "";
    try {
      abs = new URL(href, ORIGIN + "/").href;
    } catch(e) {
      return null;
    }

    if (!abs.startsWith(ORIGIN)) return null;

    var path = abs.slice(ORIGIN.length);
    if (path.startsWith("/")) path = path.slice(1);

    return PROXY + "?path=" + encodeURIComponent(path);
  }

  // â”€â”€ CLICK interceptor â€” sabse reliable â”€â”€
  document.addEventListener("click", function(e) {
    var el = e.target.closest("a[href]");
    if (!el) return;
    var proxyUrl = toProxyUrl(el.getAttribute("href"));
    if (!proxyUrl) return;
    e.preventDefault();
    e.stopPropagation();
    window.location.href = proxyUrl;
  }, true);

  // â”€â”€ fetch() intercept â”€â”€
  var _fetch = window.fetch;
  window.fetch = function(url, opts) {
    if (typeof url === "string") {
      var p = toProxyUrl(url);
      if (p) url = p;
    }
    return _fetch.call(this, url, opts);
  };

  // â”€â”€ XMLHttpRequest intercept â”€â”€
  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url) {
    if (typeof url === "string") {
      var p = toProxyUrl(url);
      if (p) url = p;
    }
    return _open.apply(this, arguments);
  };

  // â”€â”€ history.pushState intercept â”€â”€
  var _push = history.pushState;
  history.pushState = function(state, title, url) {
    if (url) {
      var p = toProxyUrl(url);
      if (p) {
        window.location.href = p;
        return;
      }
    }
    return _push.apply(this, arguments);
  };

  // â”€â”€ history.replaceState intercept â”€â”€
  var _replace = history.replaceState;
  history.replaceState = function(state, title, url) {
    if (url) {
      var p = toProxyUrl(url);
      if (p) {
        window.location.href = p;
        return;
      }
    }
    return _replace.apply(this, arguments);
  };

})();
<\/script>`;

    // </body> se pehle inject karo
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
