/**
 * search.js — client for /api/search.
 *
 * Resolves a free-text song name to a playable YouTube video, so the game can
 * accept songs outside the local bank. The endpoint is a Vercel serverless
 * function (see api/search.js) because youtube.com can't be fetched from the
 * browser and the official Data API needs a key with a tiny free quota.
 *
 * Degrades to null on any failure — the caller treats that as "not recognised"
 * and the game keeps running. Notably this is what happens on a plain static
 * server with no API: only bank songs are accepted.
 */

const ENDPOINT = "/api/search";
const TIMEOUT_MS = 7000;

const cache = new Map();

/**
 * @param {string} query
 * @returns {Promise<{id:string,title:string,seconds:number}|null>}
 */
export async function searchSong(query) {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const r = await fetch(`${ENDPOINT}?q=${encodeURIComponent(query)}`, {
      signal: ctrl.signal,
    });
    if (!r.ok) return null;
    const data = await r.json();
    const result = data && data.id ? data : null;
    cache.set(key, result);
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
