/**
 * game.js — pure game logic. No DOM in here.
 *
 * Answers resolve in two tiers:
 *
 *   bank  — the song is one of the ~356 curated entries. We know its real
 *           start letter, its curated next letter, and a verified video id.
 *   open  — anything else. We infer the letters from the text itself and ask
 *           the injected `search` function for a video. This is what lets the
 *           game accept the entire Hindi catalogue instead of a fixed list.
 *
 * Open answers are checked leniently on purpose. Antakshari is an honour-system
 * game; rejecting a song the player actually knows is far worse than letting a
 * near-miss through.
 *
 * Emits: start · letter · tick · checking · correct · miss · over
 */

import { SONGS } from "./data/songs.js";
import { buildIndex, findSong } from "./lib/match.js";
import { inferFirst, inferLast, sameLetter } from "./lib/translit.js";

export const TURN_SECONDS = 30;
export const START_LIVES = 3;

/** Antakshari traditionally opens on म. Falls back to random if म is empty. */
export const OPENING_LETTER = "म";

const words = (s) =>
  s.toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 2);

const DEVA = /[ऀ-ॿ]/g;
const LATIN = /[a-z]/gi;

/**
 * Does the video we found actually look like the song they asked for?
 * YouTube returns *something* for any query, including gibberish, so without
 * this "asdfghjkl" would be accepted as a valid answer.
 */
function looksRight(found, text) {
  if (!found || !found.id) return false;

  const deva = (text.match(DEVA) || []).length;
  const latin = (text.match(LATIN) || []).length;

  // Pure Devanagari is taken on trust: those titles rarely share tokens with a
  // Latin video title, and nobody types Devanagari by accident. Mixed script
  // ("तqwerty") is not real input, so it falls through to the strict path.
  if (deva >= 3 && latin === 0) return true;

  const asked = words(text);
  if (!asked.length) return false;
  const got = new Set(words(found.title || ""));
  const overlap = asked.filter((w) => got.has(w)).length;
  return overlap >= Math.min(2, asked.length);
}

export class Game {
  /**
   * @param {Array} songs the curated bank
   * @param {{search?: (q:string)=>Promise<{id,title,seconds}|null>}} opts
   */
  constructor(songs = SONGS, opts = {}) {
    this.songs = songs;
    this.index = buildIndex(songs);
    this.search = opts.search || (async () => null);

    // letter → [song ids]
    this.byLetter = new Map();
    songs.forEach((song, id) => {
      if (!this.byLetter.has(song.s)) this.byLetter.set(song.s, []);
      this.byLetter.get(song.s).push(id);
    });

    this.handlers = Object.create(null);
    this.phase = "idle";
    this.timer = null;
  }

  // ── events ────────────────────────────────────────────────
  on(event, fn) {
    (this.handlers[event] ||= []).push(fn);
    return this;
  }
  emit(event, payload) {
    (this.handlers[event] || []).forEach((fn) => fn(payload));
  }

  // ── lifecycle ─────────────────────────────────────────────
  start() {
    this.lives = START_LIVES;
    this.streak = 0;
    this.used = new Set();      // bank song ids
    this.usedOpen = new Set();  // normalised open answers
    this.lastSong = null;
    this.phase = "playing";
    this.emit("start", { lives: this.lives });

    const opener = this._availableFor(OPENING_LETTER).length
      ? OPENING_LETTER
      : this._randomLetter();
    this._setLetter(opener, false);
  }

  /** Advance to the next turn. Called by the UI after the reward card. */
  next() {
    if (this.phase === "over") return;

    // Any non-empty letter is honoured now: with open answers the player can
    // always respond, so a letter the bank can't cover is no longer a dead end.
    const wanted = this.lastSong ? this.lastSong.e : null;
    const letter = wanted || this._randomLetter();
    if (!letter) return this._end("cleared");

    this.phase = "playing";
    this._setLetter(letter, false);
  }

