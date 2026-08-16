/**
 * ui.js — every DOM read/write lives here.
 * Knows nothing about game rules; it just renders what it's told.
 */

const $ = (id) => document.getElementById(id);

const el = {
  screens: {
    start: $("screen-start"),
    game: $("screen-game"),
    over: $("screen-over"),
  },
  startBest: $("start-best"),
  startBestN: $("start-best-n"),

  streak: $("hud-streak"),
  lives: $("hud-lives"),

  timer: document.querySelector(".timer"),
  timerFill: $("timer-fill"),
  letter: $("letter"),
  stageHint: $("stage-hint"),

  form: $("answer-form"),
  input: $("answer"),
  answer: document.querySelector(".answer"),
  feedback: $("feedback"),

  cardWrap: $("card-wrap"),
  cardTitle: $("card-title"),
  cardMeta: $("card-meta"),
  cardYt: $("card-yt"),
  eq: $("eq"),

  overScore: $("over-score"),
  overLine: $("over-line"),
  overBest: $("over-best"),
};

const RING = 2 * Math.PI * 46; // matches r=46 in the SVG

export const dom = el;

export function showScreen(name) {
  Object.entries(el.screens).forEach(([key, node]) => {
    node.classList.toggle("is-active", key === name);
  });
}

export function setHud(streak, lives) {
  el.streak.textContent = streak;
  el.lives.textContent = "●".repeat(Math.max(0, lives)) +
                         "○".repeat(Math.max(0, 3 - lives));
}

export function setLetter(letter, switched) {
  el.letter.textContent = letter;
  el.letter.classList.remove("is-new");
  void el.letter.offsetWidth; // restart the stamp animation
  el.letter.classList.add("is-new");

  el.stageHint.textContent = switched
    ? "नया अक्षर — पिछले वाले के गाने ख़त्म"
    : "इस अक्षर से शुरू होने वाला गाना";
}

export function setTimer(timeLeft, total) {
  const frac = Math.max(0, timeLeft) / total;
  el.timerFill.style.strokeDashoffset = String(RING * (1 - frac));
  el.timer.classList.toggle("is-urgent", timeLeft <= 7 && timeLeft > 0);
}

export function setFeedback(text, kind = "") {
  el.feedback.textContent = text || " ";
  el.feedback.className = "feedback" + (kind ? ` is-${kind}` : "");
}

export function shake() {
  el.answer.classList.remove("is-wrong");
  void el.answer.offsetWidth;
  el.answer.classList.add("is-wrong");
}

export function clearInput() {
  el.input.value = "";
}

export function focusInput() {
  el.input.focus();
}

export function setInputEnabled(on) {
  el.input.disabled = !on;
}

export function showCard(song, url, audioPlaying) {
  el.cardTitle.textContent = song.t;
  el.cardMeta.textContent = `${song.f} · ${song.y}`;
  el.cardYt.href = url;
  el.eq.classList.toggle("is-on", Boolean(audioPlaying));
  el.cardWrap.hidden = false;
}

export function hideCard() {
  el.cardWrap.hidden = true;
  el.eq.classList.remove("is-on");
}

export function setCardAudio(playing) {
  el.eq.classList.toggle("is-on", Boolean(playing));
}

export function showOver(score, best, line) {
  el.overScore.textContent = score;
  el.overBest.textContent = best;
  el.overLine.textContent = line;
  showScreen("over");
}

export function showBestOnStart(best) {
  if (best > 0) {
    el.startBestN.textContent = best;
    el.startBest.hidden = false;
  }
}
