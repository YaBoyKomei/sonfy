/**
 * Background YouTube Radio Loader
 * Uses an invisible YouTube IFrame player on the client to cue RDAMVM radio mixes
 * and extract genuine YouTube Music recommendation queues without interrupting playback.
 */

let loaderPlayer = null;
let isPlayerReady = false;
let readyCallbacks = [];
let pendingPromise = Promise.resolve();

const ensureContainerExists = () => {
  let container = document.getElementById('hidden-radio-loader');
  if (!container) {
    container = document.createElement('div');
    container.id = 'hidden-radio-loader';
    container.style.position = 'fixed';
    container.style.bottom = '-9999px';
    container.style.left = '-9999px';
    container.style.width = '1px';
    container.style.height = '1px';
    container.style.opacity = '0.01';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '-9999';
    document.body.appendChild(container);
  }
  return container;
};

export const initRadioLoader = () => {
  if (loaderPlayer) return;

  const init = () => {
    if (!window.YT || !window.YT.Player) {
      setTimeout(init, 250);
      return;
    }

    ensureContainerExists();

    try {
      loaderPlayer = new window.YT.Player('hidden-radio-loader', {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0
        },
        events: {
          onReady: (event) => {
            console.log('📻 Background radio loader player ready');
            try {
              event.target.mute();
              event.target.setVolume(0);
            } catch (e) {}
            isPlayerReady = true;
            readyCallbacks.forEach(cb => cb(event.target));
            readyCallbacks = [];
          },
          onError: (err) => {
            console.warn('Background radio loader error:', err);
          }
        }
      });
    } catch (err) {
      console.warn('Failed to initialize background radio loader:', err);
    }
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    window.addEventListener('DOMContentLoaded', init);
  }
};

const getLoaderPlayer = () => {
  return new Promise((resolve) => {
    if (loaderPlayer && isPlayerReady) {
      resolve(loaderPlayer);
      return;
    }
    readyCallbacks.push(resolve);
    initRadioLoader();

    // Fallback timeout after 7 seconds in case YouTube API fails to load
    setTimeout(() => {
      if (!isPlayerReady) {
        resolve(null);
      }
    }, 7000);
  });
};

const doFetchRadioVideoIds = async (seedVideoId, timeoutMs = 4500) => {
  if (!seedVideoId) return [];

  try {
    const player = await getLoaderPlayer();
    if (!player) {
      console.warn('Background radio loader player not available');
      return [];
    }

    return new Promise((resolve) => {
      let resolved = false;
      let checkTimer = null;
      let timeoutTimer = null;

      const cleanup = () => {
        if (checkTimer) clearInterval(checkTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
      };

      const done = (ids) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(ids || []);
      };

      try {
        player.mute();
        player.setVolume(0);
        player.cuePlaylist({
          list: 'RDAMVM' + seedVideoId,
          listType: 'playlist',
          index: 0
        });
      } catch (e) {
        console.warn('Failed to cue playlist on background loader:', e);
        done([]);
        return;
      }

      let attempts = 0;
      checkTimer = setInterval(() => {
        attempts++;
        try {
          const pl = player.getPlaylist();
          if (Array.isArray(pl) && pl.length > 1) {
            // Check if this playlist contains our seed video ID or has updated
            if (pl[0] === seedVideoId || pl.includes(seedVideoId) || attempts >= 4) {
              console.log(`📻 Background radio loader retrieved ${pl.length} tracks for seed ${seedVideoId}`);
              done(pl);
              return;
            }
          }
        } catch (err) {}

        if (attempts >= Math.floor(timeoutMs / 200)) {
          console.warn(`Background radio loader timed out for seed ${seedVideoId}`);
          done([]);
        }
      }, 200);

      timeoutTimer = setTimeout(() => {
        done([]);
      }, timeoutMs);
    });
  } catch (e) {
    console.error('Error fetching radio video IDs:', e);
    return [];
  }
};

/**
 * Serialized fetching of radio video IDs to prevent clashing cue calls.
 */
export const fetchRadioVideoIds = (seedVideoId, timeoutMs = 4500) => {
  const nextPromise = pendingPromise.then(() => doFetchRadioVideoIds(seedVideoId, timeoutMs));
  pendingPromise = nextPromise.catch(() => {});
  return nextPromise;
};
