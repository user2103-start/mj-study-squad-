export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const ORIGIN = "https://rolexcoderz.com";
  const MY_PROXY = "https://mj-study-squad.vercel.app/api/proxy";

  try {
    const { path } = req.query;
    if (!path) return res.status(400).send("Missing path");

    // ── m3u8 / ts / key — stream proxy ──
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
        // Rewrite absolute URLs
        m3u8 = m3u8.replace(/^(https?:\/\/[^\s]+)$/gm, line =>
          `${MY_PROXY}?path=${encodeURIComponent(line)}`
        );
        // Rewrite relative URLs
        m3u8 = m3u8.replace(/^(?!#)(?!https?:\/\/)([^\s]+\.(ts|m3u8|key))$/gm, line => {
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

    // ── stream.php — playlist fetch (video quality URLs) ──
    if (path.includes("stream.php")) {
      const streamUrl = path.startsWith("http") ? path : `${ORIGIN}/MissionJeet/${path}`;
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

      // Rewrite m3u8 URLs in JSON response to go through proxy
      body = body.replace(/"url"\s*:\s*"(https?:\/\/[^"]+)"/g, (match, url) => {
        return `"url":"${MY_PROXY}?path=${encodeURIComponent(url)}"`;
      });

      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "no-store");
      return res.status(streamRes.status).send(body);
    }

    // ── Normal page fetch ──
    const targetUrl = path.startsWith("?")
      ? `${ORIGIN}/MissionJeet/content/index.php${path}`
      : path.startsWith("http")
      ? path
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

    // Non-HTML direct pass
    if (!ct.includes("text/html")) {
      const buf = await upstream.arrayBuffer();
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.status(upstream.status).send(Buffer.from(buf));
    }

    let html = await upstream.text();

    // 1. Remove guard/devtool scripts
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

    // 5. Fix stream.php fetch calls in player JS
    // stream.php?action=playlist&token=... ko proxy se route karo
    html = html.replace(
      /fetch\(`stream\.php([^`]*)`\)/g,
      (m, rest) => `fetch(\`${MY_PROXY}?path=${encodeURIComponent("MissionJeet/stream.php")}${rest.replace(/`/g,'')}\`)`
    );
    html = html.replace(
      /fetch\(['"]stream\.php([^'"]*)['"]\)/g,
      (m, rest) => `fetch('${MY_PROXY}?path=${encodeURIComponent("MissionJeet/stream.php" + rest)}')`
    );

    // 6. JS interceptor
    const interceptor = `<script>
(function(){
  var P="${MY_PROXY}",O="${ORIGIN}",B=["rolexcoderz.in","disable-devtool"];
  function blocked(u){try{var x=new URL(u,location.href);return B.some(function(d){return u.includes(d)});}catch(e){return false;}}
  function px(h){
    if(!h||h==="#"||h.startsWith("javascript")||h.startsWith("mailto")||h.startsWith(P))return null;
    // stream.php — proxy se route karo
    if(h.includes("stream.php")&&!h.startsWith(P)){
      var full=h.startsWith("http")?h:O+"/MissionJeet/"+h.replace(/^\//,"");
      return P+"?path="+encodeURIComponent(full);
    }
    var a;try{a=new URL(h,O+"/").href;}catch(e){return null;}
    if(!a.startsWith(O))return null;
    var p=a.slice(O.length);
    if(p.startsWith("/"))p=p.slice(1);
    if(!p||p.startsWith("?")){var q=a.indexOf("?");p="MissionJeet/content/index.php"+(q>-1?a.slice(q):"");}
    return P+"?path="+encodeURIComponent(p);
  }
  document.addEventListener("click",function(e){
    var el=e.target.closest("a[href]");if(!el)return;
    var h=el.getAttribute("href");
    if(blocked(h)){e.preventDefault();e.stopPropagation();return;}
    var u=px(h);if(!u)return;
    e.preventDefault();e.stopPropagation();location.href=u;
  },true);
  var _f=window.fetch;
  window.fetch=function(u,o){
    if(typeof u==="string"){
      if(blocked(u))return Promise.resolve(new Response(JSON.stringify({qualities:[]}),{status:200,headers:{"Content-Type":"application/json"}}));
      var p=px(u);if(p)u=p;
    }
    return _f.call(this,u,o);
  };
  var _x=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){
    if(typeof u==="string"){
      if(blocked(u))u="about:blank";
      else{var p=px(u);if(p)u=p;}
    }
    return _x.apply(this,arguments);
  };
  var _ps=history.pushState;
  history.pushState=function(s,t,u){if(u){var p=px(String(u));if(p){location.href=p;return;}}return _ps.apply(this,arguments);};
  var _rs=history.replaceState;
  history.replaceState=function(s,t,u){if(u){var p=px(String(u));if(p){location.href=p;return;}}return _rs.apply(this,arguments);};
  console.log("[PROXY] v9 stream.php fixed");
})();
<\/script>`;

    html = html.includes("<head>")
      ? html.replace("<head>", "<head>" + interceptor)
      : interceptor + html;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(html);

  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
