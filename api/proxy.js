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
      const u = proxyHref(r);
      return u ? `href="${u}"` : m;
    });

    html = html.replace(/href='https?:\/\/rolexcoderz\.com([^']*)'/gi, (m, r) => {
      const u = proxyHref(r);
      return u ? `href='${u}'` : m;
    });

    html = html.replace(/href="\/MissionJeet\/([^"]*)"/gi,
      (m, r) => `href="${MY_PROXY}?path=${encodeURIComponent("MissionJeet/" + r)}"`);

    // 5. JS interceptor
    const script = `<script>
(function(){
  var P="${MY_PROXY}",O="${ORIGIN}",B=["rolexcoderz.in"];
  function blocked(u){try{var x=new URL(u,location.href);return B.some(function(d){return x.hostname.includes(d)});}catch(e){return false;}}
  function px(h){
    if(!h||h==="#"||h.startsWith("javascript")||h.startsWith("mailto")||h.startsWith(P))return null;
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
  var of=window.fetch;
  window.fetch=function(u,o){if(typeof u==="string"){if(blocked(u))return Promise.resolve(new Response("",{status:200}));var p=px(u);if(p)u=p;}return of.call(this,u,o);};
  var ox=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){if(typeof u==="string"){if(blocked(u))u="about:blank";else{var p=px(u);if(p)u=p;}}return ox.apply(this,arguments);};
  var ops=history.pushState;
  history.pushState=function(s,t,u){if(u){if(blocked(String(u)))return;var p=px(String(u));if(p){location.href=p;return;}}return ops.apply(this,arguments);};
  var ors=history.replaceState;
  history.replaceState=function(s,t,u){if(u){if(blocked(String(u)))return;var p=px(String(u));if(p){location.href=p;return;}}return ors.apply(this,arguments);};
  console.log("[PROXY] v6 active");
})();
<\/script>`;

    html = html.includes("</body>")
      ? html.replace("</body>", script + "\n</body>")
      : html + script;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(html);

  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
