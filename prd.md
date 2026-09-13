# PRD & Implementation Plan: Satirical Ad Replacer (Chrome Extension)

## 1. Overview

**Project name:** Satirical Ad Replacer
**Type:** Chrome Extension, Manifest V3
**Purpose:** A hackathon "useless projects" satire build. Detects advertisement
containers on any webpage and replaces them with deliberately obnoxious,
predatory-feeling custom ad content (image/GIF/video + fake urgency UI). Not
intended for real distribution or production use — built for a live demo.

**Non-goals:** Does not need to work on every website on the internet. Does
not need to block real ad network requests. Does not need persistence,
settings UI, or user configuration. Optimize entirely for: (a) working
reliably on 2-3 chosen demo targets, and (b) being buildable by a first-time
extension developer in a single sitting.

## 2. Functional Requirements

- FR1: On any page the extension is active on, scan the DOM for elements
  matching a known set of ad-container selectors.
- FR2: For each matched element, replace its contents with custom satirical
  ad markup (image/GIF, optionally video) sized to fill the original
  element's bounding box.
- FR3: Injected content must include at least one "predatory UI" mechanic:
  an infinite/resetting countdown timer, and a close button that evades the
  cursor and/or produces a fake alert on click.
- FR4: Detection must also catch ads that load *after* initial page load
  (dynamically inserted DOM nodes), not just ads present at page load.
- FR5: The same replacement logic must work inside cross-origin ad iframes,
  not just the top-level page.
- FR6: Provide a local fallback demo page (`demo.html`) with mock ad
  containers, so the live demo does not depend on a real website's ad
  network actually serving ads at demo time.

## 3. Non-Functional Requirements

- NFR1: No remote code execution, no `eval()`, no CDN script references —
  must comply with Manifest V3 CSP.
- NFR2: No infinite loops or tab freezes caused by the MutationObserver
  reacting to its own DOM changes.
- NFR3: Replacement content must not visually break the host page's layout
  (retain original element dimensions).
- NFR4: Replacement markup must be style-isolated from the host page's CSS
  (use Shadow DOM) so host page styles cannot mangle the satirical content
  and vice versa.

## 4. Explicit Technical Decisions (already made — do not re-litigate)

| Decision point | Chosen approach | Rejected alternative(s) | Why |
|---|---|---|---|
| Ad detection method | Static CSS selector list + MutationObserver | `declarativeNetRequest` network blocking; full EasyList engine integration | Selector matching directly targets replaceable DOM containers; network blocking only leaves empty/broken containers with nothing to inject into. Full EasyList engine is unnecessary implementation overhead for a demo-scoped project. |
| Cross-origin ad iframes | `"all_frames": true` in manifest, content script runs inside each frame's own document | Attempting to reach into iframes from the parent frame via `iframe.contentDocument` | Same-Origin Policy blocks parent-frame access to cross-origin iframe documents. Running the script *inside* each frame (via `all_frames: true`) sidesteps this because the script then operates on its own frame's local DOM, not a foreign one. |
| Content isolation | Shadow DOM (`attachShadow({mode: 'open'})`) | Direct `innerHTML` replacement without Shadow DOM | Prevents host page global CSS from breaking injected satirical markup, and vice versa. |
| Media format | GIF/APNG (static animated image) as primary; `<video>` with `autoplay muted loop playsinline` if video is used | Autoplaying video with sound | Chrome blocks unmuted autoplay without prior user interaction. GIFs sidestep this entirely and guarantee immediate playback for the demo. |
| Demo reliability | Build a local `demo.html` fallback with mock ad containers, in addition to testing on 1-2 real static sites with known Google Publisher Tag containers | Relying solely on live third-party sites | Real ad networks vary class names, geo-target, and change delivery — unreliable for a live, time-boxed demo. Local fallback guarantees deterministic behavior. |

## 5. File & Folder Structure

