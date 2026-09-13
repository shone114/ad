(function () {
  // Context Validity Guard: Prevents "Extension context invalidated" errors when extension reloads
  function isContextValid() {
    try {
      return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
    } catch (e) {
      return false;
    }
  }

  function safeGetURL(relativePath) {
    if (!isContextValid()) return '';
    try {
      return chrome.runtime.getURL(relativePath);
    } catch (e) {
      return '';
    }
  }

  const SELECTORS = [
    '.ad-slot',
    '.ad-banner',
    '.ad-container',
    '.advertisement',
    '.ad-wrapper',
    '.ad-box',
    '.ad-unit',
    '[id*="google_ads"]',
    '[id*="div-gpt-ad"]',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="adnxs.com"]',
    'iframe[src*="amazon-adsystem.com"]',
    'ins.adsbygoogle',
    '.trc_rbox_container',
    '.outbrain-template',
    '[class*="sponsored-post"]',
    '[aria-label="advertisement"]',
    '[aria-label="ad"]',
    '[data-ad-client]',
    '[data-ad-slot]'
  ];

  const PROCESSED_FLAG = 'data-satire-processed';

  const ALLOWED_SHADOW_TAGS = new Set([
    'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BODY', 'DIV', 'FOOTER',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'MAIN', 'NAV', 'P', 'SECTION', 'SPAN'
  ]);

  // Image & GIF Assets in assets/imgs/
  const CUSTOM_IMAGES = [
    'assets/imgs/1.png',
    'assets/imgs/2.jpg',
    'assets/imgs/3.jpg',
    'assets/imgs/4.jpg',
    'assets/imgs/5.png',
    'assets/imgs/6.png',
    'assets/imgs/7.png',
    'assets/imgs/8.jpg',
  ];

  // Video Ad Assets in assets/vids/ (POPUPS ONLY)
  const CUSTOM_VIDEOS = [
    'assets/vids/vidssave.com Sunlight _ Whatever be your age, hold on to the colours of your life! (Malayalam) 720P (online-video-cutter.com).mp4',
    'assets/vids/vidssave.com Washing Powder Nirma – Historic ad – Edit 1 720p.mp4'
  ];

  const recentAssets = [];

  /**
   * Video rarity set to 20% for high impact popups
   */
  function getRandomCreativeAsset(allowVideo = false) {
    const isVideoChoice = allowVideo && (Math.random() < 0.20);
    const pool = isVideoChoice ? CUSTOM_VIDEOS : CUSTOM_IMAGES;

    const available = pool.filter((path) => !recentAssets.includes(path));
    const finalPool = available.length > 0 ? available : pool;

    const chosenPath = finalPool[Math.floor(Math.random() * finalPool.length)];

    recentAssets.push(chosenPath);
    if (recentAssets.length > 6) {
      recentAssets.shift();
    }

    const isVideo = chosenPath.endsWith('.mp4') || chosenPath.endsWith('.webm');
    return {
      url: safeGetURL(chosenPath),
      relativePath: chosenPath,
      isVideo: isVideo
    };
  }

  // Audio Autoplay Policy Unlocker
  let audioUnlocked = false;
  function unlockAudio() {
    if (!isContextValid()) return;
    if (audioUnlocked) return;
    audioUnlocked = true;
    try {
      const a = new Audio();
      a.play().catch(() => { });
    } catch (e) { }

    // Unmute & set max volume (1.0) on video ads
    document.querySelectorAll('video').forEach((v) => {
      v.muted = false;
      v.volume = 1.0;
    });

    activePopups.forEach((popup) => {
      if (popup.shadowRoot) {
        const v = popup.shadowRoot.querySelector('video');
        if (v) {
          v.muted = false;
          v.volume = 1.0;
        }
      }
    });
  }

  ['click', 'keydown', 'mousemove', 'pointerdown', 'touchstart'].forEach((evt) => {
    window.addEventListener(evt, unlockAudio, { capture: true });
  });

  /**
   * Sound Player helper
   */
  function playSFX(assetPath) {
    if (!isContextValid()) return;
    try {
      const url = safeGetURL(assetPath);
      if (!url) return;
      const audio = new Audio(url);
      audio.volume = 0.85;
      const promise = audio.play();
      if (promise !== undefined) {
        promise.catch(() => { });
      }
    } catch (e) { }
  }

  /**
   * Fits media (Image or Video) to container aspect ratio
   */
  function fitMediaToContainer(mediaEl, wrapper, curWidth, curHeight, wrapperTarget, isVideo) {
    const getAspect = () => {
      if (isVideo) {
        return (mediaEl.videoWidth && mediaEl.videoHeight)
          ? mediaEl.videoWidth / mediaEl.videoHeight
          : null;
      }
      return (mediaEl.naturalWidth && mediaEl.naturalHeight)
        ? mediaEl.naturalWidth / mediaEl.naturalHeight
        : null;
    };

    const applyFit = () => {
      const assetAR = getAspect();
      if (!assetAR) return;

      const containerAR = curWidth / curHeight;
      const relativeDiff = Math.abs(containerAR - assetAR) / assetAR;

      if (relativeDiff <= 0.15) {
        mediaEl.style.objectFit = 'cover';
      } else {
        const newHeight = Math.round(curWidth / assetAR);
        wrapper.style.height = `${newHeight}px`;
        if (wrapperTarget) {
          wrapperTarget.style.height = `${newHeight}px`;
        }
        mediaEl.style.objectFit = 'cover';
      }
    };

    if (isVideo) {
      if (mediaEl.readyState >= 1) {
        applyFit();
      } else {
        mediaEl.addEventListener('loadedmetadata', applyFit, { once: true });
      }
    } else {
      if (mediaEl.complete && mediaEl.naturalWidth) {
        applyFit();
      } else {
        mediaEl.addEventListener('load', applyFit, { once: true });
      }
    }
  }

  /**
   * Core Renderer for Satirical Ad Markup
   */
  function injectSatiricalContent(rootContainer, options = {}) {
    if (!isContextValid()) return;

    const {
      isPopup = false,
      containerWidth = 300,
      containerHeight = 250,
      onDismiss = null,
      wrapperTarget = null
    } = options;

    const creative = options.creative || getRandomCreativeAsset(isPopup);

    const wrapper = document.createElement('div');
    wrapper.className = isPopup ? 'satire-popup-wrapper' : 'satire-container-wrapper';

    wrapper.style.cssText =
      'position:relative; width:100%; height:100%; overflow:hidden; ' +
      'background:#0a0a0c; border-radius:8px; box-sizing:border-box; ' +
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; ' +
      'user-select:none; display:flex; flex-direction:column; ' +
      (isPopup
        ? 'border:1px solid rgba(255,255,255,0.15); box-shadow:0 12px 36px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.2);'
        : 'box-shadow:0 4px 12px rgba(0,0,0,0.15); border:1px solid rgba(255,255,255,0.08);');

    const initTop = Math.floor(Math.random() * 60) + 15;
    const initLeft = Math.floor(Math.random() * 65) + 15;

    const mediaHtml = creative.isVideo
      ? `<video src="${creative.url}" class="main-media" id="satire-media" autoplay loop playsinline></video>`
      : `<img src="${creative.url}" class="main-media" id="satire-media" alt="Satirical Ad" />`;

    wrapper.innerHTML = `
      <style>
        @keyframes quick-jitter {
          0% { transform: translate(0, 0); }
          25% { transform: translate(-8px, 5px); }
          50% { transform: translate(8px, -5px); }
          75% { transform: translate(-5px, -6px); }
          100% { transform: translate(0, 0); }
        }
        .quick-jitter {
          animation: quick-jitter 0.2s ease-in-out !important;
        }

        .evasive-btn {
          position: absolute;
          top: ${initTop}%;
          left: ${initLeft}%;
          width: 24px;
          height: 24px;
          background: #ff0033;
          color: #ffffff;
          font-size: 13px;
          font-weight: bold;
          text-align: center;
          line-height: 24px;
          cursor: pointer;
          border: 1.5px solid #ffffff;
          border-radius: 4px;
          z-index: 50;
          user-select: none;
          box-shadow: 0 3px 8px rgba(0,0,0,0.5);
          transition: top 0.18s ease-out, left 0.18s ease-out, opacity 0.2s ease;
        }

        .media-container {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000000;
          border-radius: 7px;
        }
        .main-media {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
      </style>
      <div class="evasive-btn" id="close-target" title="Close Ad">X</div>
      
      <div class="media-container">
        ${mediaHtml}
      </div>
    `;

    rootContainer.appendChild(wrapper);

    const mediaEl = wrapper.querySelector('#satire-media');

    if (mediaEl && !creative.isVideo) {
      mediaEl.onerror = () => {
        const fallbackAsset = getRandomCreativeAsset(false);
        if (fallbackAsset.url && fallbackAsset.url !== mediaEl.src) {
          mediaEl.src = fallbackAsset.url;
        }
      };
    }

    if (mediaEl) {
      fitMediaToContainer(mediaEl, wrapper, containerWidth, containerHeight, wrapperTarget, creative.isVideo);

      if (creative.isVideo) {
        mediaEl.volume = 1.0; // Boosted video volume to max (1.0)
        mediaEl.muted = !audioUnlocked;
        const playPromise = mediaEl.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            mediaEl.muted = true;
            mediaEl.play();
          });
        }
      }
    }

    if (!isPopup && wrapperTarget && window.ResizeObserver) {
      let lastW = containerWidth;
      let lastH = containerHeight;
      const ro = new ResizeObserver((entries) => {
        if (!isContextValid()) {
          ro.disconnect();
          return;
        }
        for (const entry of entries) {
          const cr = entry.contentRect;
          if (cr.width <= 0 || cr.height <= 0) continue;
          if (Math.abs(cr.width - lastW) > 10 || Math.abs(cr.height - lastH) > 10) {
            lastW = cr.width;
            lastH = cr.height;
            if (mediaEl) {
              fitMediaToContainer(mediaEl, wrapper, cr.width, cr.height, wrapperTarget, creative.isVideo);
            }
          }
        }
      });
      ro.observe(wrapperTarget);
    }

    let hasHadFirstMiss = false;
    let nearMissCooldown = false;
    let dodgeCount = 0;
    let dodgeCooldown = false;
    let isFatigued = false;

    const closeTarget = wrapper.querySelector('#close-target');

    if (closeTarget) {
      function handleProximity(clientX, clientY) {
        if (!isContextValid()) return;
        const btnRect = closeTarget.getBoundingClientRect();
        const btnCenterX = btnRect.left + btnRect.width / 2;
        const btnCenterY = btnRect.top + btnRect.height / 2;
        const distance = Math.hypot(clientX - btnCenterX, clientY - btnCenterY);

        if (distance <= 28 && !nearMissCooldown) {
          nearMissCooldown = true;
          setTimeout(() => { nearMissCooldown = false; }, 400);

          if (!hasHadFirstMiss) {
            hasHadFirstMiss = true;
            playSFX('assets/fx/wrong1.mp3');
          } else {
            playSFX('assets/fx/wrong.mp3');
          }

          wrapper.classList.remove('quick-jitter');
          void wrapper.offsetWidth;
          wrapper.classList.add('quick-jitter');
          setTimeout(() => {
            wrapper.classList.remove('quick-jitter');
          }, 220);
        }

        if (distance <= 38 && !isFatigued && !dodgeCooldown) {
          dodgeCooldown = true;
          setTimeout(() => { dodgeCooldown = false; }, 180);

          dodgeCount++;

          const newTop = Math.floor(Math.random() * 60) + 15;
          const newLeft = Math.floor(Math.random() * 65) + 15;
          closeTarget.style.top = `${newTop}%`;
          closeTarget.style.left = `${newLeft}%`;

          if (dodgeCount >= 3) {
            isFatigued = true;
            closeTarget.style.opacity = '0.7';
            closeTarget.title = 'Click to Close (Button Tired!)';

            setTimeout(() => {
              isFatigued = false;
              dodgeCount = 0;
              closeTarget.style.opacity = '1';
              closeTarget.title = 'Close Ad';
            }, 1200);
          }
        }
      }

      wrapper.addEventListener('mousemove', (e) => {
        handleProximity(e.clientX, e.clientY);
      });

      closeTarget.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof onDismiss === 'function') {
          onDismiss();
        } else {
          playSFX('assets/fx/close.mp3');
          alert('ERROR: Action blocked by system policy!');
        }
      });
    }
  }

  function transformElement(element) {
    if (!isContextValid()) return;
    if (!element || element.hasAttribute(PROCESSED_FLAG)) return;
    element.setAttribute(PROCESSED_FLAG, 'true');

    const bounds = element.getBoundingClientRect();
    const width = bounds.width > 0 ? bounds.width : (element.offsetWidth || 300);
    const height = bounds.height > 0 ? bounds.height : (element.offsetHeight || 250);

    const tagName = element.tagName ? element.tagName.toUpperCase() : '';
    const canAttachShadow = ALLOWED_SHADOW_TAGS.has(tagName) || tagName.includes('-');

    let shadowTarget = element;

    if (!canAttachShadow) {
      const replacementDiv = document.createElement('div');
      replacementDiv.setAttribute(PROCESSED_FLAG, 'true');
      replacementDiv.className = element.className || '';
      if (element.id) replacementDiv.id = element.id + '-satire';

      replacementDiv.style.cssText = element.style.cssText;
      replacementDiv.style.width = `${width}px`;
      replacementDiv.style.height = `${height}px`;
      replacementDiv.style.display = 'block';

      if (element.parentNode) {
        element.parentNode.replaceChild(replacementDiv, element);
      }
      shadowTarget = replacementDiv;
    } else {
      element.innerHTML = '';
      element.style.width = `${width}px`;
      element.style.height = `${height}px`;
      element.style.display = 'block';
    }

    const creative = getRandomCreativeAsset(false);

    try {
      const shadow = shadowTarget.attachShadow({ mode: 'open' });
      injectSatiricalContent(shadow, {
        creative: creative,
        containerWidth: width,
        containerHeight: height,
        isPopup: false,
        wrapperTarget: shadowTarget
      });
    } catch (e) {
      console.warn('[Satirical Ad Replacer] Falling back to direct DOM insertion:', e);
      shadowTarget.innerHTML = '';
      injectSatiricalContent(shadowTarget, {
        creative: creative,
        containerWidth: width,
        containerHeight: height,
        isPopup: false,
        wrapperTarget: shadowTarget
      });
    }
  }

  function executeScan() {
    if (!isContextValid()) return;
    try {
      const combinedSelector = SELECTORS.join(',');
      const elements = document.querySelectorAll(combinedSelector);
      elements.forEach((el) => transformElement(el));
    } catch (err) {
      console.error('[Satirical Ad Replacer] Scan error:', err);
    }
  }

  // INDEPENDENT POPUP AD SPAWNING ENGINE
  const activePopups = [];
  const MAX_POPUPS = 4;
  let popSoundCounter = 0;

  function dismissPopup(popupElement) {
    if (!popupElement) return;

    playSFX('assets/fx/close.mp3');

    const index = activePopups.indexOf(popupElement);
    if (index !== -1) {
      activePopups.splice(index, 1);
    }
    if (popupElement.parentNode) {
      popupElement.parentNode.removeChild(popupElement);
    }
  }

  /**
   * Anti-Stacking Scatter Algorithm:
   * Tests 12 candidate positions across the viewport and picks the candidate
   * position farthest from all currently active popups!
   */
  function getBestScatterPosition(popupWidth, popupHeight) {
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 800;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 600;

    const maxLeft = Math.max(10, viewportW - popupWidth - 25);
    const maxTop = Math.max(10, viewportH - popupHeight - 25);

    if (activePopups.length === 0) {
      return {
        left: Math.floor(Math.random() * maxLeft) + 10,
        top: Math.floor(Math.random() * maxTop) + 10
      };
    }

    let bestPos = null;
    let bestMinDist = -1;

    for (let i = 0; i < 12; i++) {
      const candLeft = Math.floor(Math.random() * maxLeft) + 10;
      const candTop = Math.floor(Math.random() * maxTop) + 10;

      let minDistToOther = Infinity;

      for (const existingPopup of activePopups) {
        const rect = existingPopup.getBoundingClientRect();
        const dist = Math.hypot(candLeft - rect.left, candTop - rect.top);
        if (dist < minDistToOther) {
          minDistToOther = dist;
        }
      }

      if (minDistToOther > bestMinDist) {
        bestMinDist = minDistToOther;
        bestPos = { left: candLeft, top: candTop };
      }
    }

    return bestPos || {
      left: Math.floor(Math.random() * maxLeft) + 10,
      top: Math.floor(Math.random() * maxTop) + 10
    };
  }

  function spawnRandomPopup() {
    if (!isContextValid()) return;
    if (activePopups.length >= MAX_POPUPS) return;

    const creative = getRandomCreativeAsset(true);

    // Dimension Selection: Video popups are larger and more cinematic
    let popupWidth, popupHeight;
    if (creative.isVideo) {
      popupWidth = Math.floor(Math.random() * 140) + 380;  // 380px - 520px width
      popupHeight = Math.floor(Math.random() * 100) + 280; // 280px - 380px height
    } else {
      popupWidth = Math.floor(Math.random() * 130) + 250;  // 250px - 380px width
      popupHeight = Math.floor(Math.random() * 80) + 200;  // 200px - 280px height
    }

    // Scatter algorithm prevents popups from stacking directly on top of each other
    const { left, top } = getBestScatterPosition(popupWidth, popupHeight);

    if (!document.getElementById('satire-global-styles')) {
      const globalStyle = document.createElement('style');
      globalStyle.id = 'satire-global-styles';
      globalStyle.textContent = `
        @keyframes sat-pop-in {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
      `;
      (document.head || document.documentElement).appendChild(globalStyle);
    }

    const popupDiv = document.createElement('div');
    popupDiv.setAttribute(PROCESSED_FLAG, 'true');
    popupDiv.style.cssText =
      `position:fixed; z-index:999999; left:${left}px; top:${top}px; ` +
      `width:${popupWidth}px; height:${popupHeight}px; display:block; ` +
      `animation: sat-pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; ` +
      `transform-origin: center center;`;

    let success = false;

    try {
      const shadow = popupDiv.attachShadow({ mode: 'open' });
      injectSatiricalContent(shadow, {
        creative: creative,
        containerWidth: popupWidth,
        containerHeight: popupHeight,
        isPopup: true,
        onDismiss: () => dismissPopup(popupDiv),
        wrapperTarget: popupDiv
      });
      document.body.appendChild(popupDiv);
      activePopups.push(popupDiv);
      success = true;
    } catch (e) {
      try {
        popupDiv.innerHTML = '';
        injectSatiricalContent(popupDiv, {
          creative: creative,
          containerWidth: popupWidth,
          containerHeight: popupHeight,
          isPopup: true,
          onDismiss: () => dismissPopup(popupDiv),
          wrapperTarget: popupDiv
        });
        document.body.appendChild(popupDiv);
        activePopups.push(popupDiv);
        success = true;
      } catch (err) {
        console.error('[Satirical Ad Replacer] Popup render error:', err);
      }
    }

    if (success) {
      popSoundCounter++;
      const popSound = (popSoundCounter % 2 === 1) ? 'assets/fx/pop1.mp3' : 'assets/fx/pop2.mp3';
      playSFX(popSound);
    }
  }

  function scheduleNextPopup() {
    if (!isContextValid()) return;
    const intervalMs = Math.floor(Math.random() * 2000) + 4000;
    setTimeout(() => {
      if (isContextValid()) {
        spawnRandomPopup();
        scheduleNextPopup();
      }
    }, intervalMs);
  }

  window.addEventListener('keydown', (e) => {
    if (!isContextValid()) return;
    if (e.key === 'Escape' && activePopups.length > 0) {
      const lastPopup = activePopups[activePopups.length - 1];
      dismissPopup(lastPopup);
    }
  });

  executeScan();
  scheduleNextPopup();

  const observer = new MutationObserver((mutations) => {
    if (!isContextValid()) {
      observer.disconnect();
      return;
    }
    let nodeAdded = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        nodeAdded = true;
        break;
      }
    }
    if (nodeAdded) {
      executeScan();
    }
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
})();
