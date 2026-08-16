/**
 * game.js — pure game logic. No DOM in here.
 *
 * Emits: start · letter · tick · correct · miss · over
 * The UI listens and renders; it never reaches into game state to mutate it.
 */

import { SONGS } from "./data/songs.js";
import { buildIndex, findSong } from "./lib/match.js";

export const TURN_SECONDS = 30;
export const START_LIVES = 3;

export class Game {
  constructor(songs = SONGS) {
    this.songs = songs;
    this.index = buildIndex(songs);

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
    this.used = new Set();
    this.lastSong = null;
    this.phase = "playing";
    this.emit("start", { lives: this.lives });
    this._setLetter(this._randomLetter(), false);
  }

  /** Advance to the next turn. Called by the UI after the reward card. */
  next() {
    if (this.phase === "over") return;

    const wanted = this.lastSong ? this.lastSong.e : null;
    const canUseWanted = wanted && this._availableFor(wanted).length > 0;
    const letter = canUseWanted ? wanted : this._randomLetter();

    if (!letter) return this._end("cleared");

    this.phase = "playing";
    this._setLetter(letter, Boolean(wanted) && !canUseWanted);
  }

  /**
   * Player submitted an answer.
   * @returns {{status:'correct'|'unknown'|'repeat'|'letter'|'ignored', song?:object}}
   */
  submit(text) {
    if (this.phase !== "playing") return { status: "ignored" };

    const hit = findSong(text, this.index);
    if (!hit) return { status: "unknown" };
    if (this.used.has(hit.id)) return { status: "repeat", song: hit.song };
    if (hit.song.s !== this.letter) return { status: "letter", song: hit.song };

    this.used.add(hit.id);
    this.streak += 1;
    this.lastSong = hit.song;
    this.phase = "reward";
    this._stopClock();
    this.emit("correct", { song: hit.song, streak: this.streak });
    return { status: "correct", song: hit.song };
  }

  /** Player gave up on this letter. Costs a life. */
  skip() {
    if (this.phase !== "playing") return;
    this._miss("skip");
  }

  /** Tear down timers — call when leaving the game screen. */
  destroy() {
    this._stopClock();
    this.phase = "idle";
  }

  // ── internals ─────────────────────────────────────────────
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
