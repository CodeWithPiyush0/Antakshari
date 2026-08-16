/**
 * player.js — plays a 15-second hook as the reward for a correct answer.
 *
 * Uses the YouTube IFrame API, so nothing is self-hosted, there's no bandwidth
 * cost, and the artist still gets the play counted.
 *
 * Every song carries an explicit `yt` video id, verified embeddable when the
 * bank was built. 37 of them are null: their rights holders (Shemaroo,
 * Saregama, YRF) block embedding on every upload, so no id exists that would
 * play here. Those degrade to the card's "यूट्यूब पर सुनो" link.
 *
 * There used to be a `loadPlaylist({listType:"search"})` fallback for songs
 * without an id. It is gone because it silently does nothing — YouTube removed
 * search-based loading from the IFrame API in November 2020. It threw no error
 * and reported no state, which made it look like it worked.
 */

const HOST_ID = "yt-host";
const HOOK_SECONDS = 15;
const READY_TIMEOUT = 6000;
const PLAY_TIMEOUT = 5000;

const PLAYING = 1;

let player = null;
let readyPromise = null;
let stopTimer = null;
let watcher = null;   // resolves the current playHook() call

/** Inject the IFrame API and build the (invisible) player. Idempotent. */
export function preload() {
  if (readyPromise) return readyPromise;

  readyPromise = new Promise((resolve) => {
    let settled = false;
    const settle = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const bail = setTimeout(() => settle(false), READY_TIMEOUT);

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
            onReady: () => { clearTimeout(bail); settle(true); },
            onStateChange: (e) => {
              if (e.data === PLAYING) watcher?.(true);
            },
            onError: () => {
              // 101/150 = embedding disabled, 100 = removed
              watcher?.(false);
              stop();
            },
          },
        });
      } catch {
        clearTimeout(bail);
        settle(false);
      }
    };

    if (window.YT && window.YT.Player) return build();

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      build();
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    tag.onerror = () => { clearTimeout(bail); settle(false); };
    document.head.appendChild(tag);
  });

  return readyPromise;
}

/** Public YouTube search URL — always works, even when the embed can't. */
export function searchUrl(song) {
  const q = `${song.t} ${song.f} ${song.y}`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

/**
 * Play the song's hook.
 * @returns {Promise<boolean>} true only if playback actually started.
 */
export async function playHook(song, seconds = HOOK_SECONDS) {
  stop();
  if (!song.yt) return false;          // known un-embeddable

  const ok = await preload();
  if (!ok || !player) return false;

  const start = song.h ?? 30;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      watcher = null;
      clearTimeout(giveUp);
      resolve(result);
    };

    // resolved by onStateChange(PLAYING) or onError
    watcher = finish;
    const giveUp = setTimeout(() => finish(false), PLAY_TIMEOUT);

    try {
      player.loadVideoById({
        videoId: song.yt,
        startSeconds: start,
        endSeconds: start + seconds,
      });
      player.setVolume(70);
      // belt and braces: endSeconds occasionally overshoots
      stopTimer = setTimeout(stop, (seconds + 1) * 1000);
    } catch {
      finish(false);
    }
  });
}

/** Stop playback and clear any pending stop. */
export function stop() {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  watcher = null;
  try {
    player?.stopVideo?.();
  } catch {
    /* player not ready — nothing to stop */
  }
}
