// Performance optimization utilities

// Lazy loading for images
export const lazyLoadImage = (img) => {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const image = entry.target;
          image.src = image.dataset.src;
          image.classList.remove('lazy');
          imageObserver.unobserve(image);
        }
      });
    });
    
    imageObserver.observe(img);
  } else {
    // Fallback for browsers without IntersectionObserver
    img.src = img.dataset.src;
  }
};

// Debounce function for search
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function for scroll events
export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Optimize images for different screen sizes
export const getOptimizedImageUrl = (originalUrl, width = 300, quality = 80) => {
  if (!originalUrl) return '';
  
  // For YouTube thumbnails, we can request different sizes
  if (originalUrl.includes('ytimg.com')) {
    // YouTube thumbnail optimization
    if (width <= 120) return originalUrl.replace(/\/[^/]*\.jpg/, '/default.jpg');
    if (width <= 320) return originalUrl.replace(/\/[^/]*\.jpg/, '/mqdefault.jpg');
    if (width <= 480) return originalUrl.replace(/\/[^/]*\.jpg/, '/hqdefault.jpg');
    return originalUrl.replace(/\/[^/]*\.jpg/, '/maxresdefault.jpg');
  }
  
  return originalUrl;
};

// Preload next songs for better UX
export const preloadNextSongs = (songs, currentIndex, count = 3) => {
  const nextSongs = songs.slice(currentIndex + 1, currentIndex + 1 + count);
  
  nextSongs.forEach(song => {
    if (song.thumbnail) {
      const img = new Image();
      img.src = getOptimizedImageUrl(song.thumbnail, 300);
    }
  });
};

// Service Worker registration for caching
export const registerServiceWorker = () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration);
        })
        .catch((registrationError) => {
          console.log('SW registration failed: ', registrationError);
        });
    });
  }
};

// Critical CSS inlining
export const inlineCriticalCSS = () => {
  const criticalCSS = `
    /* Critical CSS for above-the-fold content */
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: #000;
      color: #fff;
    }
    
    .app {
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 50vh;
    }
    
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #333;
      border-top: 4px solid #a78bfa;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  
  const style = document.createElement('style');
  style.textContent = criticalCSS;
  document.head.appendChild(style);
};

// Web Vitals tracking
export const trackWebVitals = () => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    // Track Largest Contentful Paint (LCP)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      console.log('LCP:', lastEntry.startTime);
      
      // Send to analytics if needed
      if (window.gtag) {
        window.gtag('event', 'web_vitals', {
          name: 'LCP',
          value: Math.round(lastEntry.startTime),
          event_category: 'Performance'
        });
      }
    }).observe({ entryTypes: ['largest-contentful-paint'] });
    
    // Track First Input Delay (FID)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry) => {
        console.log('FID:', entry.processingStart - entry.startTime);
        
        if (window.gtag) {
          window.gtag('event', 'web_vitals', {
            name: 'FID',
            value: Math.round(entry.processingStart - entry.startTime),
            event_category: 'Performance'
          });
        }
      });
    }).observe({ entryTypes: ['first-input'] });
    
    // Track Cumulative Layout Shift (CLS)
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      console.log('CLS:', clsValue);
      
      if (window.gtag) {
        window.gtag('event', 'web_vitals', {
          name: 'CLS',
          value: Math.round(clsValue * 1000),
          event_category: 'Performance'
        });
      }
    }).observe({ entryTypes: ['layout-shift'] });
  }
};