  /**
   * Player submitted an answer.
   * @returns {Promise<{status:string, song?:object, guessed?:string}>}
   *   correct | unknown | repeat | letter | ignored
   */
  async submit(text) {
    if (this.phase !== "playing") return { status: "ignored" };

    // ── tier 1: the curated bank ──
    const hit = findSong(text, this.index);
    if (hit) {
      if (this.used.has(hit.id)) return { status: "repeat", song: hit.song };
      if (hit.song.s !== this.letter) return { status: "letter", song: hit.song };
      this.used.add(hit.id);
      return this._accept(hit.song);
    }

    // ── tier 2: open answer ──
    const first = inferFirst(text);
    if (first && !sameLetter(first, this.letter)) {
      return { status: "letter", guessed: first };
    }
    const key = words(text).join(" ");
    if (!key || key.length < 3) return { status: "unknown" };
    if (this.usedOpen.has(key)) return { status: "repeat" };

    // network round-trip — hold the clock so the search isn't on their time
    this.phase = "checking";
    this._stopClock();
    this.emit("checking", { text });

    let found = null;
    try {
      found = await this.search(text);
    } catch {
      found = null;
    }

    // the player may have given up or died while we were waiting
    if (this.phase !== "checking") return { status: "ignored" };

    if (!looksRight(found, text)) {
      this.phase = "playing";
      this._startClock();
      return { status: "unknown" };
    }

    this.usedOpen.add(key);
    return this._accept({
      t: text.trim(),
      f: found.title || "यूट्यूब",
      y: "",
      s: this.letter,
      e: inferLast(text) || this._randomLetter(),
      yt: found.id,
      h: Math.min(45, Math.max(10, Math.floor((found.seconds || 200) * 0.25))),
      open: true,
    });
  }

  /** Player gave up on this letter. Costs a life. */
  skip() {
    if (this.phase !== "playing" && this.phase !== "checking") return;
    this._miss("skip");
  }

  /** Tear down timers — call when leaving the game screen. */
  destroy() {
    this._stopClock();
    this.phase = "idle";
  }

  // ── internals ─────────────────────────────────────────────
  _accept(song) {
    this.streak += 1;
    this.lastSong = song;
    this.phase = "reward";
    this._stopClock();
    this.emit("correct", { song, streak: this.streak });
    return { status: "correct", song };
  }

  _availableFor(letter) {
    return (this.byLetter.get(letter) || []).filter((id) => !this.used.has(id));
  }

  /**
   * A fresh letter, used at game start and after every miss.
   * Prefers letters with a few songs left — opening on a letter that has
   * exactly one obscure answer is just a coin-flip death.
   */
  _randomLetter() {
    const keys = [...this.byLetter.keys()];
    const comfortable = keys.filter((l) => this._availableFor(l).length >= 3);
    const playable = comfortable.length
      ? comfortable
      : keys.filter((l) => this._availableFor(l).length > 0);

    if (!playable.length) return null;
    return playable[Math.floor(Math.random() * playable.length)];
  }

  _setLetter(letter, switched) {
    this.letter = letter;
    this.timeLeft = TURN_SECONDS;
    this.emit("letter", { letter, switched });
    this.emit("tick", { timeLeft: this.timeLeft, total: TURN_SECONDS });
    this._startClock();
  }

  _startClock() {
    this._stopClock();
    this.timer = setInterval(() => {
      this.timeLeft -= 1;
      this.emit("tick", { timeLeft: this.timeLeft, total: TURN_SECONDS });
      if (this.timeLeft <= 0) this._miss("timeout");
    }, 1000);
  }

  _stopClock() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  _miss(reason) {
    this._stopClock();
    this.lives -= 1;

    // show them one answer they could have given
    const options = this._availableFor(this.letter);
    const reveal = options.length
      ? this.songs[options[Math.floor(Math.random() * options.length)]]
      : null;

    this.lastSong = null; // a miss resets to a fresh random letter
    this.phase = "missed";
    this.emit("miss", { reason, reveal, lives: this.lives });

    if (this.lives <= 0) this._end("dead");
  }

  _end(how) {
    this._stopClock();
    this.phase = "over";
    this.emit("over", { streak: this.streak, how });
  }
}
