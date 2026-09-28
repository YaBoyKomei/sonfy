import React, { useRef, useEffect, useState } from 'react';
import { HeartIcon } from './Icons';
import { getOptimizedImageUrl, lazyLoadImage } from '../utils/performance';

function SongCard({ song, currentSong, isLiked, onPlay, onToggleLike, onAddToPlaylist, onRemoveFromPlaylist, onPlayNext, onAddToQueue, showRemove }) {
  const imgRef = useRef(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (imgRef.current) {
      lazyLoadImage(imgRef.current);
    }
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showMenu]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPlay(song);
    }
  };

  const handleMenuClick = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleAddToPlaylist = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    onAddToPlaylist(song);
  };

  const handlePlayNext = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    if (onPlayNext) {
      onPlayNext(song);
    }
  };

  return (
    <article
      className={`song-card ${currentSong?.id === song.id ? 'active' : ''} ${showMenu ? 'menu-open' : ''}`}
      role="button"
      tabIndex={0}
      onKeyPress={handleKeyPress}
      aria-label={`Play ${song.title} by ${song.artist}`}
      itemScope
      itemType="https://schema.org/MusicRecording"
    >
      <button 
        className={`like-button ${isLiked ? 'liked' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleLike(song);
        }}
        title={isLiked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
        aria-label={isLiked ? `Remove ${song.title} from liked songs` : `Add ${song.title} to liked songs`}
      >
        <HeartIcon filled={isLiked} />
      </button>
      {showRemove ? (
        <button
          className="remove-from-playlist-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveFromPlaylist(song);
          }}
          title="Remove from Playlist"
          aria-label={`Remove ${song.title} from playlist`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      ) : (
        <div className="song-menu-container" ref={menuRef}>
          <button
            className="song-menu-btn"
            onClick={handleMenuClick}
            title="More options"
            aria-label={`More options for ${song.title}`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"></circle>
              <circle cx="12" cy="12" r="2"></circle>
              <circle cx="12" cy="19" r="2"></circle>
            </svg>
          </button>
          {showMenu && (
            <div className="song-menu-dropdown">
              <button onClick={handlePlayNext}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                </svg>
                Play Next
              </button>
              {onAddToQueue && (
                <button onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(false);
                  onAddToQueue(song);
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Add to Queue
                </button>
              )}
              <button onClick={handleAddToPlaylist}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add to Playlist
              </button>
            </div>
          )}
        </div>
      )}
      <div className="song-card-content" onClick={() => onPlay(song)}>
        <div className="song-image-wrapper">
          <img 
            ref={imgRef}
            data-src={getOptimizedImageUrl(song.cover, 300)}
            alt={`${song.title} album cover`}
            className="lazy song-cover"
            loading="lazy"
            itemProp="image"
            onLoad={(e) => e.target.classList.add('loaded')}
          />
          <div className="song-gradient-overlay"></div>
          <div className="song-details-overlay">
            <div className="song-info">
              <h3 itemProp="name">{song.title}</h3>
              <p itemProp="byArtist" itemScope itemType="https://schema.org/MusicGroup">
                <span itemProp="name">{song.artist}</span>
              </p>
            </div>
            <div className="song-play-circle">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          {song.duration && (
            <meta itemProp="duration" content={song.duration} />
          )}
          {song.album && (
            <meta itemProp="inAlbum" content={song.album} />
          )}
        </div>
      </div>
    </article>
  );
}

export default SongCard;
