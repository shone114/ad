(function () {
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

  // Standard HTML tags that support element.attachShadow()
  const ALLOWED_SHADOW_TAGS = new Set([
    'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BODY', 'DIV', 'FOOTER',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'MAIN', 'NAV', 'P', 'SECTION', 'SPAN'
  ]);

  // User's custom WhatsApp ad assets list
  const CUSTOM_ASSETS = [
    'assets/WhatsApp Image 2026-09-13 at 8.43.29 AM (1).png',
    'assets/WhatsApp Image 2026-09-13 at 8.43.29 AM (2).png',
    'assets/WhatsApp Image 2026-09-13 at 8.43.29 AM (3).png',
    'assets/WhatsApp Image 2026-09-13 at 8.43.29 AM (4).png',
    'assets/WhatsApp Image 2026-09-13 at 8.43.29 AM (5).png',
    'assets/WhatsApp Image 2026-09-13 at 8.43.29 AM.png',
    'assets/WhatsApp Image 2026-09-13 at 8.43.30 AM (1).png',
    'assets/WhatsApp Image 2026-09-13 at 8.43.30 AM (2).png',
    'assets/WhatsApp Image 2026-09-13 at 8.43.30 AM (3).png',
    'assets/WhatsApp Image 2026-09-13 at 8.43.30 AM (4).png',
    'assets/WhatsApp Image 2026-09-13 at 8.43.30 AM.png'
  ];

  // Pre-load and cache creative asset natural aspect ratios
  const assetCache = [];

  CUSTOM_ASSETS.forEach((relativePath) => {
    const url = chrome.runtime.getURL(relativePath);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        assetCache.push({
          url: url,
          ratio: img.naturalWidth / img.naturalHeight
        });
      }
    };
    img.src = url;
  });

  // Audio Autoplay Policy Unlocker
  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    try {
      const a = new Audio();
      a.play().catch(() => {});
    } catch (e) {}
  }

  ['click', 'keydown', 'mousemove', 'pointerdown', 'touchstart'].forEach((evt) => {
    window.addEventListener(evt, unlockAudio, { once: true, capture: true });
  });

  /**
   * Safe Audio Player helper (creates fresh Audio instance per trigger)
   */
  function playSound(assetPath) {
    try {
      const url = chrome.runtime.getURL(assetPath);
      const audio = new Audio(url);
      audio.volume = 0.85;
      const promise = audio.play();
      if (promise !== undefined) {
        promise.catch(() => {});
      }
    } catch (e) {}
  }

  /**
   * Pick the asset whose natural aspect ratio is closest to targetRatio.
   */
  function getBestAssetUrl(targetRatio) {
    if (!assetCache.length) {
      const randomIndex = Math.floor(Math.random() * CUSTOM_ASSETS.length);
      return chrome.runtime.getURL(CUSTOM_ASSETS[randomIndex]);
    }

    let best = assetCache[0];
    let minDiff = Math.abs(best.ratio - targetRatio);

    for (let i = 1; i < assetCache.length; i++) {
      const diff = Math.abs(assetCache[i].ratio - targetRatio);
      if (diff < minDiff) {
        minDiff = diff;
        best = assetCache[i];
      }
    }
    return best.url;
  }

  /**
   * Core Renderer for Satirical Ad Markup (Shared between container replacement & independent popups)
   */
  function injectSatiricalContent(rootContainer, options = {}) {
    const {
      assetUrl = chrome.runtime.getURL('assets/satirical_ad.gif'),
      containerWidth = 300,
      containerHeight = 250,
      isPopup = false,
      onDismiss = null,
      wrapperTarget = null
    } = options;

    const wrapper = document.createElement('div');
    wrapper.className = isPopup ? 'satire-popup-wrapper' : 'satire-container-wrapper';

    wrapper.style.cssText =
      'position:relative; width:100%; height:100%; overflow:hidden; ' +
      'background:#050505; border:3px solid #ff0055; box-sizing:border-box; ' +
      'font-family:sans-serif; user-select:none; display:flex; flex-direction:column;';

    if (isPopup) {
      wrapper.style.borderRadius = '8px';
      wrapper.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8), 0 0 15px #ff0055';
    }

    // Initial random position for close button
    const initTop = Math.floor(Math.random() * 60) + 15;
    const initLeft = Math.floor(Math.random() * 65) + 15;

    wrapper.innerHTML = `
      <style>
        /* NEAR MISS QUICK JITTER ANIMATION */
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
          font-size: 14px;
          font-weight: bold;
          text-align: center;
          line-height: 24px;
          cursor: pointer;
          border: 2px solid #ffffff;
          border-radius: 4px;
          z-index: 50;
          user-select: none;
          box-shadow: 0 3px 6px rgba(0,0,0,0.6);
          transition: opacity 0.2s ease;
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
        }
        .main-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
      </style>
      <div class="evasive-btn" id="close-target" title="Close Ad">X</div>
      
      <div class="media-container">
        <img src="${assetUrl}" class="main-image" id="satire-img" alt="Satirical Ad" />
      </div>
    `;

    rootContainer.appendChild(wrapper);

    const imgEl = wrapper.querySelector('#satire-img');

    // Smart Aspect Ratio Fitting Logic
    if (imgEl) {
      imgEl.onload = () => {
        if (!imgEl.naturalWidth || !imgEl.naturalHeight) return;

        const assetAR = imgEl.naturalWidth / imgEl.naturalHeight;
        const containerAR = containerWidth / containerHeight;
        const relativeDiff = Math.abs(containerAR - assetAR) / assetAR;

        if (relativeDiff <= 0.15) {
          imgEl.style.objectFit = 'cover';
        } else {
          const newHeight = Math.round(containerWidth / assetAR);
          wrapper.style.height = `${newHeight}px`;
          if (wrapperTarget) {
            wrapperTarget.style.height = `${newHeight}px`;
          }
          imgEl.style.objectFit = 'cover';
        }
      };
    }

    // CATCHABLE EVASIVE MECHANICS
    let hasHadFirstMiss = false;
    let nearMissCooldown = false;
    let dodgeCount = 0;
    let dodgeCooldown = false;
    let isFatigued = false;

    const closeTarget = wrapper.querySelector('#close-target');

    if (closeTarget) {
      function handleProximity(clientX, clientY) {
        const btnRect = closeTarget.getBoundingClientRect();
        const btnCenterX = btnRect.left + btnRect.width / 2;
        const btnCenterY = btnRect.top + btnRect.height / 2;
        const distance = Math.hypot(clientX - btnCenterX, clientY - btnCenterY);

        // Near-miss audio & jitter check (~28px threshold)
        if (distance <= 28 && !nearMissCooldown) {
          nearMissCooldown = true;
          setTimeout(() => { nearMissCooldown = false; }, 250);

          if (!hasHadFirstMiss) {
            hasHadFirstMiss = true;
            playSound('assets/wrong1.mp3');
          } else {
            playSound('assets/wrong.mp3');
          }

          // Trigger quick-jitter burst
          wrapper.classList.remove('quick-jitter');
          void wrapper.offsetWidth; // Reflow
          wrapper.classList.add('quick-jitter');
          setTimeout(() => {
            wrapper.classList.remove('quick-jitter');
          }, 220);
        }

        // Tuned Catchable Dodge Mechanics (38px radius, 180ms cooldown, 3-dodge fatigue pause)
        if (distance <= 38 && !isFatigued && !dodgeCooldown) {
          dodgeCooldown = true;
          setTimeout(() => { dodgeCooldown = false; }, 180);

          dodgeCount++;

          const newTop = Math.floor(Math.random() * 60) + 15;
          const newLeft = Math.floor(Math.random() * 65) + 15;
          closeTarget.style.top = `${newTop}%`;
          closeTarget.style.left = `${newLeft}%`;

          // After 3 consecutive dodges, fatigue for 1.2s so the user can catch & click it!
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

      // Successful Close Click on Evasive X button
      closeTarget.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof onDismiss === 'function') {
          onDismiss();
        } else {
          playSound('assets/close.mp3');
          alert('ERROR: Action blocked by system policy!');
        }
      });
    }
  }

  function transformElement(element) {
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

    const targetRatio = width / height;
    const bestAssetUrl = getBestAssetUrl(targetRatio);

    try {
      const shadow = shadowTarget.attachShadow({ mode: 'open' });
      injectSatiricalContent(shadow, {
        assetUrl: bestAssetUrl,
        containerWidth: width,
        containerHeight: height,
        isPopup: false,
        wrapperTarget: shadowTarget
      });
    } catch (e) {
      console.warn('[Satirical Ad Replacer] Falling back to direct DOM insertion:', e);
      shadowTarget.innerHTML = '';
      injectSatiricalContent(shadowTarget, {
        assetUrl: bestAssetUrl,
        containerWidth: width,
        containerHeight: height,
        isPopup: false,
        wrapperTarget: shadowTarget
      });
    }
  }

  function executeScan() {
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

    // Play close.mp3 sound on dismissal
    playSound('assets/close.mp3');

    const index = activePopups.indexOf(popupElement);
    if (index !== -1) {
      activePopups.splice(index, 1);
    }
    if (popupElement.parentNode) {
      popupElement.parentNode.removeChild(popupElement);
    }
  }

  function spawnRandomPopup() {
    if (activePopups.length >= MAX_POPUPS) return;

    // Guaranteed 1:1 Alternating Spawn Sound (pop1 -> pop2 -> pop1 -> pop2)
    popSoundCounter++;
    const popSound = (popSoundCounter % 2 === 1) ? 'assets/pop1.mp3' : 'assets/pop2.mp3';
    playSound(popSound);

    // Random popup dimensions (250-400px width, 200-300px height)
    const popupWidth = Math.floor(Math.random() * 150) + 250;
    const popupHeight = Math.floor(Math.random() * 100) + 200;

    const viewportW = window.innerWidth || document.documentElement.clientWidth || 800;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 600;

    const maxLeft = Math.max(10, viewportW - popupWidth - 20);
    const maxTop = Math.max(10, viewportH - popupHeight - 20);

    const left = Math.floor(Math.random() * maxLeft) + 10;
    const top = Math.floor(Math.random() * maxTop) + 10;

    // Global Keyframe Animation Definition for Host Popup Element
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

    document.body.appendChild(popupDiv);
    activePopups.push(popupDiv);

    const targetRatio = popupWidth / popupHeight;
    const assetUrl = getBestAssetUrl(targetRatio);

    try {
      const shadow = popupDiv.attachShadow({ mode: 'open' });
      injectSatiricalContent(shadow, {
        assetUrl: assetUrl,
        containerWidth: popupWidth,
        containerHeight: popupHeight,
        isPopup: true,
        onDismiss: () => dismissPopup(popupDiv),
        wrapperTarget: popupDiv
      });
    } catch (e) {
      popupDiv.innerHTML = '';
      injectSatiricalContent(popupDiv, {
        assetUrl: assetUrl,
        containerWidth: popupWidth,
        containerHeight: popupHeight,
        isPopup: true,
        onDismiss: () => dismissPopup(popupDiv),
        wrapperTarget: popupDiv
      });
    }
  }

  function scheduleNextPopup() {
    const intervalMs = Math.floor(Math.random() * 15000) + 15000;
    setTimeout(() => {
      spawnRandomPopup();
      scheduleNextPopup();
    }, intervalMs);
  }

  // Keyboard 'Escape' key listener to dismiss the most recently spawned popup
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activePopups.length > 0) {
      const lastPopup = activePopups[activePopups.length - 1];
      dismissPopup(lastPopup);
    }
  });

  // Initial execution scan & popup scheduler start
  executeScan();
  scheduleNextPopup();

  // Dynamic DOM insertion observer
  const observer = new MutationObserver((mutations) => {
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
