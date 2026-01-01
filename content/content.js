class RedditMediaGallery {
  constructor() {
    this.container = null;
    this.posts = [];
    this.currentIndex = 0;
    this.galleryIndex = 0;
    this.settings = {
      columns: 4,
      aspectRatio: 'square',
      theme: 'dark',
      showNSFW: false
    };
    this.sort = 'hot';
    this.after = null;
    this.loading = false;
    this.subreddit = null;
    this.username = null;
    this.isGalleryOpen = false;
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.injectToggleButton();
    this.setupKeyboardShortcuts();
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSettings' }, (settings) => {
        if (settings) {
          this.settings = settings;
        }
        resolve();
      });
    });
  }

  saveSettings() {
    chrome.runtime.sendMessage({ action: 'saveSettings', settings: this.settings });
  }

  injectToggleButton() {
    const btn = document.createElement('button');
    btn.className = 'rmg-floating-btn';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
      <circle cx="6.5" cy="6.5" r="1.5" fill="white" stroke="none"/>
      <path d="M14 21l3.5-4.5 3.5 4.5" fill="white" stroke="none"/>
    </svg>`;
    btn.title = 'Open Griddit';
    btn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ff5722 0%, #ff4500 100%);
      border: none;
      color: white;
      cursor: pointer;
      z-index: 99999;
      box-shadow: 0 4px 15px rgba(255,69,0,0.4);
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 6px 20px rgba(255,69,0,0.5)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 15px rgba(255,69,0,0.4)';
    });
    btn.addEventListener('click', () => this.openGallery());
    document.body.appendChild(btn);
  }

  parseCurrentPage() {
    const path = window.location.pathname;
    const subredditMatch = path.match(/\/r\/([^\/]+)/);
    const userMatch = path.match(/\/u(?:ser)?\/([^\/]+)/);
    
    if (subredditMatch) {
      this.subreddit = subredditMatch[1];
      this.username = null;
    } else if (userMatch) {
      this.username = userMatch[1];
      this.subreddit = null;
    } else {
      this.subreddit = null;
      this.username = null;
    }
  }

  async openGallery() {
    this.parseCurrentPage();
    this.isGalleryOpen = true;
    this.posts = [];
    this.after = null;
    
    this.createContainer();
    await this.loadPosts();
    this.renderGallery();
  }

  closeGallery() {
    this.isGalleryOpen = false;
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  createContainer() {
    if (this.container) {
      this.container.remove();
    }

    this.container = document.createElement('div');
    this.container.className = `rmg-gallery-container ${this.settings.theme === 'light' ? 'rmg-light' : ''}`;
    document.body.appendChild(this.container);
  }

  async loadPosts() {
    if (this.loading) return;
    this.loading = true;

    let url;
    if (this.subreddit) {
      url = `https://www.reddit.com/r/${this.subreddit}/${this.sort}.json?limit=50`;
    } else if (this.username) {
      url = `https://www.reddit.com/user/${this.username}/submitted.json?sort=${this.sort}&limit=50`;
    } else {
      url = `https://www.reddit.com/${this.sort}.json?limit=50`;
    }

    if (this.after) {
      url += `&after=${this.after}`;
    }

    try {
      const response = await fetch(url);
      const data = await response.json();
      
      const mediaPosts = data.data.children
        .filter(post => this.hasMedia(post.data))
        .map(post => this.parsePost(post.data));
      
      this.posts = [...this.posts, ...mediaPosts];
      this.after = data.data.after;
    } catch (error) {
      console.error('Failed to load posts:', error);
    }

    this.loading = false;
  }

  hasMedia(post) {
    if (post.is_self) return false;
    if (post.post_hint === 'image') return true;
    if (post.post_hint === 'hosted:video') return true;
    if (post.is_gallery) return true;
    if (post.url && /\.(jpg|jpeg|png|gif|webp|mp4|webm)(\?.*)?$/i.test(post.url)) return true;
    if (post.preview && post.preview.images) return true;
    if (post.media && post.media.reddit_video) return true;
    return false;
  }

  parsePost(post) {
    const mediaItems = [];
    
    if (post.is_gallery && post.gallery_data && post.media_metadata) {
      for (const item of post.gallery_data.items) {
        const media = post.media_metadata[item.media_id];
        if (media) {
          const url = media.s?.u?.replace(/&amp;/g, '&') || 
                     media.s?.gif?.replace(/&amp;/g, '&') ||
                     `https://i.redd.it/${item.media_id}.jpg`;
          mediaItems.push({
            type: media.e === 'AnimatedImage' ? 'gif' : 'image',
            url: url,
            thumbnail: media.p?.[media.p.length - 1]?.u?.replace(/&amp;/g, '&') || url
          });
        }
      }
    } else if (post.media?.reddit_video) {
      let thumbnail = null;
      if (post.preview?.images?.[0]) {
        thumbnail = post.preview.images[0].source?.url?.replace(/&amp;/g, '&') ||
                   post.preview.images[0].resolutions?.[post.preview.images[0].resolutions.length - 1]?.url?.replace(/&amp;/g, '&');
      } else if (post.thumbnail && post.thumbnail !== 'default' && post.thumbnail !== 'nsfw' && post.thumbnail !== 'spoiler') {
        thumbnail = post.thumbnail;
      }
      mediaItems.push({
        type: 'video',
        url: post.media.reddit_video.fallback_url,
        thumbnail: thumbnail
      });
    } else if (post.preview?.reddit_video_preview) {
      let thumbnail = null;
      if (post.preview?.images?.[0]) {
        thumbnail = post.preview.images[0].source?.url?.replace(/&amp;/g, '&') ||
                   post.preview.images[0].resolutions?.[post.preview.images[0].resolutions.length - 1]?.url?.replace(/&amp;/g, '&');
      } else if (post.thumbnail && post.thumbnail !== 'default' && post.thumbnail !== 'nsfw' && post.thumbnail !== 'spoiler') {
        thumbnail = post.thumbnail;
      }
      mediaItems.push({
        type: 'video',
        url: post.preview.reddit_video_preview.fallback_url,
        thumbnail: thumbnail
      });
    } else if (post.url) {
      const url = post.url.replace(/&amp;/g, '&');
      const isVideo = /\.(mp4|webm)(\?.*)?$/i.test(url);
      const isGif = /\.gif(\?.*)?$/i.test(url);
      
      let thumbnail = null;
      if (post.preview?.images?.[0]) {
        thumbnail = post.preview.images[0].source?.url?.replace(/&amp;/g, '&') ||
                   post.preview.images[0].resolutions?.[post.preview.images[0].resolutions.length - 1]?.url?.replace(/&amp;/g, '&');
      } else if (post.thumbnail && post.thumbnail !== 'default' && post.thumbnail !== 'nsfw') {
        thumbnail = post.thumbnail;
      }
      
      mediaItems.push({
        type: isVideo ? 'video' : (isGif ? 'gif' : 'image'),
        url: url,
        thumbnail: thumbnail || url
      });
    }

    return {
      id: post.id,
      title: post.title,
      author: post.author,
      subreddit: post.subreddit,
      score: post.score,
      numComments: post.num_comments,
      created: post.created_utc,
      permalink: `https://www.reddit.com${post.permalink}`,
      nsfw: post.over_18,
      media: mediaItems
    };
  }

  renderGallery() {
    const themeClass = this.settings.theme === 'light' ? 'rmg-light' : '';
    
    this.container.innerHTML = `
      <div class="rmg-header">
        <div class="rmg-header-left">
          <div class="rmg-logo">Griddit</div>
          <div class="rmg-breadcrumbs">
            <span>›</span>
            ${this.subreddit ? `<a href="/r/${this.subreddit}">r/${this.subreddit}</a>` : ''}
            ${this.username ? `<a href="/user/${this.username}">u/${this.username}</a>` : ''}
            ${!this.subreddit && !this.username ? '<span>Front Page</span>' : ''}
          </div>
        </div>
        <div class="rmg-header-right">
          ${this.subreddit || this.username ? `
            <button class="rmg-btn" id="rmg-follow-btn">
              <span>+</span> Follow
            </button>
          ` : ''}
          <button class="rmg-close-btn" id="rmg-close">✕</button>
        </div>
      </div>
      
      <div class="rmg-controls">
        <div class="rmg-sort-tabs">
          <button class="rmg-sort-tab ${this.sort === 'hot' ? 'active' : ''}" data-sort="hot">Hot</button>
          <button class="rmg-sort-tab ${this.sort === 'new' ? 'active' : ''}" data-sort="new">New</button>
          <button class="rmg-sort-tab ${this.sort === 'top' ? 'active' : ''}" data-sort="top">Top</button>
          <button class="rmg-sort-tab ${this.sort === 'rising' ? 'active' : ''}" data-sort="rising">Rising</button>
        </div>
        
        <div class="rmg-search">
          <span class="rmg-search-icon">🔍</span>
          <input type="text" placeholder="Go to subreddit or user..." id="rmg-search-input">
        </div>
        
        <div class="rmg-control-group">
          <span class="rmg-control-label">Columns</span>
          <select class="rmg-select" id="rmg-columns">
            <option value="2" ${this.settings.columns === 2 ? 'selected' : ''}>2</option>
            <option value="3" ${this.settings.columns === 3 ? 'selected' : ''}>3</option>
            <option value="4" ${this.settings.columns === 4 ? 'selected' : ''}>4</option>
            <option value="5" ${this.settings.columns === 5 ? 'selected' : ''}>5</option>
            <option value="6" ${this.settings.columns === 6 ? 'selected' : ''}>6</option>
          </select>
        </div>
        
        <div class="rmg-control-group">
          <span class="rmg-control-label">Aspect</span>
          <select class="rmg-select" id="rmg-aspect">
            <option value="square" ${this.settings.aspectRatio === 'square' ? 'selected' : ''}>Square</option>
            <option value="portrait" ${this.settings.aspectRatio === 'portrait' ? 'selected' : ''}>Portrait</option>
            <option value="landscape" ${this.settings.aspectRatio === 'landscape' ? 'selected' : ''}>Landscape</option>
            <option value="auto" ${this.settings.aspectRatio === 'auto' ? 'selected' : ''}>Auto</option>
          </select>
        </div>
        
        <div class="rmg-control-group">
          <span class="rmg-control-label">Theme</span>
          <div class="rmg-toggle ${this.settings.theme === 'light' ? 'active' : ''}" id="rmg-theme-toggle"></div>
        </div>
        
        <div class="rmg-control-group">
          <span class="rmg-control-label">NSFW</span>
          <div class="rmg-toggle ${this.settings.showNSFW ? 'active' : ''}" id="rmg-nsfw-toggle"></div>
        </div>
      </div>
      
      <div class="rmg-grid rmg-grid-${this.settings.columns} rmg-aspect-${this.settings.aspectRatio}" id="rmg-grid">
        ${this.renderCards()}
      </div>
      
      ${this.loading ? '<div class="rmg-loading"><div class="rmg-spinner"></div></div>' : ''}
    `;

    this.attachEventListeners();
    this.setupInfiniteScroll();
  }

  renderCards() {
    if (this.posts.length === 0) {
      return `
        <div class="rmg-empty" style="grid-column: 1 / -1;">
          <div class="rmg-empty-icon">📷</div>
          <p>No media posts found</p>
        </div>
      `;
    }

    return this.posts.map((post, index) => {
      const firstMedia = post.media[0];
      if (!firstMedia) return '';

      const nsfwClass = post.nsfw && !this.settings.showNSFW ? 'rmg-nsfw-blur' : '';
      const thumbnail = firstMedia.thumbnail || firstMedia.url;
      const showAsImage = firstMedia.type !== 'video' || firstMedia.thumbnail;

      return `
        <div class="rmg-card ${nsfwClass}" data-index="${index}" data-type="${firstMedia.type}" data-video-url="${firstMedia.type === 'video' ? firstMedia.url : ''}">
          <div class="rmg-card-media">
            ${showAsImage ? `
              <img src="${thumbnail}" alt="${post.title}" loading="lazy">
            ` : `
              <video src="${firstMedia.url}" muted loop preload="metadata"></video>
            `}
            ${post.media.length > 1 ? `<div class="rmg-card-gallery-count">📷 ${post.media.length}</div>` : ''}
            ${firstMedia.type === 'video' ? `<div class="rmg-card-play-icon"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>` : ''}
            ${firstMedia.type === 'video' ? '<div class="rmg-card-badge">VIDEO</div>' : ''}
            ${firstMedia.type === 'gif' ? '<div class="rmg-card-badge">GIF</div>' : ''}
            ${post.nsfw ? '<div class="rmg-card-badge" style="background: #ff0000;">NSFW</div>' : ''}
          </div>
          <div class="rmg-card-overlay">
            <div class="rmg-card-title">${this.escapeHtml(post.title)}</div>
            <div class="rmg-card-meta">
              <span>r/${post.subreddit}</span>
              <span>⬆ ${this.formatNumber(post.score)}</span>
              <span>💬 ${this.formatNumber(post.numComments)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  attachEventListeners() {
    this.container.querySelector('#rmg-close').addEventListener('click', () => this.closeGallery());

    this.container.querySelectorAll('.rmg-sort-tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        this.sort = tab.dataset.sort;
        this.posts = [];
        this.after = null;
        await this.loadPosts();
        this.renderGallery();
      });
    });

    this.container.querySelector('#rmg-columns').addEventListener('change', (e) => {
      this.settings.columns = parseInt(e.target.value);
      this.saveSettings();
      const grid = this.container.querySelector('#rmg-grid');
      grid.className = `rmg-grid rmg-grid-${this.settings.columns} rmg-aspect-${this.settings.aspectRatio}`;
    });

    this.container.querySelector('#rmg-aspect').addEventListener('change', (e) => {
      this.settings.aspectRatio = e.target.value;
      this.saveSettings();
      const grid = this.container.querySelector('#rmg-grid');
      grid.className = `rmg-grid rmg-grid-${this.settings.columns} rmg-aspect-${this.settings.aspectRatio}`;
    });

    this.container.querySelector('#rmg-theme-toggle').addEventListener('click', (e) => {
      this.settings.theme = this.settings.theme === 'dark' ? 'light' : 'dark';
      this.saveSettings();
      e.target.classList.toggle('active');
      this.container.classList.toggle('rmg-light');
    });

    this.container.querySelector('#rmg-nsfw-toggle').addEventListener('click', (e) => {
      this.settings.showNSFW = !this.settings.showNSFW;
      this.saveSettings();
      e.target.classList.toggle('active');
      this.container.querySelectorAll('.rmg-card').forEach(card => {
        const index = parseInt(card.dataset.index);
        const post = this.posts[index];
        if (post?.nsfw) {
          card.classList.toggle('rmg-nsfw-blur', !this.settings.showNSFW);
        }
      });
    });

    this.container.querySelector('#rmg-search-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const value = e.target.value.trim();
        if (value.startsWith('r/')) {
          this.subreddit = value.substring(2);
          this.username = null;
        } else if (value.startsWith('u/')) {
          this.username = value.substring(2);
          this.subreddit = null;
        } else {
          this.subreddit = value;
          this.username = null;
        }
        this.posts = [];
        this.after = null;
        this.loadPosts().then(() => this.renderGallery());
      }
    });

    this.container.querySelectorAll('.rmg-card').forEach(card => {
      card.addEventListener('click', () => {
        const index = parseInt(card.dataset.index);
        this.openLightbox(index);
      });
      
      card.addEventListener('mouseenter', () => {
        const video = card.querySelector('video');
        if (video) {
          video.play().catch(() => {});
        }
      });
      
      card.addEventListener('mouseleave', () => {
        const video = card.querySelector('video');
        if (video) {
          try {
            video.pause();
            video.currentTime = 0;
          } catch (e) {}
        }
      });
    });

    const followBtn = this.container.querySelector('#rmg-follow-btn');
    if (followBtn) {
      followBtn.addEventListener('click', () => {
        if (this.subreddit) {
          chrome.runtime.sendMessage({ action: 'followSub', sub: this.subreddit });
          followBtn.innerHTML = '<span>✓</span> Following';
        } else if (this.username) {
          chrome.runtime.sendMessage({ action: 'followUser', user: this.username });
          followBtn.innerHTML = '<span>✓</span> Following';
        }
      });
    }
  }

  setupInfiniteScroll() {
    const observer = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting && !this.loading && this.after) {
        await this.loadPosts();
        const grid = this.container.querySelector('#rmg-grid');
        grid.innerHTML = this.renderCards();
        this.attachCardListeners();
      }
    }, { threshold: 0.1 });

    const sentinel = document.createElement('div');
    sentinel.style.height = '10px';
    this.container.appendChild(sentinel);
    observer.observe(sentinel);
  }

  attachCardListeners() {
    this.container.querySelectorAll('.rmg-card').forEach(card => {
      card.addEventListener('click', () => {
        const index = parseInt(card.dataset.index);
        this.openLightbox(index);
      });
      
      card.addEventListener('mouseenter', () => {
        const video = card.querySelector('video');
        if (video) {
          video.play().catch(() => {});
        }
      });
      
      card.addEventListener('mouseleave', () => {
        const video = card.querySelector('video');
        if (video) {
          try {
            video.pause();
            video.currentTime = 0;
          } catch (e) {}
        }
      });
    });
  }

  openLightbox(index) {
    this.currentIndex = index;
    this.galleryIndex = 0;
    this.renderLightbox();
  }

  closeLightbox() {
    const lightbox = document.querySelector('.rmg-lightbox');
    if (lightbox) lightbox.remove();
  }

  renderLightbox() {
    const post = this.posts[this.currentIndex];
    if (!post) return;

    const media = post.media[this.galleryIndex];
    if (!media) return;

    const existingLightbox = document.querySelector('.rmg-lightbox');
    if (existingLightbox) existingLightbox.remove();

    const lightbox = document.createElement('div');
    lightbox.className = 'rmg-lightbox';
    lightbox.innerHTML = `
      <button class="rmg-lightbox-close">✕</button>
      
      <div class="rmg-lightbox-actions">
        <button class="rmg-lightbox-btn" id="rmg-download">
          ⬇️ Download
        </button>
        <button class="rmg-lightbox-btn" id="rmg-save">
          💾 Save
        </button>
        <a class="rmg-lightbox-btn" href="${post.permalink}" target="_blank">
          🔗 Open Post
        </a>
      </div>
      
      ${this.currentIndex > 0 ? '<button class="rmg-lightbox-nav rmg-lightbox-prev">❮</button>' : ''}
      ${this.currentIndex < this.posts.length - 1 ? '<button class="rmg-lightbox-nav rmg-lightbox-next">❯</button>' : ''}
      
      <div class="rmg-lightbox-content">
        ${media.type === 'video' ? `
          <video src="${media.url}" controls autoplay loop></video>
        ` : `
          <img src="${media.url}" alt="${post.title}">
        `}
      </div>
      
      ${post.media.length > 1 ? `
        <div class="rmg-gallery-nav">
          ${post.media.map((_, i) => `
            <div class="rmg-gallery-dot ${i === this.galleryIndex ? 'active' : ''}" data-index="${i}"></div>
          `).join('')}
        </div>
      ` : ''}
      
      <div class="rmg-lightbox-info">
        <div class="rmg-lightbox-title">${this.escapeHtml(post.title)}</div>
        <div class="rmg-lightbox-meta">
          <span>r/${post.subreddit}</span>
          <span>u/${post.author}</span>
          <span>⬆ ${this.formatNumber(post.score)}</span>
          <span>💬 ${this.formatNumber(post.numComments)}</span>
        </div>
      </div>
    `;

    document.body.appendChild(lightbox);

    lightbox.querySelector('.rmg-lightbox-close').addEventListener('click', () => this.closeLightbox());
    
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
        this.closeLightbox();
      }
    });

    const prevBtn = lightbox.querySelector('.rmg-lightbox-prev');
    const nextBtn = lightbox.querySelector('.rmg-lightbox-next');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.currentIndex--;
        this.galleryIndex = 0;
        this.renderLightbox();
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.currentIndex++;
        this.galleryIndex = 0;
        this.renderLightbox();
      });
    }

    lightbox.querySelectorAll('.rmg-gallery-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        this.galleryIndex = parseInt(dot.dataset.index);
        this.renderLightbox();
      });
    });

    lightbox.querySelector('#rmg-download').addEventListener('click', () => {
      const filename = `reddit_${post.subreddit}_${post.id}_${this.galleryIndex}`;
      chrome.runtime.sendMessage({ 
        action: 'download', 
        url: media.url,
        filename: filename
      });
    });

    lightbox.querySelector('#rmg-save').addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'savePost', post: post });
      lightbox.querySelector('#rmg-save').innerHTML = '✓ Saved';
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!this.isGalleryOpen) return;

      const lightbox = document.querySelector('.rmg-lightbox');
      
      if (e.key === 'Escape') {
        if (lightbox) {
          this.closeLightbox();
        } else {
          this.closeGallery();
        }
      }

      if (lightbox) {
        if (e.key === 'ArrowLeft') {
          if (this.posts[this.currentIndex].media.length > 1 && this.galleryIndex > 0) {
            this.galleryIndex--;
          } else if (this.currentIndex > 0) {
            this.currentIndex--;
            this.galleryIndex = this.posts[this.currentIndex].media.length - 1;
          }
          this.renderLightbox();
        }
        
        if (e.key === 'ArrowRight') {
          const currentPost = this.posts[this.currentIndex];
          if (currentPost.media.length > 1 && this.galleryIndex < currentPost.media.length - 1) {
            this.galleryIndex++;
          } else if (this.currentIndex < this.posts.length - 1) {
            this.currentIndex++;
            this.galleryIndex = 0;
          }
          this.renderLightbox();
        }
      }
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
}

const gallery = new RedditMediaGallery();
