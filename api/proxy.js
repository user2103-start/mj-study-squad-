export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let { path, course_id } = req.query;

    if (!path && course_id) {
      path = `MissionJeet/content/index.php?course_id=${course_id}`;
    }

    if (!path) return res.status(400).send("Missing path");

    const targetUrl = "https://rolexcoderz.com/" + path;

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://rolexcoderz.com/",
        Origin: "https://rolexcoderz.com"
      }
    });

    let data = await response.text();

    // ✔ ONLY asset fix (safe)
    data = data
      .replaceAll('src="/', 'src="https://rolexcoderz.com/')
      .replaceAll('href="/', 'href="https://rolexcoderz.com/');

    res.setHeader("Content-Type", response.headers.get("content-type") || "text/html");
    res.status(response.status).send(data);

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
