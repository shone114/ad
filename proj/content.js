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

  /**
   * Pick the asset whose natural aspect ratio is closest to targetRatio.
   * If cache is not populated yet, pick a random URL.
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

    wrapper.innerHTML = `
      <style>
        @keyframes blink-bg {
          0% { background-color: #ffff00; color: #ff0000; }
          50% { background-color: #ff0000; color: #ffff00; }
          100% { background-color: #ffff00; color: #ff0000; }
        }
        @keyframes pop-in {
          0% { transform: scale(0.3); opacity: 0; }
          70% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1.0); opacity: 1; }
        }
        .satire-popup-wrapper {
          animation: pop-in 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .urgency-banner {
          position: absolute; top: 0; left: 0; width: 100%;
          animation: blink-bg 0.8s infinite; font-weight: 900;
          font-size: 11px; text-align: center; line-height: 18px; z-index: 10;
          letter-spacing: 1px; text-transform: uppercase; box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        }
        .evasive-btn {
          position: absolute; top: 22px; right: 4px; width: 20px; height: 20px;
          background: #ff0033; color: #ffffff; font-size: 12px; font-weight: bold;
          text-align: center; line-height: 20px; cursor: pointer;
          border: 1px solid #ffffff; border-radius: 3px;
          z-index: 20; user-select: none; box-shadow: 0 2px 4px rgba(0,0,0,0.5);
          transition: top 0.1s ease, right 0.1s ease;
        }
        .honest-dismiss-btn {
          position: absolute; bottom: 4px; right: 4px; padding: 2px 6px;
          background: rgba(0, 0, 0, 0.75); color: #ffffff; font-size: 10px; font-weight: bold;
          text-align: center; cursor: pointer; border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 3px; z-index: 25; user-select: none;
        }
        .honest-dismiss-btn:hover {
          background: #ff0000; color: #ffffff;
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
      <div class="urgency-banner">⚠️ PRIZE EXPIRES IN: <span id="clock">05</span>s ⚠️</div>
      <div class="evasive-btn" id="close-target" title="Close Ad">X</div>
      ${isPopup ? '<div class="honest-dismiss-btn" id="honest-dismiss" title="Dismiss Popup (Esc)">✕ Close</div>' : ''}
      
      <div class="media-container">
        <img src="${assetUrl}" class="main-image" id="satire-img" alt="Satirical Ad" />
      </div>
    `;

    rootContainer.appendChild(wrapper);

    const imgEl = wrapper.querySelector('#satire-img');

    // PART 1: Smart Aspect Ratio Fitting Logic
    if (imgEl) {
      imgEl.onload = () => {
        if (!imgEl.naturalWidth || !imgEl.naturalHeight) return;

        const assetAR = imgEl.naturalWidth / imgEl.naturalHeight;
        const containerAR = containerWidth / containerHeight;

        // Relative aspect ratio difference
        const relativeDiff = Math.abs(containerAR - assetAR) / assetAR;

        if (relativeDiff <= 0.15) {
          // Close match (<=15% diff): keep container dimensions, object-fit: cover
          imgEl.style.objectFit = 'cover';
        } else {
          // Significant difference (>15% diff):
          // Keep container width fixed, recalculate wrapper height to match asset aspect ratio
          const newHeight = Math.round(containerWidth / assetAR);
          wrapper.style.height = `${newHeight}px`;

          if (wrapperTarget) {
            wrapperTarget.style.height = `${newHeight}px`;
          }

          imgEl.style.objectFit = 'cover';
        }
      };
    }

    // Infinite 5s countdown timer
    let seconds = 5;
    const clockEl = wrapper.querySelector('#clock');
    setInterval(() => {
      seconds--;
      if (seconds <= 0) seconds = 5;
      if (clockEl) clockEl.textContent = `0${seconds}`;
    }, 1000);

    // Evasive close button logic
    const closeTarget = wrapper.querySelector('#close-target');
    if (closeTarget) {
      closeTarget.addEventListener('mouseenter', () => {
        closeTarget.style.top = `${Math.floor(Math.random() * 60) + 20}%`;
        closeTarget.style.right = `${Math.floor(Math.random() * 60) + 10}%`;
      });
      closeTarget.addEventListener('click', (e) => {
        e.stopPropagation();
        alert('ERROR: Action blocked by system policy! Claiming prize mandatory.');
      });
    }

    // Honest dismiss button (for popups)
    const honestDismiss = wrapper.querySelector('#honest-dismiss');
    if (honestDismiss && typeof onDismiss === 'function') {
      honestDismiss.addEventListener('click', (e) => {
        e.stopPropagation();
        onDismiss();
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

    // Pick candidate asset closest to container's aspect ratio
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

  // PART 2 — INDEPENDENT POPUP AD SPAWNING ENGINE
  const activePopups = [];
  const MAX_POPUPS = 4;

  function dismissPopup(popupElement) {
    if (!popupElement) return;
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

    // Random popup dimensions (250-400px width, 200-300px height)
    const popupWidth = Math.floor(Math.random() * 150) + 250;
    const popupHeight = Math.floor(Math.random() * 100) + 200;

    // Viewport boundaries
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 800;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 600;

    const maxLeft = Math.max(10, viewportW - popupWidth - 20);
    const maxTop = Math.max(10, viewportH - popupHeight - 20);

    const left = Math.floor(Math.random() * maxLeft) + 10;
    const top = Math.floor(Math.random() * maxTop) + 10;

    const popupDiv = document.createElement('div');
    // Set PROCESSED_FLAG so MutationObserver ignores it entirely
    popupDiv.setAttribute(PROCESSED_FLAG, 'true');
    popupDiv.style.cssText =
      `position:fixed; z-index:999999; left:${left}px; top:${top}px; ` +
      `width:${popupWidth}px; height:${popupHeight}px; display:block;`;

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
    // Randomized interval between 15s and 30s (15000ms - 30000ms)
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

  // Dynamic DOM insertion observer (for container replacement path)
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
