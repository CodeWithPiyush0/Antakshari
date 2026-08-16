/**
 * player.js — plays a 15-second hook as the reward for a correct answer.
 *
 * Uses the YouTube IFrame API so nothing is self-hosted and artists still get
 * their play counted. Two modes:
 *
 *   song.yt set   → exact video, exact timestamp (precise; fill these in)
 *   song.yt null  → YouTube search for the title, play the top result
 *
 * Search mode is convenient but occasionally lands on a cover or a remix.
 * Everything degrades gracefully: if the API is blocked or slow, the card
 * still shows its "यूट्यूब पर सुनो" link and the game plays on.
 */

const HOST_ID = "yt-host";
const HOOK_SECONDS = 15;
const READY_TIMEOUT = 6000;

let player = null;
let readyPromise = null;
let stopTimer = null;

/** Inject the IFrame API and build the (invisible) player. Idempotent. */
export function preload() {
  if (readyPromise) return readyPromise;

  readyPromise = new Promise((resolve) => {
    const settle = () => resolve(Boolean(player));
    const bail = setTimeout(settle, READY_TIMEOUT);

    const build = () => {
      try {
        player = new window.YT.Player(HOST_ID, {
          height: "1",
          width: "1",
          playerVars: {
            controls: 0,
            disablekb: 1,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: () => { clearTimeout(bail); settle(); },
            onError: () => stop(),
          },
        });
      } catch {
        clearTimeout(bail);
        resolve(false);
      }
    };

    if (window.YT && window.YT.Player) return build();

    // the API calls this global when it finishes loading
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      build();
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.onerror = () => { clearTimeout(bail); resolve(false); };
    document.head.appendChild(tag);
  });

  return readyPromise;
}

/** Public YouTube search URL for a song — always works, even with no API. */
export function searchUrl(song) {
  const q = `${song.t} ${song.f} ${song.y}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

/** Play the song's hook. Resolves true if playback was actually started. */
export async function playHook(song, seconds = HOOK_SECONDS) {
  stop();

  const ok = await preload();
  if (!ok || !player) return false;

  try {
    if (song.yt) {
      player.loadVideoById({
        videoId: song.yt,
        startSeconds: song.h ?? 30,
        endSeconds: (song.h ?? 30) + seconds,
      });
    } else {
      player.loadPlaylist({
        listType: "search",
        list: `${song.t} ${song.f} song`,
        index: 0,
        startSeconds: 30,
      });
    }
    player.setVolume(70);

    // hard stop — endSeconds is unreliable in search mode
    stopTimer = setTimeout(stop, seconds * 1000);
    return true;
  } catch {
    return false;
  }
}

/** Stop playback and clear any pending stop. */
export function stop() {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  try {
    player?.stopVideo?.();
  } catch {
    /* player not ready — nothing to stop */
  }
}
