/**
 * GET /api/search?q=<song name>
 *
 * Resolves a free-text song name to a YouTube video that will actually play
 * inside an embed, so the game can accept songs that aren't in the local bank.
 *
 * Runs server-side for two reasons: youtube.com blocks cross-origin fetches
 * from the browser, and the YouTube Data API would need a key plus a quota
 * (100 searches/day on the free tier — nowhere near enough).
 *
 * Returns { id, title, seconds } or { id: null }.
 * Deploys as a Vercel serverless function. Free tier, no configuration.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const RE_ID = /"videoId":"([\w-]{11})"/g;
const RE_EMBED = /"playableInEmbed":(true|false)/;
const RE_SECS = /"lengthSeconds":"(\d+)"/;
const RE_TITLE = /"title":"((?:[^"\\]|\\.){2,120})","lengthSeconds"/;

/** Fetch a URL but stop reading as soon as `stop(buf)` is satisfied. */
async function fetchUntil(url, stop, cap = 2_000_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!r.ok || !r.body) return "";

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      if (stop(buf) || buf.length > cap) {
        reader.cancel().catch(() => {});
        break;
      }
    }
    return buf;
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

async function candidates(query) {
  const url =
    "https://www.youtube.com/results?search_query=" + encodeURIComponent(query);
  const body = await fetchUntil(url, (b) => (b.match(RE_ID) || []).length >= 8);
  return [...new Set([...body.matchAll(RE_ID)].map((m) => m[1]))].slice(0, 4);
}

async function inspect(id) {
  const body = await fetchUntil(
    "https://www.youtube.com/watch?v=" + id,
    (b) => RE_EMBED.test(b) && RE_SECS.test(b) && RE_TITLE.test(b)
  );
  const e = body.match(RE_EMBED);
  const s = body.match(RE_SECS);
  const t = body.match(RE_TITLE);
  if (!e) return null;
  return {
    id,
    ok: e[1] === "true",
    seconds: s ? Number(s[1]) : 0,
    title: t ? t[1].replace(/\\u0026/g, "&").replace(/\\"/g, '"') : "",
  };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const q = String((req.query && req.query.q) || "").trim().slice(0, 120);
  if (!q) {
    res.status(400).json({ error: "missing q" });
    return;
  }

  try {
    const ids = await candidates(`${q} song`);
    // check the top few together — the first embeddable one wins
    const infos = await Promise.all(ids.map(inspect));
    const best = infos.find((i) => i && i.ok && i.seconds > 60);

    if (best) {
      // safe to cache hard: a song's video doesn't change
      res.setHeader("Cache-Control", "public, s-maxage=604800, max-age=86400");
      res.status(200).json({ id: best.id, title: best.title, seconds: best.seconds });
      return;
    }

    res.setHeader("Cache-Control", "public, s-maxage=3600");
    res.status(200).json({ id: null });
  } catch {
    res.status(200).json({ id: null });
  }
};
