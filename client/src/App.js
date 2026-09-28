import React, { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Player from './components/Player';
// Auth components removed
import { getApiUrl } from './config';
// import AudioPlayer from './components/AudioPlayer';
import SongCard from './components/SongCard';
import { SearchIcon, MusicIcon, HeartIcon, PlusIcon } from './components/Icons';
import { ChevronLeftIcon, ChevronRightIcon } from './components/ScrollButton';
import { updateSEOForView, addSongStructuredData, preloadCriticalResources } from './utils/seo';

// API Helper Functions (using server)
const fetchNextSongs = async (videoId) => {
  try {
    console.log(`⏭️ Fetching next songs for: ${videoId}`);
    const response = await fetch(getApiUrl(`/api/next/${videoId}`));
    if (!response.ok) {
      console.warn(`Next API error: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('❌ Error fetching next songs:', error);
    return [];
  }
};

const fetchSection = async (browseId) => {
  console.log(`📁 Fetching section: ${browseId}`);
  const response = await fetch(getApiUrl(`/api/browse/${browseId}`));
  if (!response.ok) throw new Error(`Browse API error: ${response.status}`);
  return response.json();
};

const searchSongs = async (query) => {
  console.log(`🔍 Searching: ${query}`);
  const response = await fetch(getApiUrl(`/api/search?q=${encodeURIComponent(query)}`));
  if (!response.ok) throw new Error(`Search API error: ${response.status}`);
  return response.json();
};

function App() {
  console.log('🎵 Komei App starting...');
  // Removed useAuth
  const [songs, setSongs] = useState([]);
  const [sections, setSections] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentView, setCurrentView] = useState('home');
  const [likedSongs, setLikedSongs] = useState(() => {
    const saved = localStorage.getItem('likedSongs');
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(false);
  const [scrollStates, setScrollStates] = useState({});
  const [expandedSection, setExpandedSection] = useState(null);
  const [expandedSongs, setExpandedSongs] = useState([]);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('off'); // 'off', 'all', 'one'
  const [autoplay, setAutoplay] = useState(true); // Auto-play next song
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ songs: [], albums: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null); // For viewing album tracks
  const [albumTracks, setAlbumTracks] = useState([]);
  const [loadingAlbum, setLoadingAlbum] = useState(false);
  const [queue, setQueue] = useState([]); // Queue of next songs
  const [queueIndex, setQueueIndex] = useState(0); // Current position in queue
  const [playHistory, setPlayHistory] = useState(() => {
    const saved = localStorage.getItem('playHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [historyIndex, setHistoryIndex] = useState(-1); // Current position in history
  const [showQueue, setShowQueue] = useState(false); // Show queue panel
  const [playlists, setPlaylists] = useState(() => {
    const saved = localStorage.getItem('playlists');
    return saved ? JSON.parse(saved) : [];
  });
  const [listeningHistory, setListeningHistory] = useState(() => {
    const saved = localStorage.getItem('listeningHistory');
    return saved ? JSON.parse(saved) : [];
  });
  const [playCount, setPlayCount] = useState(() => {
    const saved = localStorage.getItem('playCount');
    return saved ? JSON.parse(saved) : {};
  });
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [selectedSongForPlaylist, setSelectedSongForPlaylist] = useState(null);
  const [createPlaylistFromAddModal, setCreatePlaylistFromAddModal] = useState(false);
  const [showClearPlaylistsModal, setShowClearPlaylistsModal] = useState(false);
  const [showDeletePlaylist, setShowDeletePlaylist] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);
  const [showClearHistory, setShowClearHistory] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    const saved = localStorage.getItem('recentSearches');
    return saved ? JSON.parse(saved) : [];
  });
  const [recentItems, setRecentItems] = useState(() => {
    const saved = localStorage.getItem('recentItems');
    return saved ? JSON.parse(saved) : [];
  });
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [savedAlbumPlaylist, setSavedAlbumPlaylist] = useState(null); // For album saved modal
  const [activePlaylistName, setActivePlaylistName] = useState(null);

  // Save to localStorage unconditionally
  useEffect(() => {
    localStorage.setItem('likedSongs', JSON.stringify(likedSongs));
  }, [likedSongs]);

  useEffect(() => {
    localStorage.setItem('playlists', JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    // Keep only last 100 songs in listening history
    const limitedHistory = listeningHistory.slice(-100);
    if (limitedHistory.length !== listeningHistory.length) {
      setListeningHistory(limitedHistory);
    }
    localStorage.setItem('listeningHistory', JSON.stringify(limitedHistory));
  }, [listeningHistory]);

  useEffect(() => {
    localStorage.setItem('playCount', JSON.stringify(playCount));
  }, [playCount]);

  // Save recentItems to localStorage whenever it changes
  useEffect(() => {
    // Keep only last 16 recent items
    const limitedRecent = recentItems.slice(0, 16);
    if (limitedRecent.length !== recentItems.length) {
      setRecentItems(limitedRecent);
    }
    localStorage.setItem('recentItems', JSON.stringify(limitedRecent));
  }, [recentItems]);

  useEffect(() => {
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  // Removed server sync logic

  useEffect(() => {
    if (currentView === 'home') {
      setLoading(true);
      fetch(getApiUrl('/api/songs'))
        .then(res => res.json())
        .then(data => {
          setSections(data);
          const allSongs = data.flatMap(section => section.songs || []);
          setSongs(allSongs);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error fetching songs:', err);
          setLoading(false);
        });
    }
  }, [currentView]);

  // Auto-fetch AI recommendations when user has listening data and visits home
  useEffect(() => {
    if (currentView === 'home' && (likedSongs.length > 0 || listeningHistory.length > 0) && aiRecommendations.length === 0 && !loadingRecommendations) {
      // Small delay to let the page load first
      const timer = setTimeout(() => {
        fetchAIRecommendations();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentView, likedSongs.length, listeningHistory.length]);

  const fetchAIRecommendations = async () => {
    if (loadingRecommendations) return;

    setLoadingRecommendations(true);
    console.log('🤖 Fetching AI recommendations...');

    try {
      const response = await fetch(getApiUrl('/api/recommendations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          likedSongs: likedSongs,
          listeningHistory: listeningHistory
        })
      });

      const recommendations = await response.json();
      setAiRecommendations(recommendations);
      console.log(`✅ Got ${recommendations.length} AI recommendations`);
    } catch (error) {
      console.error('❌ Error fetching AI recommendations:', error);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // SEO optimization: Update meta tags when view changes
  useEffect(() => {
    const currentPlaylist = currentView.startsWith('playlist-')
      ? playlists.find(p => p.id === currentView.replace('playlist-', ''))
      : null;

    updateSEOForView(
      currentView.startsWith('playlist-') ? 'playlist' : currentView,
      currentPlaylist ? {
        playlistName: currentPlaylist.name,
        playlistId: currentPlaylist.id
      } : {}
    );
  }, [currentView, playlists]);

  // SEO optimization: Add structured data when song changes
  useEffect(() => {
    if (currentSong) {
      addSongStructuredData(currentSong);
    }
  }, [currentSong]);

  // SEO optimization: Preload critical resources on mount
  useEffect(() => {
    preloadCriticalResources();
  }, []);

  // Reset search state when entering search view
  useEffect(() => {
    if (currentView === 'search') {
      // Don't reset if user already has a query and results
      if (!searchQuery && !hasSearched) {
        setSearchResults({ songs: [], albums: [] });
        setHasSearched(false);
        setSelectedAlbum(null);
        setAlbumTracks([]);
      }
    }
  }, [currentView, searchQuery, hasSearched]);

  // Initialize scroll states for carousels
  useEffect(() => {
    if (sections.length > 0 && currentView === 'home') {
      const filteredSections = sections
        .filter(section =>
          !section.title.toLowerCase().includes('episode') &&
          !section.title.toLowerCase().includes('podcast')
        )
        .map(section => ({
          ...section,
          title: section.title.replace(/\s*videos?\s*/gi, ' ').replace(/\s+/g, ' ').trim()
        }));

      filteredSections.forEach((_, index) => {
        const carousel = document.getElementById(`carousel-${index}`);
        if (carousel) {
          const updateScrollState = () => {
            const isAtStart = carousel.scrollLeft <= 0;
            const isAtEnd = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 1;

            setScrollStates(prev => ({
              ...prev,
              [index]: { isAtStart, isAtEnd }
            }));
          };

          updateScrollState();
          carousel.addEventListener('scroll', updateScrollState);

          return () => carousel.removeEventListener('scroll', updateScrollState);
        }
      });

      // Also initialize Most Played carousel
      const mostPlayedCarousel = document.getElementById('carousel-most-played');
      if (mostPlayedCarousel) {
        const updateMostPlayedScrollState = () => {
          const isAtStart = mostPlayedCarousel.scrollLeft <= 0;
          const isAtEnd = mostPlayedCarousel.scrollLeft + mostPlayedCarousel.clientWidth >= mostPlayedCarousel.scrollWidth - 1;

          setScrollStates(prev => ({
            ...prev,
            'most-played': { isAtStart, isAtEnd }
          }));
        };

        updateMostPlayedScrollState();
        mostPlayedCarousel.addEventListener('scroll', updateMostPlayedScrollState);

        return () => mostPlayedCarousel.removeEventListener('scroll', updateMostPlayedScrollState);
      }

      // Also initialize Recent carousel
      const recentCarousel = document.getElementById('carousel-recent');
      if (recentCarousel) {
        const updateRecentScrollState = () => {
          const isAtStart = recentCarousel.scrollLeft <= 0;
          const isAtEnd = recentCarousel.scrollLeft + recentCarousel.clientWidth >= recentCarousel.scrollWidth - 1;

          setScrollStates(prev => ({
            ...prev,
            'recent': { isAtStart, isAtEnd }
          }));
        };

        updateRecentScrollState();
        recentCarousel.addEventListener('scroll', updateRecentScrollState);

        return () => recentCarousel.removeEventListener('scroll', updateRecentScrollState);
      }

      // Also initialize AI Recommendations carousel
      const aiRecommendationsCarousel = document.getElementById('carousel-ai-recommendations');
      if (aiRecommendationsCarousel) {
        const updateAIRecommendationsScrollState = () => {
          const isAtStart = aiRecommendationsCarousel.scrollLeft <= 0;
          const isAtEnd = aiRecommendationsCarousel.scrollLeft + aiRecommendationsCarousel.clientWidth >= aiRecommendationsCarousel.scrollWidth - 1;

          setScrollStates(prev => ({
            ...prev,
            'ai-recommendations': { isAtStart, isAtEnd }
          }));
        };

        updateAIRecommendationsScrollState();
        aiRecommendationsCarousel.addEventListener('scroll', updateAIRecommendationsScrollState);

        return () => aiRecommendationsCarousel.removeEventListener('scroll', updateAIRecommendationsScrollState);
      }
    }
  }, [sections, currentView, playCount, aiRecommendations, recentItems]);

  const updateScrollState = (index) => {
    const carousel = document.getElementById(`carousel-${index}`);
    if (carousel) {
      const isAtStart = carousel.scrollLeft <= 0;
      const isAtEnd = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 1;

      setScrollStates(prev => ({
        ...prev,
        [index]: { isAtStart, isAtEnd }
      }));
    }
  };

  const scrollCarousel = (index, direction) => {
    const carousel = document.getElementById(`carousel-${index}`);
    if (carousel) {
      const scrollAmount = 400;
      carousel.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });

      setTimeout(() => updateScrollState(index), 300);
    }
  };

  const playSong = async (song, addToHistory = true, fetchNewQueue = true, addToRecent = true, playlistName = null) => {
    console.log(`🎵 Playing song: "${song.title}" by ${song.artist} (ID: ${song.youtubeId})`);
    setCurrentSong(song);
    setIsPlaying(true);
    setActivePlaylistName(playlistName);

    // Add to recent items (songs/albums) - skip if playing from album
    if (addToRecent) {
      setRecentItems(prev => {
        const filtered = prev.filter(item => item.id !== song.id);
        return [{ ...song, type: 'song', addedAt: new Date().toISOString() }, ...filtered].slice(0, 10);
      });
    }

    // Add to play history (unless we're navigating history)
    if (addToHistory) {
      setPlayHistory(prev => {
        // Remove any songs after current position (if user went back then played new song)
        const newHistory = prev.slice(0, historyIndex + 1);
        // Add current song
        newHistory.push(song);
        console.log(`📚 Added to history. History length: ${newHistory.length}`);
        return newHistory;
      });
      setHistoryIndex(prev => prev + 1);

      // Add to listening history (persistent) - unique songs only
      setListeningHistory(prev => {
        // Check if song already exists in recent history
        const existingIndex = prev.findIndex(s => s.id === song.id);
        let newHistory = [...prev];

        if (existingIndex !== -1) {
          // Remove old entry
          newHistory.splice(existingIndex, 1);
        }

        // Add to end (most recent)
        newHistory.push({
          ...song,
          playedAt: new Date().toISOString()
        });

        // Keep only last 100
        return newHistory.slice(-100);
      });

      // Track play count separately
      setPlayCount(prev => ({
        ...prev,
        [song.id]: {
          song: song,
          count: (prev[song.id]?.count || 0) + 1
        }
      }));
    }

    if (fetchNewQueue) {
      setQueue([song]);
      setQueueIndex(0);
    }

    // Fetch next songs in queue only if requested
    if (fetchNewQueue && song.youtubeId) {
      try {
        console.log(`📡 Fetching queue for video ID: ${song.youtubeId}`);
        const nextSongs = await fetchNextSongs(song.youtubeId);
        
        setQueue(prevQueue => {
          // If the queue has been replaced by another song play, ignore this response
          const currentId = prevQueue[0]?.youtubeId || prevQueue[0]?.id;
          const targetId = song.youtubeId || song.id;
          if (currentId && targetId && currentId !== targetId) {
            return prevQueue;
          }
          
          if (!Array.isArray(nextSongs) || nextSongs.length === 0) {
            return prevQueue.length > 0 ? prevQueue : [song];
          }
          
          // Append new songs to whatever is currently in the queue
          // This preserves any songs the user added manually while fetching
          const existingIds = new Set(prevQueue.map(s => s.youtubeId || s.id));
          const uniqueNextSongs = nextSongs.filter(s => !existingIds.has(s.youtubeId || s.id));
          
          return [...prevQueue, ...uniqueNextSongs];
        });
        
        console.log(`📋 Queue loaded: ${nextSongs.length} additional songs`);
      } catch (error) {
        console.error('❌ Error loading queue:', error);
      }
    } else if (!fetchNewQueue) {
      console.log('🔒 Keeping current queue (or managed by playlist/album)');
    }
  };

  const togglePlay = () => {
    console.log('🎮 togglePlay called');
    setIsPlaying(prev => {
      console.log('🎮 Toggling isPlaying from', prev, 'to', !prev);
      return !prev;
    });
  };

  const playNext = async () => {
    console.log('🎵 playNext called');
    console.log('  - Current song:', currentSong?.title || 'null');
    console.log('  - Queue length:', queue.length);
    console.log('  - Queue index:', queueIndex);
    console.log('  - Repeat:', repeat);
    console.log('  - Shuffle:', shuffle);

    if (!currentSong) {
      console.warn('⚠️ No current song, cannot play next');
      console.warn('  - This might be a stale closure issue');
      return;
    }

    if (repeat === 'one') {
      // Replay the same song
      console.log('🔁 Repeat one - replaying current song');
      setIsPlaying(false);
      setTimeout(() => setIsPlaying(true), 100);
      return;
    }

    // Try to play from queue first
    // Find current song index in queue
    const currentSongIndex = queue.findIndex(s => s.id === currentSong.id);
    const nextIndex = currentSongIndex + 1;

    console.log(`📍 Current song at index ${currentSongIndex}, next index: ${nextIndex}`);

    if (queue.length > 0 && nextIndex < queue.length) {
      const nextSong = queue[nextIndex];
      console.log(`▶️ Playing from queue: index ${nextIndex}/${queue.length - 1}`);
      console.log(`🎵 Next song: "${nextSong.title}" by ${nextSong.artist}`);
      setQueueIndex(nextIndex);
      setCurrentSong(nextSong);
      setIsPlaying(true);

      // Add to history (including auto-played songs)
      setPlayHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(nextSong);
        console.log(`📚 Added to history. History length: ${newHistory.length}`);
        return newHistory;
      });
      setHistoryIndex(prev => prev + 1);

      // Add to listening history (persistent) - unique songs only
      setListeningHistory(prev => {
        // Check if song already exists in recent history
        const existingIndex = prev.findIndex(s => s.id === nextSong.id);
        let newHistory = [...prev];

        if (existingIndex !== -1) {
          // Remove old entry
          newHistory.splice(existingIndex, 1);
        }

        // Add to end (most recent)
        newHistory.push({
          ...nextSong,
          playedAt: new Date().toISOString()
        });

        // Keep only last 100
        return newHistory.slice(-100);
      });

      // Track play count
      setPlayCount(prev => ({
        ...prev,
        [nextSong.id]: {
          song: nextSong,
          count: (prev[nextSong.id]?.count || 0) + 1
        }
      }));

      // 🔥 INFINITE QUEUE: Load more songs when approaching the end
      // Check if we're within the last 3 songs of the queue
      const songsRemaining = queue.length - nextIndex - 1;
      if (songsRemaining <= 3 && nextSong.youtubeId) {
        try {
          console.log(`🔄 Approaching end of queue (${songsRemaining} songs left), extending queue...`);
          const moreSongs = await fetchNextSongs(nextSong.youtubeId);

          if (moreSongs.length > 0) {
            // Filter out songs already in queue to avoid duplicates
            const existingIds = new Set(queue.map(s => s.id));
            const newSongs = moreSongs.filter(s => !existingIds.has(s.id));

            if (newSongs.length > 0) {
              setQueue(prev => [...prev, ...newSongs]);
              console.log(`✨ Extended queue with ${newSongs.length} new songs (total: ${queue.length + newSongs.length})`);
            } else {
              console.log(`⚠️ No new unique songs to add to queue`);
            }
          }
        } catch (error) {
          console.error('❌ Error extending queue:', error);
        }
      }

      return;
    }

    // Fallback to shuffle or sequential play
    console.log('📋 Queue empty or ended, using fallback');
    if (songs.length === 0) {
      console.warn('⚠️ No songs available for fallback');
      return;
    }

    if (shuffle) {
      // Play random song
      console.log('🔀 Shuffle mode - playing random song');
      const randomIndex = Math.floor(Math.random() * songs.length);
      await playSong(songs[randomIndex]);
    } else {
      // Play next song from current list
      console.log('➡️ Sequential mode - playing next from list');
      const currentIndex = songs.findIndex(s => s.id === currentSong.id);
      const nextIndex = (currentIndex + 1) % songs.length;
      await playSong(songs[nextIndex]);
    }
  };

  const playPrevious = async () => {
    console.log('⏮️ playPrevious called - History index:', historyIndex, 'History length:', playHistory.length);

    if (!currentSong) {
      console.warn('⚠️ No current song');
      return;
    }

    // If we have history, go back
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevSong = playHistory[prevIndex];
      console.log(`⏮️ Playing from history: "${prevSong.title}" (index ${prevIndex})`);
      setHistoryIndex(prevIndex);
      setCurrentSong(prevSong);
      setIsPlaying(true);

      // Fetch queue for the previous song
      try {
        const nextSongs = await fetchNextSongs(prevSong.youtubeId);
        // Add previous song at the beginning
        const fullQueue = [prevSong, ...nextSongs];
        setQueue(fullQueue);
        setQueueIndex(0);
        console.log(`📋 Queue loaded for previous song: ${fullQueue.length} songs (including current)`);
      } catch (error) {
        console.error('❌ Error loading queue:', error);
      }
    } else {
      console.log('⚠️ No previous song in history');
      // Fallback: replay current song from beginning
      setIsPlaying(false);
      setTimeout(() => setIsPlaying(true), 100);
    }
  };

  const toggleShuffle = () => {
    setShuffle(!shuffle);
  };

  const toggleRepeat = () => {
    if (repeat === 'off') setRepeat('all');
    else if (repeat === 'all') setRepeat('one');
    else setRepeat('off');
  };

  const toggleAutoplay = () => {
    setAutoplay(!autoplay);
  };

  const toggleQueue = () => {
    setShowQueue(!showQueue);
  };

  const playFromQueue = async (song) => {
    console.log(`🎵 Playing from queue without changing playlist: "${song.title}"`);
    // Play song but don't fetch new queue
    await playSong(song, true, false);
    // Find the song's position in current queue and update index
    const songIndex = queue.findIndex(s => s.id === song.id);
    if (songIndex !== -1) {
      setQueueIndex(songIndex + 1);
      console.log(`📍 Updated queue index to ${songIndex + 1}`);
    }
  };

  const refreshQueue = async () => {
    if (!currentSong || !currentSong.youtubeId) return;

    console.log(`🔄 Refreshing queue for: "${currentSong.title}"`);
    try {
      const nextSongs = await fetchNextSongs(currentSong.youtubeId);
      // Add current song at the beginning
      const fullQueue = [currentSong, ...nextSongs];
      setQueue(fullQueue);
      setQueueIndex(0);
      console.log(`✅ Queue refreshed: ${fullQueue.length} songs (including current)`);
    } catch (error) {
      console.error('❌ Error refreshing queue:', error);
    }
  };

  const extendQueue = async () => {
    if (queue.length === 0) return;

    // Get the last song in queue to fetch related songs
    const lastSong = queue[queue.length - 1];
    if (!lastSong || !lastSong.youtubeId) return;

    console.log(`📜 Extending queue based on: "${lastSong.title}"`);
    try {
      const moreSongs = await fetchNextSongs(lastSong.youtubeId);

      if (moreSongs.length > 0) {
        // Filter out songs already in queue to avoid duplicates
        const existingIds = new Set(queue.map(s => s.id));
        const newSongs = moreSongs.filter(s => !existingIds.has(s.id));

        if (newSongs.length > 0) {
          setQueue(prev => [...prev, ...newSongs]);
          console.log(`✨ Extended queue with ${newSongs.length} new songs (total: ${queue.length + newSongs.length})`);
        } else {
          console.log(`⚠️ No new unique songs to add to queue`);
        }
      }
    } catch (error) {
      console.error('❌ Error extending queue:', error);
    }
  };

  const reorderQueue = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    const newQueue = [...queue];
    const [movedSong] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex, 0, movedSong);

    setQueue(newQueue);
    console.log(`🔄 Reordered queue: moved song from position ${fromIndex + 1} to ${toIndex + 1}`);
  };

  // Add song to play next (right after current song)
  const handlePlayNext = (song) => {
    // Check if song is already in queue
    const existingIndex = queue.findIndex(s => s.id === song.id);
    
    const newQueue = [...queue];
    
    // Remove if already exists
    if (existingIndex !== -1) {
      newQueue.splice(existingIndex, 1);
    }
    
    // Insert right after current song (queueIndex)
    const insertIndex = queueIndex >= 0 ? queueIndex + 1 : 0;
    newQueue.splice(insertIndex, 0, song);
    
    setQueue(newQueue);
    if (queueIndex === -1 && currentSong === null) {
      playSong(song);
    }
    console.log(`⏭️ Added "${song.title}" to play next (position ${insertIndex + 1})`);
  };

  // Add song to end of queue
  const handleAddToQueue = (song) => {
    // Check if song is already in queue
    const existingIndex = queue.findIndex(s => s.id === song.id);
    
    const newQueue = [...queue];
    
    // Remove if already exists
    if (existingIndex !== -1) {
      newQueue.splice(existingIndex, 1);
    }
    
    // Insert at end
    newQueue.push(song);
    
    setQueue(newQueue);
    if (queue.length === 0 && currentSong === null) {
      playSong(song);
    }
    console.log(`⏭️ Added "${song.title}" to end of queue (position ${newQueue.length})`);
  };

  const toggleLike = (song) => {
    if (likedSongs.find(s => s.id === song.id)) {
      setLikedSongs(likedSongs.filter(s => s.id !== song.id));
      console.log(`💔 Removed from liked songs: ${song.title}`);
    } else {
      setLikedSongs([...likedSongs, { ...song, likedAt: new Date().toISOString() }]);
      console.log(`❤️ Added to liked songs: ${song.title}`);
    }
  };

  const createPlaylist = (name) => {
    // Check if playlist name already exists
    const existingPlaylist = playlists.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existingPlaylist) {
      console.warn(`⚠️ Playlist "${name}" already exists`);
      return null; // Return null to indicate failure
    }

    const newPlaylist = {
      id: Date.now().toString(),
      name: name,
      songs: [],
      createdAt: new Date().toISOString()
    };
    setPlaylists([...playlists, newPlaylist]);
    console.log(`📝 Created playlist: ${name}`);
    return newPlaylist;
  };

  // Save album as a new playlist
  const saveAlbumAsPlaylist = (albumName, tracks) => {
    if (!tracks || tracks.length === 0) {
      console.warn('⚠️ No tracks to save');
      return null;
    }

    // Generate unique name if album name already exists
    let playlistName = albumName;
    let counter = 1;
    while (playlists.find(p => p.name.toLowerCase() === playlistName.toLowerCase())) {
      playlistName = `${albumName} (${counter})`;
      counter++;
    }

    const newPlaylist = {
      id: Date.now().toString(),
      name: playlistName,
      songs: tracks.map(track => ({
        ...track,
        addedAt: new Date().toISOString()
      })),
      createdAt: new Date().toISOString()
    };
    setPlaylists(prev => [...prev, newPlaylist]);
    console.log(`📀 Saved album "${playlistName}" as playlist with ${tracks.length} tracks`);
    return newPlaylist;
  };

  const clearAllPlaylists = () => {
    setShowClearPlaylistsModal(true);
  };

  const confirmClearAllPlaylists = () => {
    setPlaylists([]);
    setCurrentView('home');
    setShowClearPlaylistsModal(false);
    console.log('🗑️ All playlists cleared');
  };

  const addToPlaylist = (playlistId, song) => {
    setPlaylists(prev => prev.map(playlist => {
      if (playlist.id === playlistId) {
        // Check if song already exists
        if (playlist.songs.find(s => s.id === song.id)) {
          console.log(`⚠️ Song already in playlist: ${song.title}`);
          return playlist;
        }
        console.log(`➕ Added to playlist "${playlist.name}": ${song.title}`);
        return {
          ...playlist,
          songs: [...playlist.songs, song]
        };
      }
      return playlist;
    }));
  };

  const removeFromPlaylist = (playlistId, songId) => {
    setPlaylists(prev => prev.map(playlist => {
      if (playlist.id === playlistId) {
        return {
          ...playlist,
          songs: playlist.songs.filter(s => s.id !== songId)
        };
      }
      return playlist;
    }));
  };

  const deletePlaylist = (playlistId) => {
    setPlaylists(prev => prev.filter(p => p.id !== playlistId));
    console.log(`🗑️ Deleted playlist`);
  };

  const loadMoreSection = async (section) => {
    if (!section.browseId) return;

    setLoading(true);
    setExpandedSection(section);

    try {
      const data = await fetchSection(section.browseId);
      setExpandedSongs(data);
    } catch (error) {
      console.error('Error loading section:', error);
      setExpandedSongs(section.songs);
    } finally {
      setLoading(false);
    }
  };

  const closeExpandedSection = () => {
    setExpandedSection(null);
    setExpandedSongs([]);
  };

  const performSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults({ songs: [], albums: [] });
      setHasSearched(false);
      return;
    }

    // Add to recent searches
    const query = searchQuery.trim();
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== query.toLowerCase());
      return [query, ...filtered].slice(0, 10); // Keep max 10 recent searches
    });

    setIsSearching(true);
    setHasSearched(true);
    setSelectedAlbum(null);
    setAlbumTracks([]);
    try {
      const data = await searchSongs(searchQuery);
      setSearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults({ songs: [], albums: [] });
    } finally {
      setIsSearching(false);
    }
  };

  const removeRecentSearch = (searchToRemove) => {
    setRecentSearches(prev => prev.filter(s => s !== searchToRemove));
  };

  const handleRecentSearchClick = (query) => {
    setSearchQuery(query);
    // Trigger search after setting query
    setTimeout(() => {
      document.querySelector('.search-button')?.click();
    }, 0);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults({ songs: [], albums: [] });
    setHasSearched(false);
    setSelectedAlbum(null);
    setAlbumTracks([]);
  };

  // Fetch album tracks
  const fetchAlbumTracks = async (album) => {
    setLoadingAlbum(true);
    setSelectedAlbum(album);
    
    // Add album to recent items
    setRecentItems(prev => {
      const filtered = prev.filter(item => item.id !== album.id);
      return [{ ...album, type: 'album', addedAt: new Date().toISOString() }, ...filtered].slice(0, 10);
    });
    
    try {
      const response = await fetch(getApiUrl(`/api/album/${album.browseId}`));
      if (!response.ok) throw new Error('Failed to fetch album');
      const data = await response.json();
      setAlbumTracks(data.tracks || []);
    } catch (error) {
      console.error('Error fetching album:', error);
      setAlbumTracks([]);
    } finally {
      setLoadingAlbum(false);
    }
  };

  // Play all album tracks
  const playAlbum = (tracks) => {
    if (tracks.length > 0) {
      // Set the full album as the queue first
      setQueue(tracks);
      setQueueIndex(0);
      // Play the first track without fetching a new queue (keep album queue), don't add to recent (album already added)
      playSong(tracks[0], true, false, false);
      console.log(`📀 Playing album with ${tracks.length} tracks`);
    }
  };

  // Play a specific track from album
  const playAlbumTrack = (tracks, index) => {
    if (tracks.length > 0 && index >= 0 && index < tracks.length) {
      // Set the full album as the queue
      setQueue(tracks);
      setQueueIndex(index);
      // Play the selected track without fetching a new queue (keep album queue), don't add to recent (album already added)
      playSong(tracks[index], true, false, false);
      console.log(`📀 Playing album track ${index + 1}/${tracks.length}: "${tracks[index].title}"`);
    }
  };

  // Play a specific track from playlist
  const playPlaylistTrack = (playlist, index) => {
    if (playlist.songs.length > 0 && index >= 0 && index < playlist.songs.length) {
      // Set the full playlist as the queue
      setQueue(playlist.songs);
      setQueueIndex(index);
      // Play the selected track without fetching a new queue (keep playlist queue)
      setActivePlaylistName(playlist.name);
      playSong(playlist.songs[index], true, false, true, playlist.name);
      console.log(`🎵 Playing playlist track ${index + 1}/${playlist.songs.length}: "${playlist.songs[index].title}"`);
    }
  };

  const renderHomeView = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      );
    }

    const filteredSections = sections
      .filter(section =>
        !section.title.toLowerCase().includes('episode') &&
        !section.title.toLowerCase().includes('podcast')
      )
      .map(section => ({
        ...section,
        title: section.title.replace(/\s*videos?\s*/gi, ' ').replace(/\s+/g, ' ').trim()
      }));

    // Get most played songs from play count tracker
    const getMostPlayedSongs = () => {
      // Convert to array and sort by count
      const sortedSongs = Object.values(playCount)
        .sort((a, b) => b.count - a.count)
        .slice(0, 20); // Top 20 songs

      return sortedSongs;
    };

    const mostPlayedSongs = getMostPlayedSongs();

    return (
      <div className="home-view">
        <div className="welcome-section">
          <p className="welcome-subtitle-top">Welcome Back</p>
          <h2 className="welcome-title">Good Morning</h2>
        </div>

        {/* Recommendations Section (now first) */}
        {(likedSongs.length > 0 || listeningHistory.length > 0) && (
          <div className="music-section">
            <div className="section-header">
              <div className="section-title-group">
                <h2 className="section-title">
                  Recommendations
                </h2>
                <span className="section-subtitle"></span>
              </div>
              <button
                className="more-button"
                onClick={fetchAIRecommendations}
                disabled={loadingRecommendations}
              >
                {loadingRecommendations ? 'Loading...' : aiRecommendations.length > 0 ? 'Refresh' : 'Get Recommendations'}
              </button>
            </div>
            {loadingRecommendations ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Getting personalized recommendations...</p>
              </div>
            ) : aiRecommendations.length > 0 ? (
              <div className="section-carousel">
                {scrollStates['ai-recommendations'] && !scrollStates['ai-recommendations'].isAtStart && (
                  <button
                    className="scroll-button left"
                    onClick={() => scrollCarousel('ai-recommendations', 'left')}
                    aria-label="Scroll left"
                  >
                    <ChevronLeftIcon />
                  </button>
                )}
                {scrollStates['ai-recommendations'] && !scrollStates['ai-recommendations'].isAtEnd && (
                  <button
                    className="scroll-button right"
                    onClick={() => scrollCarousel('ai-recommendations', 'right')}
                    aria-label="Scroll right"
                  >
                    <ChevronRightIcon />
                  </button>
                )}
                <div className="songs-carousel large-cards" id="carousel-ai-recommendations">
                  {aiRecommendations.map(song => (
                    <SongCard
                      key={song.id}
                      song={song}
                      currentSong={currentSong}
                      isLiked={!!likedSongs.find(s => s.id === song.id)}
                      onPlay={playSong}
                      onToggleLike={toggleLike}
                      onAddToPlaylist={(song) => {
                        setSelectedSongForPlaylist(song);
                        setShowAddToPlaylist(true);
                      }}
                      onPlayNext={handlePlayNext}
                      onAddToQueue={handleAddToQueue}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>Click "Get Recommendations" to discover songs based on your taste!</p>
              </div>
            )}
          </div>
        )}

        {/* Recent Section (now using vertical list layout) */}
        {recentItems.length > 0 && (
          <div className="music-section">
            <div className="section-header">
              <h2 className="section-title">Recently Played</h2>
            </div>
            <div className="section-carousel">
              {scrollStates['recent'] && !scrollStates['recent'].isAtStart && (
                <button
                  className="scroll-button left"
                  onClick={() => scrollCarousel('recent', 'left')}
                  aria-label="Scroll left"
                >
                  <ChevronLeftIcon />
                </button>
              )}
              {scrollStates['recent'] && !scrollStates['recent'].isAtEnd && (
                <button
                  className="scroll-button right"
                  onClick={() => scrollCarousel('recent', 'right')}
                  aria-label="Scroll right"
                >
                  <ChevronRightIcon />
                </button>
              )}
              <div className="recent-list-container" id="carousel-recent">
                {recentItems.slice(0, 16).map(item => (
                  <div
                    key={item.id}
                    className="recent-list-item"
                    onClick={() => item.type === 'album' ? fetchAlbumTracks(item) : playSong(item)}
                  >
                    <div className="recent-item-left">
                      <div className="recent-item-cover">
                        <img 
                          src={item.cover || (item.thumbnails && item.thumbnails.length > 0 ? (item.thumbnails[1]?.url || item.thumbnails[0]?.url) : null)} 
                          alt={item.title} 
                          loading="lazy" 
                        />
                      </div>
                      <div className="recent-item-info">
                        <h4 className="recent-item-title">{item.title}</h4>
                        <p className="recent-item-artist">{item.artist || 'Various Artists'}</p>
                      </div>
                    </div>
                    <div className="recent-item-actions">
                      <button
                        className="recent-item-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(item);
                        }}
                      >
                        <HeartIcon filled={!!likedSongs.find(s => (s.id || s.videoId) === (item.id || item.videoId))} />
                      </button>
                      <button
                        className="recent-item-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if(item.type !== 'album') {
                            setSelectedSongForPlaylist(item);
                            setShowAddToPlaylist(true);
                          }
                        }}
                      >
                        <PlusIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Most Played Section (now third) */}
        {mostPlayedSongs.length > 0 && (
          <div className="music-section">
            <div className="section-header">
              <h2 className="section-title">Most Played</h2>
            </div>
            <div className="section-carousel">
              {scrollStates['most-played'] && !scrollStates['most-played'].isAtStart && (
                <button
                  className="scroll-button left"
                  onClick={() => scrollCarousel('most-played', 'left')}
                  aria-label="Scroll left"
                >
                  <ChevronLeftIcon />
                </button>
              )}
              {scrollStates['most-played'] && !scrollStates['most-played'].isAtEnd && (
                <button
                  className="scroll-button right"
                  onClick={() => scrollCarousel('most-played', 'right')}
                  aria-label="Scroll right"
                >
                  <ChevronRightIcon />
                </button>
              )}
              <div className="songs-carousel" id="carousel-most-played">
                {mostPlayedSongs.map(({ song, count }) => (
                  <div key={song.id} className="song-card-wrapper">
                    <div className="play-count-badge">{count}× played</div>
                    <SongCard
                      song={song}
                      currentSong={currentSong}
                      isLiked={!!likedSongs.find(s => s.id === song.id)}
                      onPlay={playSong}
                      onToggleLike={toggleLike}
                      onAddToPlaylist={(song) => {
                        setSelectedSongForPlaylist(song);
                        setShowAddToPlaylist(true);
                      }}
                      onPlayNext={handlePlayNext}
                      onAddToQueue={handleAddToQueue}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {filteredSections.map((section, index) => {
          const scrollState = scrollStates[index] || { isAtStart: true, isAtEnd: false };

          return (
            <div key={index} className="music-section">
              <div className="section-header">
                <h2 className="section-title">{section.title}</h2>
                {section.browseId && (
                  <button
                    className="more-button"
                    onClick={() => loadMoreSection(section)}
                  >
                    More
                  </button>
                )}
              </div>
              <div className="section-carousel">
                {!scrollState.isAtStart && (
                  <button
                    className="scroll-button left"
                    onClick={() => scrollCarousel(index, 'left')}
                    aria-label="Scroll left"
                  >
                    <ChevronLeftIcon />
                  </button>
                )}
                {!scrollState.isAtEnd && (
                  <button
                    className="scroll-button right"
                    onClick={() => scrollCarousel(index, 'right')}
                    aria-label="Scroll right"
                  >
                    <ChevronRightIcon />
                  </button>
                )}
                <div className="songs-carousel" id={`carousel-${index}`}>
                  {section.songs.map(song => (
                    <SongCard
                      key={song.id}
                      song={song}
                      currentSong={currentSong}
                      isLiked={!!likedSongs.find(s => s.id === song.id)}
                      onPlay={playSong}
                      onToggleLike={toggleLike}
                      onAddToPlaylist={(song) => {
                        setSelectedSongForPlaylist(song);
                        setShowAddToPlaylist(true);
                      }}
                      onPlayNext={handlePlayNext}
                      onAddToQueue={handleAddToQueue}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Play song from liked songs - sets queue to all liked songs
  const playFromLikedSongs = (song) => {
    console.log(`❤️ Playing from Liked Songs: "${song.title}"`);
    const songIndex = likedSongs.findIndex(s => s.id === song.id);
    
    // Set queue to all liked songs, starting from clicked song
    const reorderedQueue = [
      ...likedSongs.slice(songIndex),
      ...likedSongs.slice(0, songIndex)
    ];
    
    setQueue(reorderedQueue);
    setQueueIndex(0);
    playSong(song, true, false, true, "Liked Songs");
    setQueueIndex(0);
    setCurrentSong(song);
    setIsPlaying(true);
    
    // Add to history
    setPlayHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(song);
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
    
    // Add to listening history
    setListeningHistory(prev => {
      const existingIndex = prev.findIndex(s => s.id === song.id);
      let newHistory = [...prev];
      if (existingIndex !== -1) newHistory.splice(existingIndex, 1);
      newHistory.push({ ...song, playedAt: new Date().toISOString() });
      return newHistory.slice(-100);
    });
    
    // Track play count
    setPlayCount(prev => ({
      ...prev,
      [song.id]: { song, count: (prev[song.id]?.count || 0) + 1 }
    }));
    
    console.log(`📋 Queue set to ${reorderedQueue.length} liked songs`);
  };

  const renderLikedView = () => {
    return (
      <div className="home-view">
        <div className="music-section">
          <div className="section-header">
            <h2 className="section-title">Liked Songs</h2>
            <span className="section-subtitle">{likedSongs.length} songs</span>
          </div>
          {likedSongs.length === 0 ? (
            <div className="empty-state">
              <p>No liked songs yet. Start liking some songs!</p>
            </div>
          ) : (
            <div className="songs-grid-full">
              {likedSongs.map(song => (
                <SongCard
                  key={song.id}
                  song={song}
                  currentSong={currentSong}
                  isLiked={true}
                  onPlay={playFromLikedSongs}
                  onToggleLike={toggleLike}
                  onAddToPlaylist={(song) => {
                    setSelectedSongForPlaylist(song);
                    setShowAddToPlaylist(true);
                  }}
                  onPlayNext={handlePlayNext}
                  onAddToQueue={handleAddToQueue}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderHistoryView = () => {
    // Reverse to show most recent first
    const reversedHistory = [...listeningHistory].reverse();

    return (
      <div className="home-view">
        <div className="music-section">
          <div className="section-header">
            <div className="section-title-group">
              <h2 className="section-title">Listening History</h2>
              <span className="section-subtitle">Last 100 songs</span>
            </div>
            {listeningHistory.length > 0 && (
              <button
                className="delete-playlist-btn"
                onClick={() => setShowClearHistory(true)}
                title="Clear History"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
                Clear History
              </button>
            )}
          </div>
          {listeningHistory.length === 0 ? (
            <div className="empty-state">
              <p>No listening history yet. Start playing some songs!</p>
            </div>
          ) : (
            <div className="songs-grid-full">
              {reversedHistory.map((song, index) => (
                <SongCard
                  key={`${song.id}-${index}`}
                  song={song}
                  currentSong={currentSong}
                  isLiked={!!likedSongs.find(s => s.id === song.id)}
                  onPlay={playSong}
                  onToggleLike={toggleLike}
                  onAddToPlaylist={(song) => {
                    setSelectedSongForPlaylist(song);
                    setShowAddToPlaylist(true);
                  }}
                  onPlayNext={handlePlayNext}
                  onAddToQueue={handleAddToQueue}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLibraryView = () => {
    return (
      <div className="home-view">
        <div className="music-section">
          <div className="section-header">
            <h2 className="section-title">Your Library</h2>
            <button
              className="more-button"
              onClick={() => setShowCreatePlaylist(true)}
            >
              + New Playlist
            </button>
          </div>
          
          <div className="library-grid">
            {/* Liked Songs Card */}
            <div 
              className="library-card"
              onClick={() => setCurrentView('liked')}
            >
              <div className="library-card-icon liked">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              </div>
              <div className="library-card-info">
                <h3>Liked Songs</h3>
                <span>{likedSongs.length} songs</span>
              </div>
            </div>

            {/* Playlists */}
            {playlists.map(playlist => (
              <div 
                key={playlist.id}
                className="library-card"
                onClick={() => setCurrentView(`playlist-${playlist.id}`)}
              >
                <div className="library-card-icon playlist">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
                  </svg>
                </div>
                <div className="library-card-info">
                  <h3>{playlist.name}</h3>
                  <span>{playlist.songs.length} songs</span>
                </div>
              </div>
            ))}
          </div>

          {playlists.length === 0 && (
            <div className="empty-state" style={{ marginTop: '20px' }}>
              <p>Create your first playlist to organize your music!</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPlaylistView = (playlistId) => {
    const playlist = playlists.find(p => p.id === playlistId);

    if (!playlist) {
      return (
        <div className="home-view">
          <div className="empty-state">
            <p>Playlist not found</p>
          </div>
        </div>
      );
    }

    return (
      <div className="home-view">
        <div className="music-section">
          <div className="section-header">
            <div className="section-title-group">
              <h2 className="section-title">{playlist.name}</h2>
              <span className="section-subtitle">{playlist.songs.length} songs</span>
            </div>
            <button
              className="delete-playlist-btn"
              onClick={() => {
                setPlaylistToDelete(playlist);
                setShowDeletePlaylist(true);
              }}
              title="Delete Playlist"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              Delete Playlist
            </button>
          </div>
          {playlist.songs.length === 0 ? (
            <div className="empty-state">
              <p>No songs in this playlist yet</p>
            </div>
          ) : (
            <div className="songs-grid-full">
              {playlist.songs.map((song, index) => (
                <SongCard
                  key={song.id}
                  song={song}
                  currentSong={currentSong}
                  isLiked={!!likedSongs.find(s => s.id === song.id)}
                  onPlay={() => playPlaylistTrack(playlist, index)}
                  onToggleLike={toggleLike}
                  showRemove={true}
                  onRemoveFromPlaylist={(song) => {
                    removeFromPlaylist(playlistId, song.id);
                  }}
                  onAddToPlaylist={(song) => {
                    setSelectedSongForPlaylist(song);
                    setShowAddToPlaylist(true);
                  }}
                  onPlayNext={handlePlayNext}
                  onAddToQueue={handleAddToQueue}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderExpandedSection = () => {
    return (
      <div className="home-view">
        <div className="music-section">
          <div className="section-header">
            <button className="back-button" onClick={closeExpandedSection}>
              ← Back
            </button>
            <h2 className="section-title">{expandedSection.title}</h2>
          </div>
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading...</p>
            </div>
          ) : (
            <div className="songs-grid-full">
              {expandedSongs.map(song => (
                <SongCard
                  key={song.id}
                  song={song}
                  currentSong={currentSong}
                  isLiked={!!likedSongs.find(s => s.id === song.id)}
                  onPlay={playSong}
                  onToggleLike={toggleLike}
                  onAddToPlaylist={(song) => {
                    setSelectedSongForPlaylist(song);
                    setShowAddToPlaylist(true);
                  }}
                  onPlayNext={handlePlayNext}
                  onAddToQueue={handleAddToQueue}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  return (
    <div className="app">
      {/* Floating ambient background orbs */}
      <div className="floating-orbs">
        <div className="floating-orb purple"></div>
        <div className="floating-orb teal"></div>
        <div className="floating-orb pink"></div>
      </div>
      <Sidebar
        currentView={currentView}
        onViewChange={(view) => {
          setCurrentView(view);
          closeExpandedSection();
          closeSidebar();
        }}
        likedCount={likedSongs.length}
        historyCount={listeningHistory.length}
        playlists={playlists}
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        onCreatePlaylist={() => {
          setShowCreatePlaylist(true);
          closeSidebar();
        }}
        onClearPlaylists={clearAllPlaylists}
      />
      <div className="main-content">
        {/* Komei Header */}
        <div className="main-header">
          <div className="sonfy-brand">
            <h1 className="sonfy-title">
              <div className="sonfy-logo">
                <img src="/logo.png" alt="Komei" />
              </div>
              <b>Komei</b>
            </h1>
          </div>

        </div>

        {currentView === 'search' ? (
          <div className="search-view">
            <div className="search-header">
              <h1>Search on Komei</h1>
              <div className="search-input-wrapper">
                <div className="search-input-container">
                  <SearchIcon />
                  <input
                    type="text"
                    placeholder="What do you want to listen to?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    className="search-input"
                    autoFocus
                  />
                  {searchQuery && (
                    <button className="clear-search-btn" onClick={clearSearch} title="Clear">
                      ✕
                    </button>
                  )}
                </div>
                <button
                  className="search-button"
                  onClick={performSearch}
                  disabled={!searchQuery.trim() || isSearching}
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {isSearching ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Searching...</p>
              </div>
            ) : selectedAlbum ? (
              // Album view
              <div className="album-view">
                <div className="album-header">
                  <button className="back-button" onClick={() => { setSelectedAlbum(null); setAlbumTracks([]); }}>
                    ← Back
                  </button>
                  <div className="album-info">
                    <img src={selectedAlbum.cover} alt={selectedAlbum.title} className="album-cover-large" />
                    <div className="album-details">
                      <h1 className="album-title">{selectedAlbum.title}</h1>
                      <p className="album-artist">{selectedAlbum.artist}</p>
                      {albumTracks.length > 0 && (
                        <div className="album-actions">
                          <button className="play-album-btn" onClick={() => playAlbum(albumTracks)}>
                            ▶ Play All
                          </button>
                          <button 
                            className="save-album-btn" 
                            onClick={() => {
                              const playlist = saveAlbumAsPlaylist(selectedAlbum.title, albumTracks);
                              if (playlist) {
                                setSavedAlbumPlaylist(playlist);
                              }
                            }}
                            title="Save album as playlist"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {loadingAlbum ? (
                  <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading album...</p>
                  </div>
                ) : (
                  <div className="album-tracks">
                    {albumTracks.map((track, index) => (
                      <div 
                        key={track.id} 
                        className={`album-track ${currentSong?.id === track.id ? 'active' : ''}`}
                        onClick={() => playAlbumTrack(albumTracks, index)}
                      >
                        <span className="track-number">{index + 1}</span>
                        <div className="track-info">
                          <span className="track-title">{track.title}</span>
                          <span className="track-duration">{track.duration}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (searchResults.songs?.length > 0 || searchResults.albums?.length > 0) ? (
              <div className="search-results">
                {/* Albums Section */}
                {searchResults.albums?.length > 0 && (
                  <div className="search-section">
                    <h2 className="section-title">Albums</h2>
                    <div className="albums-grid">
                      {searchResults.albums.map(album => (
                        <div 
                          key={album.id} 
                          className="album-card"
                          onClick={() => fetchAlbumTracks(album)}
                        >
                          <img src={album.cover} alt={album.title} />
                          <div className="album-card-info">
                            <h3>{album.title}</h3>
                            <p>{album.artist}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Songs Section */}
                {searchResults.songs?.length > 0 && (
                  <div className="search-section">
                    <h2 className="section-title">Songs</h2>
                    <div className="songs-grid-full">
                      {searchResults.songs.map(song => (
                        <SongCard
                          key={song.id}
                          song={song}
                          currentSong={currentSong}
                          isLiked={!!likedSongs.find(s => s.id === song.id)}
                          onPlay={playSong}
                          onToggleLike={toggleLike}
                          onAddToPlaylist={(song) => {
                            setSelectedSongForPlaylist(song);
                            setShowAddToPlaylist(true);
                          }}
                          onPlayNext={handlePlayNext}
                          onAddToQueue={handleAddToQueue}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : hasSearched && searchResults.songs?.length === 0 && searchResults.albums?.length === 0 ? (
              <div className="empty-state">
                <p>No results found for "{searchQuery}"</p>
              </div>
            ) : (
              <div className="search-empty-state">
                {recentSearches.length > 0 ? (
                  <div className="recent-searches">
                    <h2>Recent Searches</h2>
                    <div className="recent-searches-list">
                      {recentSearches.map((search, index) => (
                        <div key={index} className="recent-search-item">
                          <button 
                            className="recent-search-text"
                            onClick={() => handleRecentSearchClick(search)}
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="history-icon">
                              <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                            </svg>
                            {search}
                          </button>
                          <button 
                            className="remove-recent-search"
                            onClick={() => removeRecentSearch(search)}
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p>Start typing to search for songs, artists, and albums</p>
                )}
              </div>
            )}
          </div>
        ) : expandedSection ? renderExpandedSection() : (
          <>
            {currentView === 'home' && renderHomeView()}
            {currentView === 'liked' && renderLikedView()}
            {currentView === 'history' && renderHistoryView()}
            {currentView === 'library' && renderLibraryView()}
            {currentView.startsWith('playlist-') && renderPlaylistView(currentView.replace('playlist-', ''))}
          </>
        )}
      </div>
      {currentSong && (
        <Player
          currentView={currentView}
          currentSong={currentSong}
          activePlaylistName={activePlaylistName}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onNext={playNext}
          onPrevious={playPrevious}
          shuffle={shuffle}
          onToggleShuffle={toggleShuffle}
          repeat={repeat}
          onToggleRepeat={toggleRepeat}
          autoplay={autoplay}
          onToggleAutoplay={toggleAutoplay}
          isLiked={currentSong ? !!likedSongs.find(s => s.id === currentSong.id) : false}
          onToggleLike={() => currentSong && toggleLike(currentSong)}
          queue={queue}
          showQueue={showQueue}
          onToggleQueue={toggleQueue}
          onPlayFromQueue={playFromQueue}
          onRefreshQueue={refreshQueue}
          onExtendQueue={extendQueue}
          onReorderQueue={reorderQueue}
          likedSongs={likedSongs}
          onToggleLikeInQueue={toggleLike}
          onAddToPlaylistFromQueue={(song) => {
            setSelectedSongForPlaylist(song);
            setShowAddToPlaylist(true);
          }}
        />
      )}

      <BottomNav
        currentView={currentView}
        onViewChange={(view) => {
          setCurrentView(view);
          closeExpandedSection();
        }}
      />

      {/* Create Playlist Modal */}
      {showCreatePlaylist && (
        <div className="modal-overlay" onClick={() => {
          setShowCreatePlaylist(false);
          setCreatePlaylistFromAddModal(false);
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Playlist</h2>
            <input
              type="text"
              placeholder="Playlist name"
              id="playlist-name-input"
              autoFocus
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  const name = e.target.value.trim();
                  if (name) {
                    const newPlaylist = createPlaylist(name);
                    if (newPlaylist) {
                      setShowCreatePlaylist(false);
                      if (createPlaylistFromAddModal) {
                        setCreatePlaylistFromAddModal(false);
                        setShowAddToPlaylist(true);
                      } else {
                        setCurrentView(`playlist-${newPlaylist.id}`);
                      }
                    } else {
                      // Show error for duplicate name
                      e.target.style.borderColor = '#ef4444';
                      e.target.placeholder = 'Playlist name already exists!';
                      e.target.value = '';
                    }
                  }
                }
              }}
            />
            <div className="modal-buttons">
              <button onClick={() => {
                setShowCreatePlaylist(false);
                setCreatePlaylistFromAddModal(false);
              }}>Cancel</button>
              <button
                className="primary"
                onClick={() => {
                  const input = document.getElementById('playlist-name-input');
                  const name = input.value.trim();
                  if (name) {
                    const newPlaylist = createPlaylist(name);
                    if (newPlaylist) {
                      setShowCreatePlaylist(false);
                      if (createPlaylistFromAddModal) {
                        setCreatePlaylistFromAddModal(false);
                        setShowAddToPlaylist(true);
                      } else {
                        setCurrentView(`playlist-${newPlaylist.id}`);
                      }
                    } else {
                      // Show error for duplicate name
                      input.style.borderColor = '#ef4444';
                      input.placeholder = 'Playlist name already exists!';
                      input.value = '';
                    }
                  }
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Playlist Modal */}
      {showAddToPlaylist && selectedSongForPlaylist && (
        <div className="modal-overlay" onClick={() => setShowAddToPlaylist(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add to Playlist</h2>
            <p className="modal-subtitle">"{selectedSongForPlaylist.title}"</p>
            
            {/* Create New Playlist Button */}
            <button
              className="create-playlist-btn"
              onClick={() => {
                setShowAddToPlaylist(false);
                setCreatePlaylistFromAddModal(true);
                setShowCreatePlaylist(true);
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              <span>Create New Playlist</span>
            </button>
            
            {playlists.length === 0 ? (
              <div className="empty-state">
                <p>No playlists yet. Create one above!</p>
              </div>
            ) : (
              <div className="playlist-list">
                {playlists.map(playlist => (
                  <div
                    key={playlist.id}
                    className="playlist-item"
                    onClick={() => {
                      addToPlaylist(playlist.id, selectedSongForPlaylist);
                      setShowAddToPlaylist(false);
                      setSelectedSongForPlaylist(null);
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
                    </svg>
                    <span>{playlist.name}</span>
                    <span className="song-count">({playlist.songs.length})</span>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-buttons">
              <button onClick={() => {
                setShowAddToPlaylist(false);
                setSelectedSongForPlaylist(null);
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Playlist Confirmation Modal */}
      {showDeletePlaylist && playlistToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeletePlaylist(false)}>
          <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Playlist?</h2>
            <p className="modal-subtitle">
              Are you sure you want to delete "{playlistToDelete.name}"? This action cannot be undone.
            </p>
            <div className="modal-info">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              <p>{playlistToDelete.songs.length} songs will be removed from this playlist</p>
            </div>
            <div className="modal-buttons">
              <button onClick={() => {
                setShowDeletePlaylist(false);
                setPlaylistToDelete(null);
              }}>
                Cancel
              </button>
              <button
                className="primary danger"
                onClick={() => {
                  deletePlaylist(playlistToDelete.id);
                  setShowDeletePlaylist(false);
                  setPlaylistToDelete(null);
                  setCurrentView('home');
                }}
              >
                Delete Playlist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Playlists Confirmation Modal */}
      {showClearPlaylistsModal && (
        <div className="modal-overlay" onClick={() => setShowClearPlaylistsModal(false)}>
          <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Clear All Playlists?</h2>
            <p className="modal-subtitle">
              Are you sure you want to delete all playlists? This action cannot be undone.
            </p>
            <div className="modal-info">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
              <p>{playlists.length} playlists will be permanently deleted</p>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowClearPlaylistsModal(false)}>
                Cancel
              </button>
              <button
                className="primary danger"
                onClick={confirmClearAllPlaylists}
              >
                Clear All Playlists
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear History Confirmation Modal */}
      {showClearHistory && (
        <div className="modal-overlay" onClick={() => setShowClearHistory(false)}>
          <div className="modal delete-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Clear Listening History?</h2>
            <p className="modal-subtitle">
              Are you sure you want to clear all listening history? This action cannot be undone.
            </p>
            <div className="modal-info">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <p>{listeningHistory.length} songs will be removed from your history</p>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowClearHistory(false)}>
                Cancel
              </button>
              <button
                className="primary danger"
                onClick={() => {
                  setListeningHistory([]);
                  setShowClearHistory(false);
                }}
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Album Saved as Playlist Modal */}
      {savedAlbumPlaylist && (
        <div className="modal-overlay" onClick={() => setSavedAlbumPlaylist(null)}>
          <div className="modal success-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon success">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="16 8 10 14 8 12"></polyline>
              </svg>
            </div>
            <h2>Album Saved!</h2>
            <p className="modal-subtitle">
              "{savedAlbumPlaylist.name}" has been added to your playlists with {savedAlbumPlaylist.songs.length} tracks.
            </p>
            <div className="modal-buttons">
              <button onClick={() => setSavedAlbumPlaylist(null)}>
                Close
              </button>
              <button
                className="primary"
                onClick={() => {
                  setCurrentView(`playlist-${savedAlbumPlaylist.id}`);
                  setSelectedAlbum(null);
                  setAlbumTracks([]);
                  setSavedAlbumPlaylist(null);
                }}
              >
                View Playlist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
