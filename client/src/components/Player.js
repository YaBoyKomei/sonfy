import React, { useEffect, useRef, useState } from 'react';
import './Player.css';
import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon, HeartIcon, ShuffleIcon, RepeatIcon, RepeatOneIcon, PlusIcon, RefreshIcon, XIcon } from './Icons';
import { getApiUrl } from '../config';

// Collapse/Expand icons
const ChevronDownIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

// Lyrics icon
const LyricsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

// Parse LRC format lyrics
const parseLrc = (lrcText) => {
  if (!lrcText || !lrcText.includes('[00:')) return null;
  const lines = lrcText.split('\n');
  const parsed = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const ms = parseInt(match[3], 10);
      const msMultiplier = match[3].length === 2 ? 10 : 1;
      const timeInSeconds = minutes * 60 + seconds + (ms * msMultiplier) / 1000;
      const text = line.replace(timeRegex, '').trim();
      parsed.push({ time: timeInSeconds, text: text || '\u00A0' });
    }
  }
  return parsed.length > 0 ? parsed : null;
};

function Player({ currentView, currentSong, activePlaylistName, isPlaying, onTogglePlay, onNext, onPrevious, shuffle, onToggleShuffle, repeat, onToggleRepeat, autoplay, onToggleAutoplay, isLiked, onToggleLike, queue, showQueue, onToggleQueue, onPlayFromQueue, onRefreshQueue, onExtendQueue, likedSongs, onToggleLikeInQueue, onAddToPlaylistFromQueue, onReorderQueue }) {
  const [player, setPlayer] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [songEnded, setSongEnded] = useState(false);
  const [titleOverflows, setTitleOverflows] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // Expanded player state
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [lyricsSource, setLyricsSource] = useState('');
  const [expandedView, setExpandedView] = useState('playing'); // 'playing' or 'lyrics'
  const titleRef = useRef(null);
  const intervalRef = useRef(null);
  const playerInitialized = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  
  const lyricsScrollerRef = useRef(null);
  const fullLyricsScrollerRef = useRef(null);

  useEffect(() => {
    const updateScroller = (scrollerRef) => {
      if (scrollerRef.current) {
        const container = scrollerRef.current.parentElement;
        const activeEl = scrollerRef.current.querySelector('.active');
        if (container && activeEl) {
          const activeTop = activeEl.offsetTop;
          const activeHeight = activeEl.clientHeight;
          const containerHeight = container.clientHeight;
          const translate = containerHeight / 2 - (activeTop + activeHeight / 2);
          scrollerRef.current.style.transform = `translateY(${translate}px)`;
        }
      }
    };
    updateScroller(lyricsScrollerRef);
    updateScroller(fullLyricsScrollerRef);
  });

  const playerRef = useRef(null);
  const manualPauseRef = useRef(false); // Track if user manually paused
  const lastActionTimeRef = useRef(0); // Track last user action
  const isPageHiddenRef = useRef(false); // Track if page is hidden
  const isLoadingNewSongRef = useRef(false); // Track if loading a new song
  const autoplayRef = useRef(autoplay);
  const repeatRef = useRef(repeat);
  const onNextRef = useRef(onNext);
  const onPreviousRef = useRef(onPrevious);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Touch drag state
  const touchStartYPos = useRef(0);
  const touchCurrentYPos = useRef(0);
  const longPressTimer = useRef(null);
  const isDraggingTouch = useRef(false);
  const draggedElement = useRef(null);
  const wakeLockRef = useRef(null);
  const audioElementRef = useRef(null);

  // Setup global SonfyControl object for native communication
  useEffect(() => {
    // Create global control object that native code can call
    window.SonfyControl = {
      play: () => {
        console.log('📱 Native: Play');
        if (playerRef.current && playerRef.current.playVideo) {
          playerRef.current.playVideo();
        }
        if (!isPlayingRef.current) {
          onTogglePlay();
        }
      },
      pause: () => {
        console.log('📱 Native: Pause');
        if (playerRef.current && playerRef.current.pauseVideo) {
          playerRef.current.pauseVideo();
        }
        if (isPlayingRef.current) {
          onTogglePlay();
        }
      },
      previous: () => {
        console.log('📱 Native: Previous');
        if (onPreviousRef.current) {
          onPreviousRef.current();
        }
      },
      next: () => {
        console.log('📱 Native: Next');
        if (onNextRef.current) {
          onNextRef.current();
        }
      },
      seekTo: (seconds) => {
        console.log('📱 Native: Seek to', seconds);
        if (playerRef.current && playerRef.current.seekTo) {
          playerRef.current.seekTo(seconds, true);
        }
      }
    };

    // Listen for custom events from native Android app
    const handleSonfyControl = (event) => {
      const { action, value } = event.detail || {};
      console.log('📱 Sonfy control event:', action, value);
      
      switch (action) {
        case 'play':
          if (playerRef.current && playerRef.current.playVideo) {
            playerRef.current.playVideo();
          }
          if (!isPlayingRef.current) {
            onTogglePlay();
          }
          break;
        case 'pause':
          if (playerRef.current && playerRef.current.pauseVideo) {
            playerRef.current.pauseVideo();
          }
          if (isPlayingRef.current) {
            onTogglePlay();
          }
          break;
        case 'previous':
          if (onPreviousRef.current) {
            onPreviousRef.current();
          }
          break;
        case 'next':
          if (onNextRef.current) {
            onNextRef.current();
          }
          break;
        case 'seekTo':
          if (playerRef.current && playerRef.current.seekTo && value !== undefined) {
            playerRef.current.seekTo(value, true);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('sonfy-control', handleSonfyControl);
    console.log('✅ SonfyControl global object and event listener registered');

    return () => {
      delete window.SonfyControl;
      window.removeEventListener('sonfy-control', handleSonfyControl);
    };
  }, [onTogglePlay]);

  // Update notification when song or playing state changes
  useEffect(() => {
    if (!currentSong) return;

    // Check if running in native Android app (SonfyNative interface available)
    if (window.SonfyNative) {
      try {
        window.SonfyNative.notify(
          currentSong.title || 'Unknown Song',
          currentSong.artist || 'Unknown Artist',
          Math.floor(duration) || 0,
          currentSong.cover || ''
        );
        console.log('📱 Updated native notification:', currentSong.title);
      } catch (e) {
        console.log('SonfyNative.notify error:', e);
      }
    }
  }, [currentSong, isPlaying, duration]);

  // Check if title overflows and needs marquee animation
  useEffect(() => {
    if (titleRef.current && currentSong) {
      const element = titleRef.current;
      const isOverflowing = element.scrollWidth > element.clientWidth;
      setTitleOverflows(isOverflowing);
    } else {
      setTitleOverflows(false);
    }
  }, [currentSong]);

  // Update progress to native side periodically
  useEffect(() => {
    // Update native progress via SonfyNative interface
    if (window.SonfyNative) {
      try {
        window.SonfyNative.notifyProgress(isPlaying, Math.floor(currentTime));
      } catch (e) {
        // Silently fail
      }
    }
  }, [isPlaying, currentTime, currentSong, queue]);

  // Minimize player when changing views (pages)
  useEffect(() => {
    setIsExpanded(false);
  }, [currentView]);

  // Initialize audio element for background playback detection
  useEffect(() => {
    // Create a silent audio element that browsers can detect for background playback
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.01; // Very low volume, almost silent

    // Use a silent audio file or data URL
    audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

    audioElementRef.current = audio;

    return () => {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
    };
  }, []);

  // Keep refs updated
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    // If playing, clear manual pause flag (unless page is hidden)
    if (isPlaying && !isPageHiddenRef.current) {
      manualPauseRef.current = false;
    }
  }, [isPlaying]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  // Infinite scroll for queue panel
  useEffect(() => {
    if (!showQueue || !onExtendQueue) return;

    const queueList = document.querySelector('.queue-list');
    if (!queueList) return;

    const handleScroll = () => {
      if (isLoadingMore) return;

      const scrollTop = queueList.scrollTop;
      const scrollHeight = queueList.scrollHeight;
      const clientHeight = queueList.clientHeight;

      // Check if user scrolled near the bottom (within 200px)
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200;

      if (isNearBottom && queue.length > 0) {
        console.log('📜 Near bottom of queue, loading more songs...');
        setIsLoadingMore(true);
        
        // Extend the queue with more songs
        onExtendQueue();
        
        // Reset loading state after a delay
        setTimeout(() => {
          setIsLoadingMore(false);
        }, 3000);
      }
    };

    queueList.addEventListener('scroll', handleScroll);
    return () => queueList.removeEventListener('scroll', handleScroll);
  }, [showQueue, queue.length, onExtendQueue, isLoadingMore]);

  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);

  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  useEffect(() => {
    onPreviousRef.current = onPrevious;
  }, [onPrevious]);

  // Handle swipe gestures for mobile (only for player and queue header)
  const handlePlayerTouchStart = (e) => {
    // Don't trigger on buttons or interactive elements
    if (e.target.closest('button') || e.target.closest('input')) {
      return;
    }

    touchStartY.current = e.touches[0].clientY;
    touchEndY.current = e.touches[0].clientY; // Initialize to same value
  };

  const handlePlayerTouchMove = (e) => {
    // Only update if we have a valid start position
    if (touchStartY.current !== 0) {
      touchEndY.current = e.touches[0].clientY;
    }
  };

  const handlePlayerTouchEnd = () => {
    // Only process if we have valid touch positions
    if (touchStartY.current === 0) {
      return;
    }

    const swipeDistance = touchStartY.current - touchEndY.current;
    const minSwipeDistance = 50; // Minimum distance for a swipe

    // Swipe up (positive distance) - only open queue if not already open
    if (swipeDistance > minSwipeDistance) {
      console.log('👆 Swipe up detected on player - opening queue');
      if (!showQueue) {
        onToggleQueue();
      }
    }

    // Reset
    touchStartY.current = 0;
    touchEndY.current = 0;
  };

  // Handle swipe down on queue header/drag handle to close
  const handleQueueHeaderTouchStart = (e) => {
    // Don't trigger on buttons
    if (e.target.closest('button')) {
      return;
    }

    touchStartY.current = e.touches[0].clientY;
    touchEndY.current = e.touches[0].clientY; // Initialize to same value
  };

  const handleQueueHeaderTouchMove = (e) => {
    // Only update if we have a valid start position
    if (touchStartY.current !== 0) {
      touchEndY.current = e.touches[0].clientY;
    }
  };

  const handleQueueHeaderTouchEnd = () => {
    // Only process if we have valid touch positions
    if (touchStartY.current === 0) {
      return;
    }

    const swipeDistance = touchStartY.current - touchEndY.current;
    const minSwipeDistance = 50; // Minimum distance for a swipe

    // Swipe down (negative distance) - close queue
    if (swipeDistance < -minSwipeDistance) {
      console.log('👇 Swipe down detected on header - closing queue');
      if (showQueue) {
        onToggleQueue();
      }
    }

    // Reset
    touchStartY.current = 0;
    touchEndY.current = 0;
  };

  // Touch drag handlers for queue reordering (only on drag handle)
  const handleDragHandleTouchStart = (e, index) => {
    e.stopPropagation(); // Prevent event bubbling

    const touch = e.touches[0];
    touchStartYPos.current = touch.clientY;
    touchCurrentYPos.current = touch.clientY;

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      console.log('🔒 Long press detected on drag handle - starting drag');
      setDraggedIndex(index);
      isDraggingTouch.current = true;

      // Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 300); // 300ms long press (shorter for better UX)
  };

  const handleDragHandleTouchMove = (e) => {
    if (!isDraggingTouch.current) {
      // Cancel long press if user moves before timer completes
      if (longPressTimer.current) {
        const touch = e.touches[0];
        const moveDistance = Math.abs(touch.clientY - touchStartYPos.current);
        if (moveDistance > 10) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    touchCurrentYPos.current = touch.clientY;

    // Find which item we're over
    const queueList = document.querySelector('.queue-list');
    if (!queueList) return;

    const items = Array.from(queueList.querySelectorAll('.queue-item'));
    let newDragOverIndex = null;

    items.forEach((item, idx) => {
      const rect = item.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        newDragOverIndex = idx;
      }
    });

    if (newDragOverIndex !== null && newDragOverIndex !== dragOverIndex) {
      setDragOverIndex(newDragOverIndex);
    }
  };

  const handleDragHandleTouchEnd = (e, index) => {
    e.stopPropagation();

    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (!isDraggingTouch.current) return;

    e.preventDefault();

    // Perform reorder if we have valid indices
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      console.log(`🔄 Touch reorder: ${draggedIndex} → ${dragOverIndex}`);
      onReorderQueue(draggedIndex, dragOverIndex);

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }

    // Reset state
    setDraggedIndex(null);
    setDragOverIndex(null);
    isDraggingTouch.current = false;
    draggedElement.current = null;
  };

  // Initialize YouTube Player
  useEffect(() => {
    if (playerInitialized.current) return;

    const initPlayer = () => {
      // Create player div if it doesn't exist
      let playerDiv = document.getElementById('youtube-player');
      if (!playerDiv) {
        playerDiv = document.createElement('div');
        playerDiv.id = 'youtube-player';
        playerDiv.style.cssText = 'position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0.01; pointer-events: none; z-index: -9999;';
        document.body.appendChild(playerDiv);
        console.log('✅ Created youtube-player div');
      }

      try {
        new window.YT.Player('youtube-player', {
          height: '1',
          width: '1',
          videoId: '',
          playerVars: {
            autoplay: 0,
            controls: 0,
            playsinline: 1,
            enablejsapi: 1,
            vq: 'highres' // Request highest quality for best audio
          },
          events: {
            onReady: (event) => {
              console.log('✅ YouTube Player is ready');
              setPlayer(event.target);
              playerInitialized.current = true;

              // Set quality preference for better audio - request highest available
              try {
                event.target.setPlaybackQualityRange('highres', 'highres');
                console.log('🎵 Set quality range to highres for best audio');
              } catch (error) {
                console.log('Could not set quality range:', error);
              }
            },
            onStateChange: (event) => {
              console.log('Player state changed:', event.data, 'Page hidden:', isPageHiddenRef.current, 'Loading:', isLoadingNewSongRef.current);
              // -1: unstarted, 0: ended, 1: playing, 2: paused, 3: buffering, 5: cued

              // Skip sync only if loading a new song
              if (isLoadingNewSongRef.current) {
                console.log('🔄 Loading new song, skipping state sync');
                return;
              }

              // If player is paused (2) and we think it should be playing
              if (event.data === 2 && isPlayingRef.current) {
                console.log('⚠️ Player paused - syncing UI state');
                manualPauseRef.current = true;
                lastActionTimeRef.current = Date.now();
                // Update ref immediately to prevent race conditions
                isPlayingRef.current = false;
                // Call toggle to update React state
                setTimeout(() => onTogglePlay(), 0);
              }

              // If player is playing (1) and we think it should be paused
              if (event.data === 1 && !isPlayingRef.current) {
                console.log('⚠️ Player playing - syncing UI state');
                manualPauseRef.current = false;
                lastActionTimeRef.current = Date.now();
                // Update ref immediately to prevent race conditions
                isPlayingRef.current = true;
                // Call toggle to update React state
                setTimeout(() => onTogglePlay(), 0);
              }

              if (event.data === 0) { // ended
                console.log('🎵 Song ended - Repeat:', repeatRef.current, 'Autoplay:', autoplayRef.current);
                if (repeatRef.current === 'one') {
                  // Replay the same song
                  event.target.seekTo(0);
                  event.target.playVideo();
                  setSongEnded(false);
                } else if (autoplayRef.current || repeatRef.current === 'all') {
                  // Auto-play next song if autoplay is on or repeat all is on
                  console.log('▶️ Auto-playing next song');
                  setSongEnded(false);
                  onNextRef.current();
                } else {
                  // Stop playing and show refresh button
                  console.log('⏹️ Autoplay is off - stopping playback');
                  if (isPlayingRef.current) {
                    onTogglePlay(); // This will set isPlaying to false
                  }
                  // Set songEnded after a small delay to ensure state updates
                  setTimeout(() => {
                    setSongEnded(true);
                  }, 100);
                }
              }
            },
            onError: (event) => {
              console.error('YouTube Player Error:', event.data);
            }
          },
        });
      } catch (error) {
        console.error('Error creating player:', error);
      }
    };

    // Load YouTube API if not loaded
    if (!window.YT) {
      console.log('Loading YouTube API...');
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube API loaded');
        initPlayer();
      };
    } else if (window.YT.Player) {
      console.log('YouTube API already loaded');
      initPlayer();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      // Don't destroy the player on unmount to avoid DOM errors
      // The player will be reused across component lifecycles
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - player only initializes once, callbacks use refs

  // Setup Media Session API handlers (always, even without a song)
  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      console.warn('⚠️ Media Session API not supported');
      return;
    }

    console.log('🎵 Setting up Media Session handlers');

    // Always set up action handlers so buttons aren't grayed out
    navigator.mediaSession.setActionHandler('play', () => {
      console.log('📱 Media Session: Play');
      manualPauseRef.current = false;
      lastActionTimeRef.current = Date.now();
      if (playerRef.current && playerRef.current.playVideo) {
        playerRef.current.playVideo();
      }
      if (!isPlayingRef.current) {
        onTogglePlay();
      }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      console.log('📱 Media Session: Pause');
      manualPauseRef.current = true;
      lastActionTimeRef.current = Date.now();
      if (playerRef.current && playerRef.current.pauseVideo) {
        playerRef.current.pauseVideo();
      }
      if (isPlayingRef.current) {
        onTogglePlay();
      }
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      console.log('🔥🔥🔥 PREVIOUS BUTTON CLICKED! 🔥🔥🔥');
      console.log('onPreviousRef:', onPreviousRef.current);
      lastActionTimeRef.current = Date.now();
      manualPauseRef.current = false;
      try {
        if (typeof onPreviousRef.current === 'function') {
          console.log('Calling onPrevious...');
          onPreviousRef.current();
          console.log('✅ Previous track executed');
        } else {
          console.error('❌ onPreviousRef.current is NOT a function!', typeof onPreviousRef.current);
        }
      } catch (error) {
        console.error('❌ Error calling onPrevious:', error);
      }
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      console.log('🔥🔥🔥 NEXT BUTTON CLICKED! 🔥🔥🔥');
      console.log('onNextRef:', onNextRef.current);
      lastActionTimeRef.current = Date.now();
      manualPauseRef.current = false;
      try {
        if (typeof onNextRef.current === 'function') {
          console.log('Calling onNext...');
          onNextRef.current();
          console.log('✅ Next track executed');
        } else {
          console.error('❌ onNextRef.current is NOT a function!', typeof onNextRef.current);
        }
      } catch (error) {
        console.error('❌ Error calling onNext:', error);
      }
    });

    navigator.mediaSession.setActionHandler('seekbackward', () => {
      if (playerRef.current && playerRef.current.seekTo && playerRef.current.getCurrentTime) {
        const current = playerRef.current.getCurrentTime();
        playerRef.current.seekTo(Math.max(0, current - 10), true);
      }
    });

    navigator.mediaSession.setActionHandler('seekforward', () => {
      if (playerRef.current && playerRef.current.seekTo && playerRef.current.getCurrentTime && playerRef.current.getDuration) {
        const current = playerRef.current.getCurrentTime();
        const total = playerRef.current.getDuration();
        playerRef.current.seekTo(Math.min(total, current + 10), true);
      }
    });

    console.log('✅ Media Session handlers registered');
  }, [onTogglePlay]); // Only depend on onTogglePlay, handlers use refs

  // Update Media Session metadata when song changes
  useEffect(() => {
    if (!currentSong || !('mediaSession' in navigator)) return;

    console.log('🎵 Updating Media Session metadata for:', currentSong.title);

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: 'Sonfy Music',
        artwork: [
          { src: currentSong.cover, sizes: '96x96', type: 'image/jpeg' },
          { src: currentSong.cover, sizes: '128x128', type: 'image/jpeg' },
          { src: currentSong.cover, sizes: '192x192', type: 'image/jpeg' },
          { src: currentSong.cover, sizes: '256x256', type: 'image/jpeg' },
          { src: currentSong.cover, sizes: '384x384', type: 'image/jpeg' },
          { src: currentSong.cover, sizes: '512x512', type: 'image/jpeg' },
        ]
      });

      // Force notification to persist
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch (error) {
      console.error('Error setting Media Session metadata:', error);
    }
    // Set position state to enable previous/next buttons
    try {
      if (duration > 0) {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1,
          position: 0
        });
      }
    } catch (error) {
      console.log('Could not set position state:', error);
    }

    console.log('📱 Media Session API initialized with handlers');
  }, [currentSong, onTogglePlay, duration, isPlaying]);

  // Update Media Session playback state
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  // Update Media Session position
  useEffect(() => {
    if ('mediaSession' in navigator && duration > 0) {
      try {
        // Ensure position is not greater than duration
        const safePosition = Math.min(currentTime, duration);
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: 1,
          position: safePosition
        });
      } catch (error) {
        console.log('Could not update position state:', error.message);
      }
    }
  }, [currentTime, duration]);

  // Load song when currentSong changes
  useEffect(() => {
    if (!player || !currentSong || !currentSong.youtubeId) return;

    console.log('🎵 Loading song:', currentSong.title, currentSong.youtubeId, 'Should play:', isPlayingRef.current);

    try {
      // Mark that we're loading a new song
      isLoadingNewSongRef.current = true;

      // Reset position state for new song
      setCurrentTime(0);
      setDuration(0);

      // Reset Media Session position
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.setPositionState({
            duration: 0.1,
            playbackRate: 1,
            position: 0
          });
        } catch (e) {
          console.log('Could not reset position state');
        }
      }

      // Load the video with YouTube player
      player.loadVideoById(currentSong.youtubeId);

      // Set quality to highest available for best audio after video loads
      setTimeout(() => {
        try {
          const availableQualities = player.getAvailableQualityLevels();
          console.log('📺 Available qualities:', availableQualities);

          // Try to set the highest quality available for best audio bitrate
          // Quality order: highres > hd2160 > hd1440 > hd1080 > hd720 > large > medium > small
          const qualityPriority = ['highres', 'hd2160', 'hd1440', 'hd1080', 'hd720', 'large'];
          for (const quality of qualityPriority) {
            if (availableQualities.includes(quality)) {
              player.setPlaybackQuality(quality);
              console.log(`🎵 Set quality to ${quality} for best audio`);
              break;
            }
          }
        } catch (error) {
          console.log('Could not set quality:', error);
        }
      }, 1000);

      // Reset songEnded when loading new song
      setSongEnded(false);

      // Explicitly play if should be playing
      if (isPlayingRef.current) {
        setTimeout(() => {
          if (player.playVideo) {
            player.playVideo();
            console.log('▶️ Auto-playing new song');
          }
          // Clear the loading flag after a delay
          setTimeout(() => {
            isLoadingNewSongRef.current = false;
          }, 500);
        }, 100);
      } else {
        // Clear the loading flag immediately if not auto-playing
        setTimeout(() => {
          isLoadingNewSongRef.current = false;
        }, 500);
      }
    } catch (error) {
      console.error('Error loading video:', error);
      isLoadingNewSongRef.current = false;
    }
  }, [currentSong, player]);

  // Handle play/pause
  useEffect(() => {
    if (!player) return;

    try {
      const playerState = player.getPlayerState ? player.getPlayerState() : -1;
      console.log('🎮 Play/Pause Effect - Player state:', playerState, 'isPlaying:', isPlaying, 'Manual pause:', manualPauseRef.current);

      if (isPlaying) {
        manualPauseRef.current = false; // Clear manual pause when playing
        setSongEnded(false); // Reset songEnded when user plays
        player.playVideo();
        console.log('▶️ Playing video');

        // Play silent audio to keep media session active
        if (audioElementRef.current) {
          audioElementRef.current.play().catch(err => {
            console.log('Silent audio play failed:', err);
          });
        }

        // Request wake lock to prevent screen from sleeping during playback
        if ('wakeLock' in navigator) {
          navigator.wakeLock.request('screen').then(wakeLock => {
            wakeLockRef.current = wakeLock;
            console.log('🔒 Wake lock acquired');
          }).catch(err => {
            console.log('Wake lock failed:', err);
          });
        }
      } else {
        manualPauseRef.current = true; // Set manual pause when pausing
        player.pauseVideo();
        console.log('⏸️ Pausing video');

        // Pause silent audio
        if (audioElementRef.current) {
          audioElementRef.current.pause();
        }

        // Release wake lock when paused
        if (wakeLockRef.current) {
          wakeLockRef.current.release();
          wakeLockRef.current = null;
          console.log('🔓 Wake lock released');
        }
      }
    } catch (error) {
      console.error('Error controlling playback:', error);
    }
  }, [isPlaying, player]);

  // Keep playing when page visibility changes (background playback)
  useEffect(() => {
    if (!player) return;

    let resumeTimeout;
    let keepAliveInterval;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isPageHiddenRef.current = true;
        console.log('📱 Page hidden - current playing state:', isPlayingRef.current, 'manual pause:', manualPauseRef.current);

        // Keep playing in background
        if (isPlayingRef.current && !manualPauseRef.current) {
          try {
            // Force the player to stay playing
            const iframe = document.getElementById('youtube-player');
            if (iframe) {
              iframe.style.display = 'block';
              iframe.style.position = 'fixed';
              iframe.style.top = '0';
              iframe.style.left = '0';
              iframe.style.width = '1px';
              iframe.style.height = '1px';
              iframe.style.opacity = '0.01';
              iframe.style.pointerEvents = 'none';
              iframe.style.zIndex = '-9999';
            }

            // Ensure Media Session stays active
            if ('mediaSession' in navigator) {
              navigator.mediaSession.playbackState = 'playing';
            }

            // Keep silent audio playing for background detection
            if (audioElementRef.current && audioElementRef.current.paused) {
              audioElementRef.current.play().catch(err => {
                console.log('Background audio play failed:', err);
              });
            }

            // Keep audio context active for background playback
            try {
              const audioContext = new (window.AudioContext || window.webkitAudioContext)();
              if (audioContext.state === 'suspended') {
                audioContext.resume();
              }
            } catch (e) {
              console.log('AudioContext not available');
            }

          } catch (error) {
            console.error('Error maintaining playback:', error);
          }
        }
      } else {
        isPageHiddenRef.current = false;
        console.log('📱 Page visible - current playing state:', isPlayingRef.current, 'manual pause:', manualPauseRef.current);

        // Clear keep-alive interval
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }

        // Restore iframe settings
        const iframe = document.getElementById('youtube-player');
        if (iframe) {
          iframe.style.opacity = '0.01';
        }

        // Sync state when page becomes visible again
        if (isPlayingRef.current && !manualPauseRef.current) {
          resumeTimeout = setTimeout(() => {
            try {
              if (isPlayingRef.current && !manualPauseRef.current) {
                const state = player.getPlayerState();
                if (state !== 1) {
                  player.playVideo();
                  console.log('🔄 Resumed playback on visibility');
                }
              }
            } catch (error) {
              console.error('Error resuming playback:', error);
            }
          }, 100);
        }
      }
    };

    // Also handle focus/blur events
    const handleFocus = () => {
      console.log('📱 Window focused - current playing state:', isPlayingRef.current, 'manual pause:', manualPauseRef.current);

      // Don't auto-resume if user manually paused
      if (manualPauseRef.current) {
        console.log('⏸️ Manual pause active, not resuming');
        return;
      }

      if (isPlayingRef.current) {
        setTimeout(() => {
          try {
            // Double check manual pause again
            if (isPlayingRef.current && !manualPauseRef.current) {
              const state = player.getPlayerState();
              if (state !== 1) {
                player.playVideo();
                console.log('🔄 Resumed on focus');
              }
            }
          } catch (error) {
            console.error('Error on focus:', error);
          }
        }, 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (resumeTimeout) clearTimeout(resumeTimeout);
      if (keepAliveInterval) clearInterval(keepAliveInterval);
    };
  }, [player]);

  // Update progress and maintain playback
  useEffect(() => {
    // Clear any existing interval first
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!player || !isPlaying) {
      return;
    }

    const updateTime = () => {
      try {
        if (player.getCurrentTime && player.getDuration) {
          const current = player.getCurrentTime();
          const total = player.getDuration();

          if (current !== undefined && total !== undefined && !isNaN(current) && !isNaN(total)) {
            setCurrentTime(current);
            setDuration(total);
          }
        }
      } catch (error) {
        // Silently fail - player might not be ready yet
      }
    };

    // Update immediately
    updateTime();

    // Then update every 200ms
    intervalRef.current = setInterval(updateTime, 200);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [player, isPlaying, currentSong]);

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e) => {
    if (!player || !duration) return;

    const newTime = (parseFloat(e.target.value) / 100) * duration;

    try {
      player.seekTo(newTime, true);
      setCurrentTime(newTime);
    } catch (error) {
      console.error('Error seeking:', error);
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Fetch lyrics for current song
  const fetchLyrics = async () => {
    if (!currentSong) return;
    
    setLyricsLoading(true);
    setLyrics(null);
    setLyricsSource('');
    
    try {
      // First try to get synced lyrics from LRCLIB
      const title = encodeURIComponent(currentSong.title);
      const artist = encodeURIComponent(currentSong.artist);
      const lrcRes = await fetch(`https://lrclib.net/api/search?track_name=${title}&artist_name=${artist}`);
      if (lrcRes.ok) {
         const lrcData = await lrcRes.json();
         if (lrcData && lrcData.length > 0) {
           const bestMatch = lrcData.find(t => t.syncedLyrics) || lrcData.find(t => t.plainLyrics);
           if (bestMatch) {
             setLyrics(bestMatch.syncedLyrics || bestMatch.plainLyrics);
             setLyricsSource(bestMatch.syncedLyrics ? 'LRCLIB (Synced)' : 'LRCLIB');
             setLyricsLoading(false);
             return;
           }
         }
      }
    } catch (e) {
       console.log('Error fetching from LRCLIB:', e);
    }
    
    if (!currentSong.youtubeId) {
      setLyricsLoading(false);
      return;
    }

    try {
      const response = await fetch(getApiUrl(`/api/lyrics/${currentSong.youtubeId}`));
      const data = await response.json();
      
      if (data.lyrics) {
        setLyrics(data.lyrics);
        setLyricsSource(data.source || '');
        console.log('🎤 Lyrics loaded');
      } else {
        setLyrics(null);
        console.log('🎤 No lyrics available');
      }
    } catch (error) {
      console.error('Error fetching lyrics:', error);
      setLyrics(null);
    } finally {
      setLyricsLoading(false);
    }
  };

  // Toggle expanded view between 'playing' and 'lyrics'
  const toggleExpandedView = (view) => {
    if (view === 'lyrics' && !lyrics && !lyricsLoading) {
      fetchLyrics();
    }
    setExpandedView(view);
  };

  // Reset lyrics when song changes
  useEffect(() => {
    setLyrics(null);
    setLyricsSource('');
    setShowLyrics(false);
    setExpandedView('playing');

    // Auto-fetch lyrics for the preview card
    if (currentSong && currentSong.youtubeId) {
      // Small delay to prevent rapid fetching when skipping songs quickly
      const timer = setTimeout(() => {
        fetchLyrics();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentSong?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle expanded player
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    // Close queue when expanding
    if (!isExpanded && showQueue) {
      onToggleQueue();
    }
  };

  // Handle swipe down to collapse expanded player
  const handleExpandedTouchStart = (e) => {
    // Don't trigger swipe-to-close if touching buttons, inputs, lyrics content, or queue panel
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.expanded-lyrics-content') || e.target.closest('.queue-panel')) return;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleExpandedTouchMove = (e) => {
    if (touchStartY.current !== 0) {
      touchEndY.current = e.touches[0].clientY;
    }
  };

  const handleExpandedTouchEnd = () => {
    if (touchStartY.current === 0) return;
    const swipeDistance = touchEndY.current - touchStartY.current;
    if (swipeDistance > 80) {
      setIsExpanded(false);
    }
    touchStartY.current = 0;
    touchEndY.current = 0;
  };

  const renderQueuePanel = () => {
    return (
      <>
      {showQueue && currentSong && (
        <div className="queue-panel">
          {/* Drag handle for mobile */}
          <div
            className="queue-drag-handle"
            onTouchStart={handleQueueHeaderTouchStart}
            onTouchMove={handleQueueHeaderTouchMove}
            onTouchEnd={handleQueueHeaderTouchEnd}
          >
            <div className="drag-indicator"></div>
          </div>
          <div
            className="queue-header"
            onTouchStart={handleQueueHeaderTouchStart}
            onTouchMove={handleQueueHeaderTouchMove}
            onTouchEnd={handleQueueHeaderTouchEnd}
          >
            <h3>Up Next</h3>
            <div className="queue-header-actions">
              <button
                className="queue-refresh-btn"
                onClick={onRefreshQueue}
                title="Refresh Queue"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                </svg>
              </button>
              <button className="queue-close-btn" onClick={onToggleQueue}>✕</button>
            </div>
          </div>
          <div className="queue-list">
            {/* Queue Songs */}
            {queue.length > 0 ? (
              queue.map((song, index) => {
                const isCurrentSong = currentSong && (song.id === currentSong.id || (song.youtubeId && song.youtubeId === currentSong.youtubeId));
                const isDragging = draggedIndex === index;
                const isDragOver = dragOverIndex === index;

                return (
                  <div
                    key={`${song.id}-${index}`}
                    className={`queue-item ${isCurrentSong ? 'current-queue-item' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                    draggable={!isCurrentSong}
                    onDragStart={(e) => {
                      if (!isCurrentSong) {
                        setDraggedIndex(index);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/html', e.currentTarget);
                      }
                    }}
                    onDragOver={(e) => {
                      if (!isCurrentSong && draggedIndex !== null) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverIndex(index);
                      }
                    }}
                    onDragLeave={() => {
                      setDragOverIndex(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedIndex !== null && draggedIndex !== index && !isCurrentSong) {
                        onReorderQueue(draggedIndex, index);
                      }
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }}
                    onDragEnd={() => {
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                    }}
                  >
                    {!isCurrentSong && (
                      <div
                        className="drag-handle"
                        title="Hold to reorder"
                        onTouchStart={(e) => handleDragHandleTouchStart(e, index)}
                        onTouchMove={(e) => handleDragHandleTouchMove(e)}
                        onTouchEnd={(e) => handleDragHandleTouchEnd(e, index)}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 3h2v2H9V3zm0 4h2v2H9V7zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm0 4h2v2H9v-2zm4-16h2v2h-2V3zm0 4h2v2h-2V7zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2zm0 4h2v2h-2v-2z" />
                        </svg>
                      </div>
                    )}
                    <img
                      src={song.cover}
                      alt={song.title}
                      onClick={() => {
                        if (!isCurrentSong) {
                          onPlayFromQueue(song);
                          onToggleQueue();
                        }
                      }}
                      style={{ cursor: isCurrentSong ? 'default' : 'pointer' }}
                    />
                    <div
                      className="queue-item-info"
                      onClick={() => {
                        if (!isCurrentSong) {
                          onPlayFromQueue(song);
                          onToggleQueue();
                        }
                      }}
                      style={{ cursor: isCurrentSong ? 'default' : 'pointer' }}
                    >
                      <div className="queue-item-title">{song.title}</div>
                      <div className="queue-item-artist">{song.artist}</div>
                    </div>
                    <div className="queue-item-actions">
                      <button
                        className={`queue-action-btn ${likedSongs?.find(s => s.id === song.id) ? 'liked' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLikeInQueue(song);
                        }}
                        title={likedSongs?.find(s => s.id === song.id) ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
                      >
                        <HeartIcon filled={!!likedSongs?.find(s => s.id === song.id)} />
                      </button>
                      <button
                        className="queue-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToPlaylistFromQueue(song);
                        }}
                        title="Add to Playlist"
                      >
                        <PlusIcon />
                      </button>
                      {isCurrentSong ? (
                        <span className="now-playing-badge">Now Playing</span>
                      ) : (
                        <span className="queue-item-number">{index + 1}</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="queue-empty">
                <p>No songs in queue</p>
              </div>
            )}
            {/* Loading indicator for infinite scroll */}
            {isLoadingMore && (
              <div className="queue-loading">
                <div className="queue-loading-spinner"></div>
                <span>Loading more songs...</span>
              </div>
            )}
          </div>
        </div>
      )}
      </>
    );
  };

  // Expanded Full-Screen Player View
  if (isExpanded && currentSong) {
    return (
      <div 
        className="player-expanded"
        onTouchStart={handleExpandedTouchStart}
        onTouchMove={handleExpandedTouchMove}
        onTouchEnd={handleExpandedTouchEnd}
      >
        {/* Header with collapse button and toggle */}
        <div className="expanded-header">
          <button className="collapse-btn" onClick={() => {
            if (expandedView === 'lyrics') {
              setExpandedView('playing');
            } else {
              toggleExpanded();
            }
          }}>
            <ChevronDownIcon />
          </button>
          
          <div className="expanded-header-info">
            <span className="header-subtitle">
              {activePlaylistName ? "PLAYING FROM PLAYLIST" : "PLAYING NOW"}
            </span>
            {activePlaylistName && (
              <span className="header-title">{activePlaylistName}</span>
            )}
          </div>

          <div className="expanded-header-actions">
          </div>
        </div>

        {/* Now Playing View */}
        {expandedView === 'playing' && (
          <>
            {/* Album Art */}
            <div className="expanded-artwork">
              <img src={currentSong.cover} alt={currentSong.title} />
            </div>

            {/* Song Info */}
            <div className="expanded-song-info">
              <div className="expanded-song-title-wrapper">
                <div className={`expanded-song-title ${titleOverflows ? 'marquee' : ''}`}>
                  <span className="expanded-song-title-text" data-text={currentSong.title}>
                    {currentSong.title}
                  </span>
                </div>
              </div>
              <div className="expanded-song-artist">
                {currentSong.artist}
              </div>
            </div>

            {/* Lyrics Preview Card */}
            <div 
              className="expanded-lyrics-preview"
              onClick={() => toggleExpandedView('lyrics')}
              style={{ cursor: 'pointer' }}
              title="Click to view full lyrics"
            >
              {lyricsLoading ? (
                <div className="lyrics-scroller-container"><p className="lyric-line loading">Loading lyrics...</p></div>
              ) : lyrics ? (
                (() => {
                  const parsedLyrics = parseLrc(lyrics);
                  if (parsedLyrics) {
                    let activeIndex = 0;
                    for (let i = 0; i < parsedLyrics.length; i++) {
                      if (currentTime >= parsedLyrics[i].time) {
                        activeIndex = i;
                      } else {
                        break;
                      }
                    }
                    
                    return (
                      <div className="lyrics-scroller-container">
                        <div 
                          className="lyrics-scroller"
                          ref={lyricsScrollerRef}
                          style={{ top: 0, transition: 'transform 0.4s ease-out' }}
                        >
                          {parsedLyrics.map((line, index) => {
                            const distance = Math.abs(index - activeIndex);
                            let className = "lyric-line";
                            if (index === activeIndex) className += " active";
                            else if (distance === 1) className += " adjacent";
                            else className += " distant";
                            return <p key={index} className={className}>{line.text}</p>;
                          })}
                        </div>
                      </div>
                    );
                  } else {
                    const lines = lyrics.split('\n');
                    const activeIndex = Math.min(lines.length - 1, Math.max(0, Math.floor((progress / 100) * lines.length)));
                    return (
                      <div className="lyrics-scroller-container">
                        <div 
                          className="lyrics-scroller"
                          ref={lyricsScrollerRef}
                          style={{ top: 0, transition: 'transform 0.4s ease-out' }}
                        >
                          {lines.map((line, index) => {
                            const distance = Math.abs(index - activeIndex);
                            let className = "lyric-line";
                            if (index === activeIndex) className += " active";
                            else if (distance === 1) className += " adjacent";
                            else className += " distant";
                            return <p key={index} className={className}>{line || '\u00A0'}</p>;
                          })}
                        </div>
                      </div>
                    );
                  }
                })()
              ) : (
                <div className="lyrics-scroller-container"><p className="lyric-line">Now Playing</p></div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="expanded-progress">
              <div className="expanded-progress-bar">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={progress}
                  onChange={handleSeek}
                  className="expanded-progress-input"
                />
                <div className="expanded-progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="expanded-time">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="expanded-controls">
              <button
                onClick={onToggleShuffle}
                className={`expanded-control-btn ${shuffle ? 'active' : ''}`}
              >
                <ShuffleIcon />
              </button>
              <button onClick={onPrevious} className="expanded-control-btn prev-next">
                <SkipBackIcon />
              </button>
              <button
                className="expanded-play-button"
                onClick={() => {
                  if (songEnded && player) {
                    player.seekTo(0);
                    setSongEnded(false);
                    onTogglePlay();
                  } else {
                    onTogglePlay();
                  }
                }}
              >
                {isPlaying ? <PauseIcon /> : songEnded ? <RefreshIcon /> : <PlayIcon />}
              </button>
              <button onClick={onNext} className="expanded-control-btn prev-next">
                <SkipForwardIcon />
              </button>
              <button
                onClick={onToggleRepeat}
                className={`expanded-control-btn ${repeat !== 'off' ? 'active' : ''}`}
              >
                {repeat === 'one' ? <RepeatOneIcon /> : <RepeatIcon />}
              </button>
            </div>

            {/* Bottom Actions */}
            <div className="expanded-actions-pills">
              <button
                className="pill-action-btn"
                onClick={() => onAddToPlaylistFromQueue(currentSong)}
              >
                <PlusIcon />
                <span>Add to</span>
              </button>
              <button
                className={`pill-action-btn ${showQueue ? 'active' : ''}`}
                onClick={onToggleQueue}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
                <span>Queue</span>
              </button>
            </div>
          </>
        )}

        {/* Lyrics View */}
        {expandedView === 'lyrics' && (
          <div className="expanded-lyrics-view">
            {/* Mini song info */}
            <div className="lyrics-mini-info">
              <img src={currentSong.cover} alt={currentSong.title} className="lyrics-mini-cover" />
              <div className="lyrics-mini-details">
                <div className="lyrics-mini-title">{currentSong.title}</div>
                <div className="lyrics-mini-artist">{currentSong.artist}</div>
              </div>
              <button className="header-action-btn" onClick={() => setExpandedView('playing')} style={{ marginLeft: 'auto' }}>
                <XIcon />
              </button>
            </div>

            {/* Lyrics content */}
            <div className="expanded-lyrics-content">
              {lyricsLoading ? (
                <div className="lyrics-loading">
                  <div className="spinner"></div>
                  <p>Loading lyrics...</p>
                </div>
              ) : lyrics ? (
                (() => {
                  const parsedLyrics = parseLrc(lyrics);
                  if (parsedLyrics) {
                    let activeIndex = 0;
                    for (let i = 0; i < parsedLyrics.length; i++) {
                      if (currentTime >= parsedLyrics[i].time) {
                        activeIndex = i;
                      } else {
                        break;
                      }
                    }
                    
                    return (
                      <div className="synced-lyrics-full-wrapper" style={{ height: '60vh', position: 'relative', overflow: 'hidden', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)', maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)' }}>
                        <div ref={fullLyricsScrollerRef} style={{ position: 'absolute', top: 0, width: '100%', transition: 'transform 0.4s ease-out' }}>
                          {parsedLyrics.map((line, index) => (
                            <p key={index} className={index === activeIndex ? "full-lyric-line active" : "full-lyric-line"} style={{ 
                                fontSize: index === activeIndex ? '1.5rem' : '1.1rem',
                                color: index === activeIndex ? '#fff' : 'rgba(255,255,255,0.4)',
                                fontWeight: index === activeIndex ? 'bold' : 'normal',
                                transition: 'all 0.4s ease-out',
                                margin: '0 0 15px 0',
                                textAlign: 'center',
                                textShadow: index === activeIndex ? '0 0 10px rgba(183,109,255,0.5)' : 'none'
                            }}>{line.text}</p>
                          ))}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <>
                        <pre className="lyrics-text">{lyrics}</pre>
                        {lyricsSource && (
                          <p className="lyrics-source">{lyricsSource}</p>
                        )}
                      </>
                    );
                  }
                })()
              ) : (
                <div className="lyrics-not-found">
                  <LyricsIcon />
                  <p>No lyrics available for this song</p>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="expanded-progress" style={{ marginBottom: '15px' }}>
              <div className="expanded-progress-bar">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={progress}
                  onChange={handleSeek}
                  className="expanded-progress-input"
                />
                <div className="expanded-progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="expanded-time">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Mini controls */}
            <div className="lyrics-mini-controls">
              <button onClick={onPrevious} className="lyrics-control-btn">
                <SkipBackIcon />
              </button>
              <button
                className="lyrics-play-btn"
                onClick={() => {
                  if (songEnded && player) {
                    player.seekTo(0);
                    setSongEnded(false);
                    onTogglePlay();
                  } else {
                    onTogglePlay();
                  }
                }}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button onClick={onNext} className="lyrics-control-btn">
                <SkipForwardIcon />
              </button>
            </div>
          </div>
        )}

        {/* Lyrics Panel (old overlay - keeping for backward compatibility) */}
        {showLyrics && (
          <div className="lyrics-panel">
            <div className="lyrics-header">
              <h3>Lyrics</h3>
              <button className="lyrics-close" onClick={() => setShowLyrics(false)}>×</button>
            </div>
            <div className="lyrics-content">
              {lyricsLoading ? (
                <div className="lyrics-loading">
                  <div className="spinner"></div>
                  <p>Loading lyrics...</p>
                </div>
              ) : lyrics ? (
                <>
                  <pre className="lyrics-text">{lyrics}</pre>
                  {lyricsSource && (
                    <p className="lyrics-source">{lyricsSource}</p>
                  )}
                </>
              ) : (
                <div className="lyrics-not-found">
                  <p>No lyrics available for this song</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Signature */}
        <div className="expanded-signature">
          <span>YaBoy Komei</span>
        </div>
        {renderQueuePanel()}
      </div>
    );
  }

  // Collapsed Mini Player View
  return (
    <div
      className="player"
      onTouchStart={handlePlayerTouchStart}
      onTouchMove={handlePlayerTouchMove}
      onTouchEnd={handlePlayerTouchEnd}
    >
      {currentSong ? (
        <>
          {/* Progress bar at the top */}
          <div className="progress-bar-top" onClick={(e) => e.stopPropagation()}>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progress}
              onChange={handleSeek}
              className="progress-input"
            />
            <div className="progress-fill-top" style={{ width: `${progress}%` }}></div>
          </div>

          <div className="player-content" onClick={toggleExpanded}>
            {/* Album art */}
            <img 
              src={currentSong.cover} 
              alt={currentSong.title} 
              className="mini-player-art"
            />
            
            {/* Song info with marquee */}
            <div className="mini-player-info">
              <div 
                ref={titleRef}
                className={`mini-player-title ${titleOverflows ? 'marquee' : ''}`}
              >
                <span 
                  className="mini-player-title-text"
                  data-text={currentSong.title}
                >
                  {currentSong.title}
                </span>
              </div>
              <div className="mini-player-artist">{currentSong.artist}</div>
            </div>

            {/* Play button only */}
            <button
              className="mini-play-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (songEnded && player) {
                  player.seekTo(0);
                  setSongEnded(false);
                  onTogglePlay();
                } else {
                  onTogglePlay();
                }
              }}
            >
              {isPlaying ? <PauseIcon /> : songEnded ? <RefreshIcon /> : <PlayIcon />}
            </button>
          </div>
        </>
      ) : (
        <div className="mini-player-info">
          <div className="mini-player-title">Select a song to play</div>
        </div>
      )}

      {/* Queue Panel */}
      {renderQueuePanel()}
    </div>
  );
}

export default Player;