```
satirical-ad-replacer/
├── manifest.json
├── content.js
├── demo.html
└── assets/
    └── satirical_ad.gif
```

## 6. Exact Specifications

### 6.1 `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "Satirical Ad Replacer",
  "version": "1.0.0",
  "description": "Detects advertisement containers and replaces them with satirical predatory UI elements.",
  "permissions": [
    "activeTab"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle",
      "all_frames": true
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["assets/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### 6.2 Ad Detection Selector List (exact — use as-is)

```js
const SELECTORS = [
  '.ad-slot',
  '.ad-banner',
  '.ad-container',
  '.advertisement',
  '.ad-wrapper',
  '[id*="google_ads"]',
  '[id*="div-gpt-ad"]',
  'iframe[src*="doubleclick.net"]',
  'iframe[src*="googlesyndication.com"]',
  'iframe[src*="adnxs.com"]',
  'ins.adsbygoogle',
  '.trc_rbox_container',
  '.outbrain-template',
  '[class*="sponsored-post"]',
  '[aria-label="advertisement"]'
];
```

### 6.3 `content.js` (full reference implementation)

```js
(function () {
  const SELECTORS = [
    '.ad-slot',
    '.ad-banner',
    '.ad-container',
    '.advertisement',
    '.ad-wrapper',
    '[id*="google_ads"]',
    '[id*="div-gpt-ad"]',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="adnxs.com"]',
    'ins.adsbygoogle',
    '.trc_rbox_container',
    '.outbrain-template',
    '[class*="sponsored-post"]',
    '[aria-label="advertisement"]'
  ];

  const PROCESSED_FLAG = 'data-satire-processed';

  function injectSatiricalContent(shadowRoot) {
    const assetUrl = chrome.runtime.getURL('assets/satirical_ad.gif');

    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'position:relative; width:100%; height:100%; overflow:hidden; ' +
      'background:#ff00ff; border:3px solid #00ff00; box-sizing:border-box; ' +
      'font-family:sans-serif;';

    wrapper.innerHTML = `
      <style>
        .urgency-banner {
          position: absolute; top: 0; left: 0; width: 100%;
          background: #ffff00; color: #ff0000; font-weight: bold;
          font-size: 11px; text-align: center; line-height: 16px; z-index: 2;
        }
        .evasive-btn {
          position: absolute; top: 18px; right: 2px; width: 16px; height: 16px;
          background: red; color: white; font-size: 10px; font-weight: bold;
          text-align: center; line-height: 16px; cursor: pointer;
          z-index: 10; user-select: none;
        }
        .main-media { width: 100%; height: 100%; object-fit: cover; display: block; }
      </style>
      <div class="urgency-banner">PRIZE EXPIRES IN: <span id="clock">05</span>s</div>
      <div class="evasive-btn" id="close-target">X</div>
      <img src="${assetUrl}" class="main-media" />
    `;

    shadowRoot.appendChild(wrapper);

    let seconds = 5;
    const clockEl = shadowRoot.getElementById('clock');
    setInterval(() => {
      seconds--;
      if (seconds <= 0) seconds = 5;
      if (clockEl) clockEl.textContent = `0${seconds}`;
    }, 1000);

    const closeTarget = shadowRoot.getElementById('close-target');
    closeTarget.addEventListener('mouseenter', () => {
      closeTarget.style.top = `${Math.floor(Math.random() * 70) + 10}%`;
      closeTarget.style.right = `${Math.floor(Math.random() * 70) + 10}%`;
    });
    closeTarget.addEventListener('click', (e) => {
      e.stopPropagation();
      alert('ERROR: Action blocked by system policy!');
    });
  }

  function transformElement(element) {
    if (element.hasAttribute(PROCESSED_FLAG)) return;
    element.setAttribute(PROCESSED_FLAG, 'true');

    const bounds = element.getBoundingClientRect();
    const width = bounds.width > 0 ? bounds.width : 300;
    const height = bounds.height > 0 ? bounds.height : 250;

    element.innerHTML = '';
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    element.style.display = 'block';

    const shadow = element.attachShadow({ mode: 'open' });
    injectSatiricalContent(shadow);
  }

  function executeScan() {
    const combinedSelector = SELECTORS.join(',');
    const elements = document.querySelectorAll(combinedSelector);
    elements.forEach((el) => transformElement(el));
  }

  executeScan();

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
```

### 6.4 `demo.html` (local fallback test target)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Extension Verification Target</title>
</head>
<body style="font-family: sans-serif; padding: 20px;">
  <h1>Local Test Target Page</h1>
  <p>The slots below simulate ad container targets.</p>
  <div class="ad-slot" style="width: 300px; height: 250px; background: #ddd; margin-bottom: 20px;"></div>
  <div class="ad-banner" style="width: 728px; height: 90px; background: #ccc;"></div>
</body>
</html>
```

## 7. Ordered Implementation Checklist

1. Create project directory `satirical-ad-replacer/`.
2. Create `assets/` subdirectory. Add a real image file named
   `satirical_ad.gif` inside it (any placeholder image/GIF works for initial
   testing — swap in the final "obnoxious" creative asset later).
3. Create `manifest.json` in the project root using the exact content in
   section 6.1.
4. Create `content.js` in the project root using the exact content in
   section 6.3.
5. Create `demo.html` (can live inside or outside the extension directory)
   using the content in section 6.4.
6. Load the extension: open `chrome://extensions/`, enable **Developer
   mode** (top-right toggle), click **Load unpacked**, select the
   `satirical-ad-replacer/` directory.
7. Open `demo.html` in Chrome and confirm both `.ad-slot` and `.ad-banner`
   elements are replaced with the satirical shadow-DOM content, including
   the countdown timer and evasive close button.
8. Test on 1-2 real static sites containing standard Google Publisher Tag
   containers (`ins.adsbygoogle` or `div[id^="div-gpt-ad"]`) to confirm
   real-world detection works. Treat this as a bonus, not a dependency —
   `demo.html` is the guaranteed fallback for the live judge demo.
9. Swap the placeholder GIF for the final "obnoxious ad" creative asset.
10. (Optional, if time allows) Add a `<video autoplay muted loop
    playsinline>` variant alongside/instead of the GIF for one of the
    replacement templates, per section 4's media format decision.
11. After every change to `manifest.json` or `content.js`, click the
    refresh icon on the extension's card in `chrome://extensions/` to apply
    changes before retesting.

## 8. Operational Warnings (do not violate these)

- **Do NOT** set `"all_frames": false` in `manifest.json`. This blocks
  script execution inside cross-origin ad iframes, breaking FR5.
- **Do NOT** modify DOM nodes inside the `MutationObserver` callback without
  checking `data-satire-processed` first. Skipping this check creates an
  infinite mutation loop that freezes the browser tab.
- **Do NOT** reference local assets via relative string paths in injected
  markup (e.g. `src="assets/satirical_ad.gif"`). Always generate asset URLs
  via `chrome.runtime.getURL('assets/satirical_ad.gif')`.
- **Do NOT** use `eval()`, inline script strings passed to `setTimeout()`,
  or any externally/CDN-hosted script. This violates Manifest V3 CSP and
  will cause the extension to fail to load or silently fail to execute.
- **Do NOT** rely solely on a live real website for the judge demo. Always
  have `demo.html` ready as the guaranteed-to-work fallback.

## 9. Definition of Done

- [ ] Extension loads without errors in `chrome://extensions/`.
- [ ] `demo.html` shows both mock ad slots fully replaced with satirical
      content on load.
- [ ] Countdown timer visibly resets every 5 seconds.
- [ ] Close button moves away from the cursor on hover and shows a fake
      alert on click.
- [ ] At least one real external site with a standard ad container format
      has been tested and confirmed working (best-effort, not blocking).
- [ ] Final creative asset (GIF/video) is in place, not the placeholder.