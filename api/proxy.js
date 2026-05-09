export default async function handler(req, res) {

  const target =
    req.query.id === "152"
      ? "https://missionjeet.thescholarverse.site/private/course/152"
      : "https://missionjeet.thescholarverse.site/private/course/151";

  try {

    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const text = await response.text();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).send(text);

  } catch (err) {

    res.status(500).json({
      error: err.toString()
    });

  }
}
