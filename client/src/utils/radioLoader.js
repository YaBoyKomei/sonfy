/**
 * Background YouTube Radio Loader
 * Uses an isolated, in-viewport YouTube IFrame player on the client to cue RDAMVM radio mixes
 * and extract genuine YouTube Music recommendation queues without interrupting playback.
 */

let pendingPromise = Promise.resolve();

const ensureContainerExists = () => {
  let container = document.getElementById('hidden-radio-loader');
  if (!container) {
    container = document.createElement('div');
    container.id = 'hidden-radio-loader';
    // Kept in active viewport (bottom: 0, right: 0) with 0.01 opacity so browsers don't throttle or suspend iframe execution
    container.style.position = 'fixed';
    container.style.bottom = '0px';
    container.style.right = '0px';
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
  ensureContainerExists();
};

const doFetchRadioVideoIds = async (seedVideoId, timeoutMs = 6000) => {
  if (!seedVideoId) return [];

  // Wait until window.YT is ready
  await new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    let checks = 0;
    const t = setInterval(() => {
      checks++;
      if (window.YT && window.YT.Player) {
        clearInterval(t);
        resolve();
      } else if (checks > 35) {
        clearInterval(t);
        resolve();
      }
    }, 200);
  });

  if (!window.YT || !window.YT.Player) {
    console.warn('YouTube IFrame API not available for radio loader');
    return [];
  }

  return new Promise((resolve) => {
    let resolved = false;
    let pollTimer = null;
    let timeoutTimer = null;
    let ephemeralPlayer = null;

    const cleanup = () => {
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      try {
        if (ephemeralPlayer && ephemeralPlayer.destroy) {
          ephemeralPlayer.destroy();
        }
      } catch (e) {}
      ephemeralPlayer = null;
    };

    const done = (ids) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(ids || []);
    };

    try {
      const container = ensureContainerExists();
      const divId = `radio-loader-iframe-${Date.now()}`;
      container.innerHTML = `<div id="${divId}"></div>`;

      ephemeralPlayer = new window.YT.Player(divId, {
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
            try {
              event.target.mute();
              event.target.setVolume(0);
              console.log(`📻 Background radio loader cueing RDAMVM${seedVideoId}`);
              event.target.cuePlaylist({
                list: 'RDAMVM' + seedVideoId,
                listType: 'playlist',
                index: 0
              });
            } catch (e) {
              console.warn('Failed to cue playlist in onReady:', e);
            }
          },
          onStateChange: (event) => {
            try {
              if (event.target && event.target.getPlaylist) {
                const pl = event.target.getPlaylist();
                if (Array.isArray(pl) && pl.length > 0) {
                  console.log(`📻 Radio loader onStateChange retrieved ${pl.length} tracks for ${seedVideoId}`);
                  done(pl);
                }
              }
            } catch (e) {}
          },
          onError: (err) => {
            console.warn(`Radio loader player error for ${seedVideoId}:`, err);
            done([]);
          }
        }
      });
    } catch (e) {
      console.warn('Failed to create ephemeral radio loader player:', e);
      done([]);
      return;
    }

    let attempts = 0;
    pollTimer = setInterval(() => {
      attempts++;
      try {
        if (ephemeralPlayer && ephemeralPlayer.getPlaylist) {
          const pl = ephemeralPlayer.getPlaylist();
          if (Array.isArray(pl) && pl.length > 0) {
            console.log(`📻 Radio loader poll retrieved ${pl.length} tracks for seed ${seedVideoId} (attempt ${attempts})`);
            done(pl);
            return;
          }
        }
      } catch (err) {}

      if (attempts >= Math.floor(timeoutMs / 200)) {
        console.warn(`Radio loader timed out for seed ${seedVideoId}`);
        done([]);
      }
    }, 200);

    timeoutTimer = setTimeout(() => {
      done([]);
    }, timeoutMs);
  });
};

/**
 * Serialized fetching of radio video IDs to prevent clashing player instances.
 */
export const fetchRadioVideoIds = (seedVideoId, timeoutMs = 6000) => {
  const nextPromise = pendingPromise.then(() => doFetchRadioVideoIds(seedVideoId, timeoutMs));
  pendingPromise = nextPromise.catch(() => {});
  return nextPromise;
};
