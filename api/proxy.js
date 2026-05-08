export default async function handler(req, res) {

  const id = req.query.id || "152";

  const routes = {
    "151": "https://mj-missiontopper.vercel.app/private/course/drona-jee-class-11th-151?_rsc=1r34m",
    "152": "https://mj-missiontopper.vercel.app/private/course/drona-neet-class-11th-152?_rsc=1r34m"
  };

  const response = await fetch(routes[id], {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept": "*/*",
      "referer": "https://mj-missiontopper.vercel.app/"
    }
  });

  const text = await response.text();

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).send(text);
}
