# अंताक्षरी

एक अक्षर मिलेगा। उसी से शुरू होने वाला हिंदी गाना लिखो। 30 सेकंड। 3 ज़िंदगियाँ।

A browser antakshari game. You get a Devanagari letter, you type any Hindi film
song starting with it, and a 15-second hook plays as your reward. The last
letter of that song becomes the next letter.

356 songs, 1950s to today. Every game opens on **म**, the way antakshari
traditionally does (`OPENING_LETTER` in `js/game.js`).

---

## Run it locally

ES modules need a real server — opening `index.html` by double-clicking will
fail with a CORS error. Any of these work:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open the printed URL. In VS Code, the **Live Server** extension also works.

## Deploy (free)

Drag the folder onto [vercel.com/new](https://vercel.com/new), or:

```bash
npx vercel
```

No build step, no framework, no environment variables. It's static files.
GitHub Pages and Netlify work identically.

---

## Structure

```
index.html            markup + screens
css/style.css         all styling (chai-tapri paper palette)
js/
  main.js             wiring: game ↔ ui ↔ player
  game.js             rules and state. no DOM.
  ui.js               all DOM reads/writes. no rules.
  player.js           YouTube IFrame hook playback
  data/songs.js       the song bank
  lib/
    devanagari.js     akshar (letter) extraction
    match.js          fuzzy song lookup
    validate.js       boot-time data sanity check
```

The split that matters: **`game.js` never touches the DOM and `ui.js` never
knows a rule.** They talk through events (`game.on("correct", …)`). You can
change the entire look without opening `game.js`.

---

## Adding songs

Append to `js/data/songs.js`:

```js
{
  t: "तुझे देखा तो ये जाना सनम",     // title, Devanagari
  r: ["tujhe dekha to", "tujhe dekha"], // how people type it — add plenty
  f: "दिलवाले दुल्हनिया ले जाएँगे",     // film
  y: 1995,
  s: "त",      // START letter — must match the title's first akshar
  e: "म",      // END letter — passed to the next turn
  yt: null,    // YouTube video id, or null for search fallback
  h: 45,       // hook start in seconds (only used when yt is set)
}
```

**On `e`:** set it by hand. Real antakshari takes the letter from the last
*sung line*, not the title, and stripping matras off a title programmatically
gives wrong answers. Prefer letters that already have several songs.

**On `r`:** matching is fuzzy — `aa→a`, `w→v`, `z→j`, doubles collapsed, plus
typo tolerance. So `tujhe dekhaa toh` already resolves. Add aliases anyway for
genuinely different phrasings ("kabutar ja ja" vs "kabootar jaa jaa").

Reload and check the console — `validate.js` prints wrong start letters, dead-end
`e` values, and duplicates.

---

## Audio

Two modes, per song:

| `yt` | behaviour |
|---|---|
| set | exact video, seeks to `h`, plays 15s |
| `null` | YouTube search for title + film, plays the top result |

Every song currently ships with `yt: null`, so playback goes through search.
That works without an API key but occasionally lands on a cover or a remix.
Filling in real video IDs is the single biggest quality upgrade available —
do the top 30 songs first.

If the IFrame API is blocked or slow, the game plays on silently and the reward
card still offers a **यूट्यूब पर सुनो** link.

Nothing is self-hosted, so there's no copyright exposure and no bandwidth cost.
