
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Apne frontend domain ko yahan restrict kar sakte ho.
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const payload =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid JSON body"
      });
    }

    const upstream =
      "https://temp-vibe.egomale82.workers.dev/api/vibe";

    const response = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000)
    });

    const data = await response.text();
    const contentType =
      response.headers.get("content-type");

    if (contentType) {
      res.setHeader("Content-Type", contentType);
    }

    return res.status(response.status).send(data);

  } catch (error) {
    console.error("Vibe proxy error:", error.message);

    return res.status(502).json({
      success: false,
      message: "Upstream API request failed"
    });
  }
}
