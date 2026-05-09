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

    console.log("Fetching:", targetUrl);

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        Referer: "https://rolexcoderz.com/",
        Origin: "https://rolexcoderz.com"
      }
    });

    let data = await response.text();

    // OPTIONAL: only fix absolute assets (safe)
    data = data
      .replaceAll('src="/', 'src="https://rolexcoderz.com/')
      .replaceAll('href="/', 'href="https://rolexcoderz.com/');

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "text/html"
    );

    res.status(response.status).send(data);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
