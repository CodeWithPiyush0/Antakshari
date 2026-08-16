/**
 * translit.js — infer Devanagari aksharas from romanised Hindi.
 *
 * Needed for "open" answers: songs the local bank has never heard of. To judge
 * one we must know two things from raw text like "mere rashke qamar":
 *
 *   firstLetter → म   (does it match the letter on screen?)
 *   lastLetter  → र   (what letter do we pass to the next turn?)
 *
 * This is a heuristic, not a transliterator. Romanised Hindi is wildly
 * inconsistent — "khwaja/khaja/kwaja", "zindagi/jindagi" — so the matching
 * side is deliberately forgiving (see `sameLetter`). A game that rejects a
 * song you actually know is far worse than one that lets a near-miss through;
 * antakshari runs on the honour system anyway.
 */

import { firstLetter, lastLetter, hasDevanagari } from "./devanagari.js";

// longest first — "chh" must beat "ch" must beat "c"
const CONSONANTS = [
  ["chh", "छ"], ["shh", "श"],
  ["kh", "ख"], ["gh", "घ"], ["ch", "च"], ["jh", "झ"], ["th", "थ"],
  ["dh", "ध"], ["ph", "फ"], ["bh", "भ"], ["sh", "श"], ["zh", "ज"],
  ["ts", "त"],
  ["k", "क"], ["q", "क"], ["g", "ग"], ["j", "ज"], ["z", "ज"],
  ["t", "त"], ["d", "द"], ["n", "न"], ["p", "प"], ["f", "फ"],
  ["b", "ब"], ["m", "म"], ["y", "य"], ["r", "र"], ["l", "ल"],
  ["v", "व"], ["w", "व"], ["s", "स"], ["h", "ह"], ["x", "क"],
  ["c", "च"],
];

const VOWELS = [
  ["ai", "ऐ"], ["ae", "ऐ"], ["au", "औ"], ["aa", "आ"], ["ee", "ई"],
  ["ii", "ई"], ["oo", "ऊ"], ["uu", "ऊ"], ["ou", "औ"],
  ["a", "अ"], ["e", "ए"], ["i", "इ"], ["o", "ओ"], ["u", "उ"],
];

/**
 * A trailing "n" is ambiguous: it can be a real न ("watan" → वतन) or just
 * nasalisation on the preceding akshar ("goodiyan" → गूड़ियां, which ends य).
 * Romanisation cannot distinguish them, so these two patterns catch the
 * common nasalised cases and everything else falls through to न.
 */
const NASAL_TAIL = [
  [/y[aeiou]*n$/, "य"],   // goodiyan, kalaiyaan, chittiyaan
  [/h[aeiou]+n$/, "ह"],   // jahan, kahan  (but not "mehman" → न)
];

/**
 * Letters we treat as the same when judging an open answer.
 * Aspirated/unaspirated pairs and vowel lengths are the two things
 * romanisation genuinely cannot distinguish.
 */
const EQUIVALENT = [
  ["अ", "आ"], ["इ", "ई"], ["उ", "ऊ"], ["ए", "ऐ"], ["ओ", "औ"],
  ["क", "ख"], ["ग", "घ"], ["च", "छ"], ["ज", "झ"], ["ट", "ठ"],
  ["ड", "ढ"], ["त", "थ"], ["द", "ध"], ["प", "फ"], ["ब", "भ"],
  ["स", "श"], ["व", "ब"], ["न", "ण"],
];

const groupOf = new Map();
EQUIVALENT.forEach((pair, i) => pair.forEach((ch) => groupOf.set(ch, i)));

/** Do two aksharas count as the same for an open answer? */
export function sameLetter(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const ga = groupOf.get(a);
  const gb = groupOf.get(b);
  return ga !== undefined && ga === gb;
}

const clean = (s) => s.toLowerCase().replace(/[^a-z\s]/g, " ").trim();

/** First akshar of a romanised string: "mere rashke" → म */
export function romanFirst(text) {
  const s = clean(text);
  if (!s) return "";
  for (const [pat, ch] of CONSONANTS) if (s.startsWith(pat)) return ch;
  for (const [pat, ch] of VOWELS) if (s.startsWith(pat)) return ch;
  return "";
}

/**
 * Last akshar of a romanised string. Antakshari takes the letter from the
 * final consonant sound, so trailing vowels are dropped first:
 *   "tujhe dekha" → "dekh" → ख
 *   "mere rashke qamar" → "qamar" → र
 *   "tere naam" → "naam" → म
 */
export function romanLast(text) {
  const words = clean(text).split(/\s+/).filter(Boolean);
  if (!words.length) return "";

  const raw = words[words.length - 1];
  for (const [re, ch] of NASAL_TAIL) if (re.test(raw)) return ch;

  let w = raw.replace(/[aeiou]+$/, "");
  // a word that was all vowels ("hua", "aaya") — fall back to the whole word
  if (!w) w = raw;
  if (!w) return "";

  for (const [pat, ch] of CONSONANTS) {
    if (w.endsWith(pat)) return ch;
  }
  for (const [pat, ch] of VOWELS) {
    if (w.endsWith(pat)) return ch;
  }
  return "";
}

/** First akshar of any input, Devanagari or roman. */
export function inferFirst(text) {
  return hasDevanagari(text) ? firstLetter(text) : romanFirst(text);
}

/** Last akshar of any input, Devanagari or roman. */
export function inferLast(text) {
  return hasDevanagari(text) ? lastLetter(text) : romanLast(text);
}
