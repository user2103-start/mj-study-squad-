export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const ORIGIN = "https://rolexcoderz.com";
  const MY_PROXY = "https://mj-study-squad.vercel.app/api/proxy";
  const MISSION_BASE = `${ORIGIN}/MissionJeet`;

  try {
    const { path } = req.query;
    if (!path) return res.status(400).send("Missing path");

    // ── 1. stream.php — playlist ya variant ──
    if (path.includes("stream.php")) {
      // Full URL already ho to waise use karo, warna build karo
      const streamUrl = path.startsWith("http")
        ? path
        : `${MISSION_BASE}/${path.replace(/^\//, "")}`;

      console.log("[PROXY] stream.php:", streamUrl);

      const streamRes = await fetch(streamUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
          "Referer": `${ORIGIN}/`,
          "Origin": ORIGIN,
          "Accept": "application/json, text/plain, */*",
        },
      });

      const ct = streamRes.headers.get("content-type") || "application/json";
      let body = await streamRes.text();

      // action=playlist — JSON mein stream.php URLs ko proxy se rewrite karo
      if (path.includes("action=playlist")) {
        try {
          const json = JSON.parse(body);
          // qualities array mein URLs fix karo
          if (json.qualities) {
            json.qualities = json.qualities.map(q => ({
              ...q,
              url: `${MY_PROXY}?path=${encodeURIComponent(MISSION_BASE + "/" + q.url)}`
            }));
          }
          // playlist string mein bhi fix karo
          if (json.playlist) {
            json.playlist = json.playlist.replace(
              /^(stream\.php\?action=variant[^\n]+)$/gm,
              (line) => `${MY_PROXY}?path=${encodeURIComponent(MISSION_BASE + "/" + line)}`
            );
          }
          body = JSON.stringify(json);
        } catch(e) {
          // JSON parse fail — raw replace karo
          body = body.replace(
            /"url":"(stream\.php[^"]+)"/g,
            (m, url) => `"url":"${MY_PROXY}?path=${encodeURIComponent(MISSION_BASE + "/" + url)}"`
          );
        }
      }

      // action=variant — m3u8 playlist return karta hai
      // Isme CloudFront URLs honge — unhe direct rakhte hain (ye kaam karta hai!)
      res.setHeader("Content-Type", ct.includes("json") ? "application/json" : "application/vnd.apple.mpegurl");
      res.setHeader("Cache-Control", "no-store");
      return res.status(streamRes.status).send(body);
    }

    // ── 2. m3u8 / ts / key — stream chunks ──
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
      if (path.includes(".m3u8")) {
        let m3u8 = await streamRes.text();
        // Absolute URLs rewrite
        m3u8 = m3u8.replace(/^(https?:\/\/[^\s]+)$/gm,
          line => `${MY_PROXY}?path=${encodeURIComponent(line)}`);
        // Relative URLs rewrite
        m3u8 = m3u8.replace(/^(?!#)(?!https?:\/\/)([^\s]+)$/gm, line => {
          const base = path.substring(0, path.lastIndexOf("/") + 1);
          const fullUrl = base.startsWith("http") ? base + line : `${ORIGIN}/${base}${line}`;
          return `${MY_PROXY}?path=${encodeURIComponent(fullUrl)}`;
        });
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).send(m3u8);
      }
      const buf = await streamRes.arrayBuffer();
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.status(streamRes.status).send(Buffer.from(buf));
    }

    // ── 3. Normal page fetch ──
    const targetUrl = path.startsWith("?")
      ? `${ORIGIN}/MissionJeet/content/index.php${path}`
      : path.startsWith("http")
      ? path
      : `${ORIGIN}/${path}`;

    console.log("[PROXY] Fetching:", targetUrl);

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

    // Remove guard scripts
    html = html.replace(/<script[^>]*rolexcoderz\.in[^>]*><\/script>/gi, "");
    html = html.replace(/<script[^>]*guard[^>]*><\/script>/gi, "");
    html = html.replace(/<script[^>]*disable-devtool[^>]*><\/script>/gi, "");

    // Remove base tag
    html = html.replace(/<base[^>]*>/gi, "");

    // Fix static assets
    html = html
      .replace(/src="\/([^"]+)"/g, `src="${ORIGIN}/$1"`)
      .replace(/src='\/([^']+)'/g, `src='${ORIGIN}/$1'`)
      .replace(/href="\/([^"]+\.(css|woff2?|ttf|eot|ico))"/gi, `href="${ORIGIN}/$1"`)
      .replace(/href='\/([^']+\.(css|woff2?|ttf|eot|ico))'/gi, `href='${ORIGIN}/$1'`);

    // Rewrite rolexcoderz.com links
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

    // Fix stream.php calls in JS — backtick template literals
    html = html.replace(
      /`stream\.php\?action=playlist&token=\$\{([^}]+)\}`/g,
      (m, tokenVar) => `\`${MY_PROXY}?path=\${encodeURIComponent(\`${MISSION_BASE}/stream.php?action=playlist&token=\${${tokenVar}}\`)}\``
    );
    // Fix stream.php calls — string concatenation
    html = html.replace(
      /['"]stream\.php\?action=playlist&token=['"](\s*\+\s*)/g,
      `'${MY_PROXY}?path=' + encodeURIComponent('${MISSION_BASE}/stream.php?action=playlist&token=') + `
    );

    // JS interceptor
    const interceptor = `<script>
(function(){
  var P="${MY_PROXY}",O="${ORIGIN}",MB="${MISSION_BASE}";
  var BLOCKED=["rolexcoderz.in","disable-devtool"];

  function isBlocked(u){ return BLOCKED.some(function(b){return u.includes(b);}); }

  function fixUrl(u){
    if(!u||u.startsWith(P)||u.startsWith("blob:")||u.startsWith("data:"))return u;
    // stream.php — proxy se route karo
    if(u.includes("stream.php")){
      var full=u.startsWith("http")?u:MB+"/"+u.replace(/^\//,"");
      return P+"?path="+encodeURIComponent(full);
    }
    // rolexcoderz.com links
    if(u.startsWith(O)){
      var p=u.slice(O.length);
      if(p.startsWith("/"))p=p.slice(1);
      if(!p||p.startsWith("?")){
        var q=u.indexOf("?");
        p="MissionJeet/content/index.php"+(q>-1?u.slice(q):"");
      }
      return P+"?path="+encodeURIComponent(p);
    }
    return u;
  }

  // fetch intercept
  var _f=window.fetch;
  window.fetch=function(u,o){
    if(typeof u==="string"){
      if(isBlocked(u))return Promise.resolve(new Response(
        JSON.stringify({qualities:[],playlist:""}),
        {status:200,headers:{"Content-Type":"application/json"}}
      ));
      u=fixUrl(u);
    }
    return _f.call(this,u,o);
  };

  // XHR intercept
  var _x=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){
    if(typeof u==="string"){
      if(isBlocked(u))u="about:blank";
      else u=fixUrl(u);
    }
    return _x.apply(this,arguments);
  };

  // Click intercept
  document.addEventListener("click",function(e){
    var el=e.target.closest("a[href]");if(!el)return;
    var h=el.getAttribute("href");if(!h)return;
    if(isBlocked(h)){e.preventDefault();e.stopPropagation();return;}
    var u=fixUrl(h);
    if(u!==h){e.preventDefault();e.stopPropagation();location.href=u;}
  },true);

  // history intercept
  var _ps=history.pushState;
  history.pushState=function(s,t,u){
    if(u){var f=fixUrl(String(u));if(f!==String(u)){location.href=f;return;}}
    return _ps.apply(this,arguments);
  };
  var _rs=history.replaceState;
  history.replaceState=function(s,t,u){
    if(u){var f=fixUrl(String(u));if(f!==String(u)){location.href=f;return;}}
    return _rs.apply(this,arguments);
  };

  console.log("[PROXY] v10 ready ✅");
})();
<\/script>`;

    html = html.includes("<head>")
      ? html.replace("<head>", "<head>" + interceptor)
      : interceptor + html;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(html);

  } catch (err) {
    console.error("[PROXY] Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
