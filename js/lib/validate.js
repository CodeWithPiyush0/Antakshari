/**
 * validate.js — boot-time sanity check on the song bank.
 *
 * Run in the console whenever you add songs. Catches the three mistakes that
 * actually break the game:
 *   · `s` doesn't match the title's real first akshar
 *   · `e` points at a letter no song starts with (playable, but the game
 *      has to jump to a random letter, which feels arbitrary)
 *   · duplicate titles
 */

import { firstLetter } from "./devanagari.js";

export function validate(songs, { log = true } = {}) {
  const starts = new Set(songs.map((s) => s.s));
  const issues = { badStart: [], deadEnd: [], duplicates: [] };
  const seen = new Map();

  songs.forEach((song, i) => {
    const real = firstLetter(song.t);
    if (real && real !== song.s) {
      issues.badStart.push(`[${i}] "${song.t}" — s:"${song.s}" but title starts "${real}"`);
    }
    if (!starts.has(song.e)) {
      issues.deadEnd.push(`[${i}] "${song.t}" — e:"${song.e}" has no songs`);
    }
    if (seen.has(song.t)) {
      issues.duplicates.push(`[${i}] "${song.t}" — also at [${seen.get(song.t)}]`);
    } else {
      seen.set(song.t, i);
    }
  });

  const total = issues.badStart.length + issues.deadEnd.length + issues.duplicates.length;

  if (log) {
    const counts = new Map();
    songs.forEach((s) => counts.set(s.s, (counts.get(s.s) || 0) + 1));
    const thin = [...counts.entries()].filter(([, n]) => n < 2).map(([l]) => l);

    console.groupCollapsed(
      `%cअंताक्षरी%c ${songs.length} songs · ${starts.size} letters · ${total} issue(s)`,
      "color:#d1590f;font-weight:700", "color:inherit"
    );
    Object.entries(issues).forEach(([key, list]) => {
      if (list.length) { console.warn(key); list.forEach((m) => console.log("  " + m)); }
    });
    if (thin.length) console.log("letters with only 1 song:", thin.join(" "));
    console.groupEnd();
  }

  return { ok: total === 0, issues };
}
