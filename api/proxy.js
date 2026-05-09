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

    const targetUrl = "https://rolexcoderz.com/" + path;

    console.log("Proxy Fetching:", targetUrl);

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        Referer: "https://rolexcoderz.com/",
        Origin: "https://rolexcoderz.com"
      }
    });

    let data = await response.text();

    // =========================
    // 1️⃣ FIX absolute assets
    // =========================
    data = data
      .replaceAll('src="/', 'src="https://rolexcoderz.com/')
      .replaceAll('href="/', 'href="https://rolexcoderz.com/');

    // =========================
    // 2️⃣ IMPORTANT: rewrite ONLY MissionJeet links
    // (safe proxy routing)
    // =========================
    data = data.replaceAll(
      'href="/MissionJeet/',
      'href="/api/proxy?path=MissionJeet/'
    );

    data = data.replaceAll(
      'src="/MissionJeet/',
      'src="/api/proxy?path=MissionJeet/'
    );

    // =========================
    // 3️⃣ Prevent broken double proxy injection
    // =========================
    data = data.replaceAll(
      '/api/proxy?/api/proxy?',
      '/api/proxy?'
    );

    const contentType =
      response.headers.get("content-type") || "text/html";

    res.setHeader("Content-Type", contentType);
    res.status(response.status).send(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
