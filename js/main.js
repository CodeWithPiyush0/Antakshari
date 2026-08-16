/**
 * main.js — wiring. Connects Game (rules) to ui (pixels) to player (audio).
 */

import { SONGS } from "./data/songs.js";
import { Game } from "./game.js";
import { validate } from "./lib/validate.js";
import * as player from "./player.js";
import * as ui from "./ui.js";

const BEST_KEY = "antakshari.best";
const HOOK_MS = 15_000;
const MISS_PAUSE_MS = 2200;

const game = new Game(SONGS);
let cardTimer = null;
let missTimer = null;

// ── best score ──────────────────────────────────────────────
const readBest = () => Number(localStorage.getItem(BEST_KEY) || 0);
const writeBest = (n) => {
  try { localStorage.setItem(BEST_KEY, String(n)); } catch { /* private mode */ }
};

// ── copy for the game-over line ─────────────────────────────
function verdict(score) {
  if (score === 0) return "एक भी नहीं? कोई बात नहीं — फिर से।";
  if (score < 4)   return "शुरुआत है। बस की पिछली सीट अभी दूर है।";
  if (score < 8)   return "ठीक-ठाक। घरवाले खुश होंगे।";
  if (score < 13)  return "अच्छे खिलाड़ी हो। शादी में तुम्हारी टीम चाहिए।";
  if (score < 20)  return "उस्ताद। कोई हराए तो बताना।";
  return "ये आदमी रेडियो सुनकर बड़ा हुआ है।";
}

function clearTimers() {
  clearTimeout(cardTimer);
  clearTimeout(missTimer);
  cardTimer = missTimer = null;
}

// ── game → ui ───────────────────────────────────────────────
game.on("start", ({ lives }) => {
  clearTimers();
  ui.showScreen("game");
  ui.hideCard();
  ui.setHud(0, lives);
  ui.setFeedback("");
  ui.clearInput();
  ui.setInputEnabled(true);
});

game.on("letter", ({ letter, switched }) => {
  ui.setLetter(letter, switched);
  ui.setFeedback("");
  ui.clearInput();
  ui.setInputEnabled(true);
  ui.focusInput();
});

game.on("tick", ({ timeLeft, total }) => ui.setTimer(timeLeft, total));

game.on("correct", async ({ song, streak }) => {
  ui.setHud(streak, game.lives);
  ui.setInputEnabled(false);
  ui.showCard(song, player.searchUrl(song), false);

  cardTimer = setTimeout(advance, HOOK_MS + 1000);

  const playing = await player.playHook(song);
  ui.setCardAudio(playing);
});

game.on("miss", ({ reason, reveal, lives }) => {
  ui.setHud(game.streak, lives);
  ui.setInputEnabled(false);
  ui.setTimer(0, 30);

  const lead = reason === "timeout" ? "समय ख़त्म।" : "छोड़ दिया।";
  const hint = reveal ? ` "${reveal.t}" चल जाता।` : "";
  ui.setFeedback(lead + hint, "bad");

  if (lives > 0) missTimer = setTimeout(() => game.next(), MISS_PAUSE_MS);
});

game.on("over", ({ streak }) => {
  clearTimers();
  player.stop();
  ui.hideCard();

  const best = Math.max(streak, readBest());
  writeBest(best);
  ui.showOver(streak, best, verdict(streak));
});

// ── ui → game ───────────────────────────────────────────────
function advance() {
  clearTimers();
  player.stop();
  ui.hideCard();
  game.next();
}

ui.dom.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = ui.dom.input.value.trim();
  if (!text) return;

  const result = game.submit(text);

  switch (result.status) {
    case "correct":
      ui.clearInput();
      break;
    case "repeat":
      ui.shake();
      ui.setFeedback(`"${result.song.t}" तो पहले ही गा चुके।`, "bad");
      ui.clearInput();
      break;
    case "letter":
      ui.shake();
      ui.setFeedback(`"${result.song.t}" — पर वो "${result.song.s}" से है।`, "bad");
      break;
    case "unknown":
      ui.shake();
      ui.setFeedback("ये गाना पहचान नहीं पाए। कोई और आज़माओ।");
      break;
  }
});

ui.dom.input.addEventListener("input", () => {
  if (ui.dom.feedback.classList.contains("is-bad")) ui.setFeedback("");
});

document.getElementById("btn-start").addEventListener("click", () => {
  player.preload();          // warm up the iframe on the first user gesture
  game.start();
});

document.getElementById("btn-next").addEventListener("click", advance);
document.getElementById("btn-skip").addEventListener("click", () => game.skip());
document.getElementById("btn-again").addEventListener("click", () => game.start());

document.getElementById("btn-share").addEventListener("click", async (e) => {
  const score = game.streak;
  const text = `मैंने अंताक्षरी में ${score} गाने गाए 🎵\n${location.href}`;
  const btn = e.currentTarget;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "कॉपी हो गया ✓";
  } catch {
    btn.textContent = "कॉपी नहीं हुआ";
  }
  setTimeout(() => { btn.textContent = "स्कोर कॉपी करो"; }, 2000);
});

// Enter on the reward card advances too
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !ui.dom.cardWrap.hidden) advance();
});

// pause audio if the tab goes away
document.addEventListener("visibilitychange", () => {
  if (document.hidden) player.stop();
});

// ── boot ────────────────────────────────────────────────────
ui.showBestOnStart(readBest());
validate(SONGS);
