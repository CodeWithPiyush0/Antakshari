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

The hook plays **in the page**, through a hidden YouTube IFrame player. The
"यूट्यूब पर सुनो" link on the card is only a fallback — you never have to leave
the tab.

**319 of 356 songs have a real, embed-verified video id.** They seek to `h` and
play 15 seconds. The other 37 carry `yt: null`: their rights holders (Shemaroo,
Saregama, YRF) disable embedding on *every* upload of those songs, so no id
exists that would play here. Those show the card and the link, silently.

Ids were resolved by scraping YouTube search and confirming `playableInEmbed`
on each candidate — see the note below if you add songs.

> **Don't reach for `listType: "search"`.** The obvious way to avoid hardcoding
> ids is `player.loadPlaylist({listType: "search", list: query})`. It is dead —
> YouTube removed it in November 2020. It throws no error and reports no state;
> it simply never plays. This project shipped with it briefly and the bug was
> invisible from the outside.

To find an id for a new song: search YouTube, open the video, confirm it plays
in an embed (not just on youtube.com), and paste the 11-character id from the
URL. Set `h` to a few seconds before the recognisable hook.

Nothing is self-hosted, so there's no copyright exposure and no bandwidth cost.
