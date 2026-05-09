// api/proxy.js

export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { path } = req.query;

    if (!path) {
      return res.status(400).send("Missing path");
    }

    // ===== Target URL =====
    const targetUrl =
      "https://rolexcoderz.com/" + path;

    console.log("Fetching:", targetUrl);

    // ===== Fetch Original Site =====
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "*/*",
        Referer: "https://rolexcoderz.com/",
        Origin: "https://rolexcoderz.com",
      },
    });

    let data = await response.text();

    // ===== Rewrite Relative Assets =====
    data = data
      .replaceAll(
        'src="/',
        'src="https://rolexcoderz.com/'
      )
      .replaceAll(
        'href="/',
        'href="https://rolexcoderz.com/'
      );

    // ===== Content Type =====
    const contentType =
      response.headers.get("content-type") ||
      "text/html";

    res.setHeader("Content-Type", contentType);

    return res.status(response.status).send(data);

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
