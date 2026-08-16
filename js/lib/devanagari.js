/**
 * devanagari.js — akshar (letter) utilities.
 *
 * A Devanagari "letter" as a player thinks of it is the base character with
 * all its vowel signs stripped off. "तो" is त, "ज़िं" is ज. These helpers do
 * that stripping, and are used to sanity-check the song bank at boot.
 *
 * Ranges are built with RegExp() from ASCII escapes on purpose — literal
 * combining marks in source are easy to mangle in transit.
 */

// independent vowels + consonants (U+0904–U+0939), nukta forms (U+0958–U+0961),
// and extended letters (U+0972–U+097F)
const BASE = new RegExp("[\\u0904-\\u0939\\u0958-\\u0961\\u0972-\\u097F]");

// matras, anusvara, chandrabindu, visarga, nukta, virama, vedic accents
const MARK = new RegExp(
  "[\\u0900-\\u0903\\u093A-\\u093C\\u093E-\\u094F\\u0951-\\u0957\\u0962\\u0963]"
);

/** Strip every combining mark, leaving bare base characters. */
export function skeleton(str) {
  return [...str].filter((ch) => BASE.test(ch)).join("");
}

/** First akshar of a string, e.g. "तुझे देखा तो" → "त". */
export function firstLetter(str) {
  for (const ch of str) if (BASE.test(ch)) return ch;
  return "";
}

/** Last akshar, e.g. "तुझे देखा तो" → "त". */
export function lastLetter(str) {
  const chars = [...str];
  for (let i = chars.length - 1; i >= 0; i--) {
    if (BASE.test(chars[i])) return chars[i];
  }
  return "";
}

/** True if the string contains any Devanagari at all. */
export function hasDevanagari(str) {
  return [...str].some((ch) => BASE.test(ch) || MARK.test(ch));
}
