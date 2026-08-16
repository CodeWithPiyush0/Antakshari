# अंताक्षरी

एक अक्षर मिलेगा। उसी से शुरू होने वाला हिंदी गाना लिखो। 30 सेकंड। 3 ज़िंदगियाँ।

A browser antakshari game. You get a Devanagari letter, you type any Hindi film
song starting with it, and a 15-second hook plays as your reward. The last
letter of that song becomes the next letter.

Every game opens on **म**, the way antakshari traditionally does
(`OPENING_LETTER` in `js/game.js`).

## Answers resolve in two tiers

**Tier 1 — the bank.** 356 curated songs, 1950s to today. A hit here is exact:
we know the song's real start letter, its hand-set next letter, and a
verified-embeddable video.

**Tier 2 — open.** Anything else. The letters are inferred from the text itself
(`js/lib/translit.js`) and `/api/search` finds a video on YouTube. This is what
lets the game accept the whole Hindi catalogue instead of a fixed list — a bank
alone recognised about 1 in 5 of the songs people actually typed.

Open answers are judged leniently, and deliberately so: aspirated pairs
(क/ख, त/थ) and vowel lengths (अ/आ) are treated as the same letter, because
romanisation genuinely can't distinguish them. Antakshari is an honour-system
game; rejecting a song you actually know is worse than letting a near-miss
through. Gibberish is still rejected — the found video's title has to share
words with what you typed.

---

## Run it locally

ES modules need a real server. For the **full** game including open answers you
need the API too, which means Vercel's dev server:

```bash
npx vercel dev
```

A plain static server works, but `/api/search` won't exist, so only the 356
bank songs are recognised — everything else comes back "not found":

```bash
npx serve .
```

## Deploy (free)

Drag the folder onto [vercel.com/new](https://vercel.com/new), or:

```bash
npx vercel
```

No build step, no framework, no environment variables, no API keys. The
serverless function runs on the free Hobby tier.

**Note:** GitHub Pages and Netlify Drop serve static files only, so open answers
won't work there — you'd get the bank-only game. Vercel (or Netlify with
Functions) is what makes tier 2 work.

---

## Structure

```
index.html            markup + screens
css/style.css         all styling (chai-tapri paper palette)
api/
  search.js           serverless: free-text song name → playable video
js/
  main.js             wiring: game ↔ ui ↔ player ↔ search
  game.js             rules and state. no DOM.
  ui.js               all DOM reads/writes. no rules.
  player.js           YouTube IFrame hook playback
  search.js           client for /api/search
  data/songs.js       the song bank
  lib/
    devanagari.js     akshar (letter) extraction
    translit.js       roman → Devanagari letter inference
    match.js          fuzzy song lookup
    validate.js       boot-time data sanity check
```

The split that matters: **`game.js` never touches the DOM and `ui.js` never
knows a rule.** They talk through events (`game.on("correct", …)`). You can
change the entire look without opening `game.js`.

`Game` takes its search function by injection —
`new Game(SONGS, { search })` — so the rules stay testable with a stub and
work unchanged when there's no backend at all.

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

**Do you still need to?** Only sort of. Open answers already cover any song
YouTube can find. Adding to the bank buys precision: the exact next letter, a
hand-picked hook timestamp, and an instant answer with no network round-trip.
Worth doing for songs people reach for constantly, not for the long tail.

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
