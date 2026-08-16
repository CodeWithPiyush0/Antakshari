/**
 * match.js — forgiving song lookup.
 *
 * People type "tujhe dekha to", "tujhe dekha", "TUJHE DEKHAA TOH" and
 * "तुझे देखा". All four should find the same song. Two tricks:
 *
 *   1. fold romanisation variants (aa→a, w→v, z→j, ph→f, doubles collapsed)
 *      so spelling choices stop mattering
 *   2. Levenshtein distance with a length-scaled tolerance for real typos
 */

import { skeleton, hasDevanagari } from "./devanagari.js";

const LATIN_ACCENTS = new RegExp("[\\u0300-\\u036F]", "g");

/** Collapse a romanised string to a spelling-agnostic key. */
export function romanKey(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(LATIN_ACCENTS, "")
    .replace(/[^a-z0-9]+/g, "")   // letters and digits only
    .replace(/ph/g, "f")
    .replace(/q/g, "k")
    .replace(/x/g, "ks")
    .replace(/w/g, "v")
    .replace(/z/g, "j")
    .replace(/aa/g, "a")
    .replace(/ee|ie|ii/g, "i")
    .replace(/oo|uu/g, "u")
    .replace(/(.)\1+/g, "$1");    // collapse any remaining doubles
}

/** Collapse a Devanagari string to its bare consonant/vowel skeleton. */
export function devaKey(str) {
  return skeleton(str);
}

/** Levenshtein distance, bailing out once it exceeds `max`. */
export function distance(a, b, max = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * How many typos to forgive for a key of this length.
 * Devanagari keys are far shorter than romanised ones — "तुझे देखा" is 4
 * aksharas where "tujhe dekha" is 9 letters — so they need their own scale.
 */
function tolerance(len, deva) {
  if (deva) {
    // 5 stays at 0: "दलसर" (दिल से रे) and "दलबर" (दिलबरो) are distance 1
    // apart, and one shouldn't swallow the other
    if (len <= 5) return 0;
    if (len <= 9) return 1;
    return 2;
  }
  if (len <= 5) return 0;
  if (len <= 9) return 1;
  if (len <= 16) return 2;
  return 3;
}

/** Shortest partial title we'll accept as a prefix match. */
const PREFIX_MIN = { deva: 4, roman: 5 };

/**
 * Build a lookup index once at boot.
 * Each song gets candidate keys: its Devanagari skeleton plus every
 * romanised alias, folded.
 */
export function buildIndex(songs) {
  return songs.map((song, id) => ({
    id,
    song,
    keys: [devaKey(song.t), ...song.r.map(romanKey)].filter(Boolean),
  }));
}

/**
 * Find the song a player meant.
 * @returns {{song:object, id:number, exact:boolean}|null}
 */
export function findSong(input, index) {
  const raw = input.trim();
  if (raw.length < 2) return null;

  const deva = hasDevanagari(raw);
  const key = deva ? devaKey(raw) : romanKey(raw);
  if (key.length < 2) return null;

  const tol = tolerance(key.length, deva);
  const prefixMin = deva ? PREFIX_MIN.deva : PREFIX_MIN.roman;
  let best = null;
  let bestDist = Infinity;

  for (const entry of index) {
    for (const candidate of entry.keys) {
      if (candidate === key) {
        return { song: entry.song, id: entry.id, exact: true };
      }
      // player typed a real prefix of a longer title
      if (key.length >= prefixMin && candidate.startsWith(key)) {
        if (0.5 < bestDist) { bestDist = 0.5; best = entry; }
        continue;
      }
      if (tol > 0) {
        const d = distance(key, candidate, tol);
        if (d <= tol && d < bestDist) { bestDist = d; best = entry; }
      }
    }
  }

  return best ? { song: best.song, id: best.id, exact: false } : null;
}
