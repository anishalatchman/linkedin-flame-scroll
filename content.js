/**
 * LinkedIn Flames Scroller
 * Ultra-Resilient Dual-Engine Tracker (DOM + Scroll Distance) with Shadow DOM
 */

(function () {
  'use strict';

  // 1. Guard against running in iframes or double loading
  if (window !== window.top) return;
  if (window.__linkedinDoomInfernoLoaded) return;
  window.__linkedinDoomInfernoLoaded = true;

  console.log('[LinkedIn Flames Scroller] Extension active');

  // Configuration
  let maxPosts = 10;
  let flamesEnabled = true;
  let snoozeUntil = 0;

  // Dual-Engine State
  const scrolledPosts = new Set();
  let currentScrollY = 0;  // Live position - decrements when scrolling back up
  let isInfernoActive = false;

  // Shadow DOM handles
  let hostEl = null;
  let shadowRoot = null;
  let overlayEl = null;
  let meterPillEl = null;
  let toastEl = null;

  // Safe storage wrappers (zero "context invalidated" console errors)
  function safeStorageGet(keys, cb) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(keys, (res) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            fallbackGet(keys, cb);
          } else {
            cb(res || {});
          }
        });
        return;
      }
    } catch (_) {}
    fallbackGet(keys, cb);
  }

  function fallbackGet(keys, cb) {
    const res = {};
    try {
      keys.forEach((k) => {
        const val = localStorage.getItem(`doom_${k}`);
        if (val !== null) res[k] = JSON.parse(val);
      });
    } catch (_) {}
    cb(res);
  }

  function safeStorageSet(items) {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(items);
      }
    } catch (_) {}
    try {
      Object.entries(items).forEach(([k, v]) => {
        localStorage.setItem(`doom_${k}`, JSON.stringify(v));
      });
    } catch (_) {}
  }

  // Load initial settings
  safeStorageGet(['maxPosts', 'flamesEnabled', 'snoozeUntil'], (res) => {
    if (res.maxPosts) maxPosts = Number(res.maxPosts);
    if (res.flamesEnabled !== undefined) flamesEnabled = res.flamesEnabled;
    if (res.snoozeUntil) snoozeUntil = Number(res.snoozeUntil);
    updateDisplay();
  });

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes) => {
        if (changes.maxPosts) maxPosts = Number(changes.maxPosts.newValue);
        if (changes.flamesEnabled !== undefined) flamesEnabled = changes.flamesEnabled.newValue;
        if (changes.snoozeUntil) snoozeUntil = Number(changes.snoozeUntil.newValue);
        updateDisplay();
      });
    }
  } catch (_) {}

  // --------------------------------------------------------------------------
  // Shadow DOM UI Construction (Zero DOM collisions & Zero CSS conflicts)
  // --------------------------------------------------------------------------
  function initShadowUI() {
    if (document.getElementById('doomscroll-inferno-host')) return;

    hostEl = document.createElement('div');
    hostEl.id = 'doomscroll-inferno-host';
    hostEl.style.cssText = 'all: initial; position: absolute; z-index: 2147483640;';

    const targetParent = document.body || document.documentElement;
    if (!targetParent) return;
    targetParent.appendChild(hostEl);

    shadowRoot = hostEl.attachShadow({ mode: 'open' });

    // Injected Styles inside Shadow DOM
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; margin: 0; padding: 0; }

      #linkedin-flames-overlay {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100vw;
        height: var(--flame-h, 0px);
        max-height: 100vh;
        pointer-events: none;
        z-index: 2147483640;
        overflow: visible;
        transition: height 0.35s cubic-bezier(0.2, 0.9, 0.3, 1);
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
      }

      .flame-svg-strip {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        pointer-events: none;
      }

      .flame-svg-strip svg {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: block;
        transform-origin: bottom center;
      }

      .flame-path-red {
        fill: #E62200;
        stroke: #1A0300;
        stroke-width: 4px;
        animation: cartoonSway1 2.4s ease-in-out infinite alternate;
        transform-origin: bottom center;
      }

      .flame-path-orange {
        fill: #FF7700;
        animation: cartoonSway2 1.8s ease-in-out infinite alternate;
        transform-origin: bottom center;
      }

      .flame-path-yellow {
        fill: #FFD200;
        animation: cartoonSway3 1.3s ease-in-out infinite alternate;
        transform-origin: bottom center;
      }

      .flame-path-white {
        fill: #FFF6A8;
        animation: cartoonSway2 1.1s ease-in-out infinite alternate;
        transform-origin: bottom center;
      }

      .flame-bottom-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 14px;
        background: #E62200;
        border-top: 3px solid #FFD200;
        pointer-events: none;
      }

      @keyframes cartoonSway1 {
        0% { transform: scaleY(0.96) skewX(-1.5deg); }
        100% { transform: scaleY(1.04) skewX(1.5deg); }
      }

      @keyframes cartoonSway2 {
        0% { transform: scaleY(1.04) skewX(2deg); }
        100% { transform: scaleY(0.95) skewX(-2deg); }
      }

      @keyframes cartoonSway3 {
        0% { transform: scaleY(0.92) skewX(-2.5deg); }
        100% { transform: scaleY(1.08) skewX(2.5deg); }
      }

      #doom-meter-pill {
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 2147483645;
        background: #18191B;
        color: #FFFFFF;
        border: 2px solid #FF7700;
        border-radius: 999px;
        padding: 6px 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
        cursor: pointer;
        user-select: none;
        pointer-events: auto;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
        transition: transform 0.2s ease;
      }

      #doom-meter-pill:hover {
        transform: translateY(-2px) scale(1.04);
      }

      .doom-meter-icon { font-size: 16px; }
      .doom-meter-text { font-size: 12px; font-weight: 800; color: #FFD200; }

      .doom-bar-bg {
        width: 44px;
        height: 6px;
        background: #333333;
        border-radius: 999px;
        overflow: hidden;
      }

      .doom-bar-fill {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #FFD200, #FF5500, #E60000);
        transition: width 0.3s ease;
      }

      #inferno-modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        background: rgba(15, 3, 0, 0.75);
        pointer-events: auto;
        animation: modalFadeIn 0.3s ease-out;
      }

      @keyframes modalFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .inferno-modal-card {
        max-width: 500px;
        width: 100%;
        background: #FFFFFF;
        border: 4px solid #1A0500;
        border-radius: 20px;
        padding: 28px 24px 24px;
        text-align: center;
        box-shadow: 8px 8px 0px #1A0500;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #1A0500;
        animation: cardBounceIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      @keyframes cardBounceIn {
        from { transform: scale(0.85); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }

      .inferno-demon-emoji {
        font-size: 44px;
        margin-bottom: 6px;
        display: block;
      }

      .inferno-modal-card h2 {
        font-size: 24px;
        font-weight: 900;
        margin: 8px 0 12px;
        color: #D31B00;
      }

      .inferno-modal-card p {
        font-size: 15px;
        line-height: 1.5;
        color: #4A3E3D;
        margin-bottom: 20px;
      }

      .inferno-actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .inferno-btn {
        width: 100%;
        padding: 12px 16px;
        font-size: 15px;
        font-weight: 800;
        border: 3px solid #1A0500;
        border-radius: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        box-shadow: 3px 3px 0px #1A0500;
        transition: transform 0.1s ease;
        text-decoration: none;
      }

      .inferno-btn:active {
        transform: translate(2px, 2px);
        box-shadow: 1px 1px 0px #1A0500;
      }

      .btn-post-society { background: #0073B1; color: #FFFFFF; }
      .btn-leave-linkedin { background: #E62200; color: #FFFFFF; }
      .btn-snooze-flames { background: #F0F4F8; color: #1A0500; font-size: 13px; padding: 8px; box-shadow: none; border-width: 2px; }

      #doom-toast-msg {
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        background: #057642;
        color: #FFFFFF;
        border: 2px solid #02381F;
        border-radius: 10px;
        padding: 10px 20px;
        font-weight: 700;
        font-size: 14px;
        box-shadow: 0 6px 16px rgba(0,0,0,0.3);
        pointer-events: none;
        display: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
    `;
    shadowRoot.appendChild(style);

    // Overlay Element
    overlayEl = document.createElement('div');
    overlayEl.id = 'linkedin-flames-overlay';
    overlayEl.innerHTML = `
      <div class="flame-svg-strip">
        <svg viewBox="0 0 1200 200" preserveAspectRatio="none">
          <path class="flame-path-red" d="M0,200 L0,120 C50,40 80,140 120,60 C160,140 200,20 240,110 C280,40 320,130 360,70 C400,10 440,120 480,50 C520,130 560,30 600,110 C640,40 680,120 720,60 C760,10 800,130 840,40 C880,110 920,50 960,120 C1000,30 1040,130 1080,60 C1120,20 1160,110 1200,100 L1200,200 Z" />
          <path class="flame-path-orange" d="M0,200 L0,140 C50,70 80,150 120,90 C160,150 200,50 240,130 C280,70 320,150 360,100 C400,40 440,140 480,80 C520,150 560,60 600,130 C640,70 680,140 720,90 C760,40 800,150 840,70 C880,130 920,80 960,140 C1000,60 1040,150 1080,90 C1120,50 1160,130 1200,120 L1200,200 Z" />
          <path class="flame-path-yellow" d="M0,200 L0,160 C50,110 80,170 120,130 C160,170 200,90 240,150 C280,110 320,170 360,130 C400,80 440,160 480,120 C520,170 560,100 600,150 C640,110 680,160 720,130 C760,80 800,170 840,110 C880,150 920,120 960,160 C1000,100 1040,170 1080,130 C1120,90 1160,150 1200,150 L1200,200 Z" />
          <ellipse cx="240" cy="170" rx="12" ry="20" class="flame-path-white" />
          <ellipse cx="480" cy="165" rx="12" ry="20" class="flame-path-white" />
          <ellipse cx="720" cy="170" rx="12" ry="20" class="flame-path-white" />
          <ellipse cx="960" cy="165" rx="12" ry="20" class="flame-path-white" />
        </svg>
      </div>
      <div class="flame-bottom-bar"></div>
    `;
    shadowRoot.appendChild(overlayEl);

    // Meter Pill
    meterPillEl = document.createElement('div');
    meterPillEl.id = 'doom-meter-pill';
    meterPillEl.innerHTML = `
      <span class="doom-meter-icon" id="doom-icon">🔥</span>
      <span class="doom-meter-text" id="doom-text">0 / ${maxPosts} posts</span>
      <div class="doom-bar-bg">
        <div class="doom-bar-fill" id="doom-fill"></div>
      </div>
    `;
    shadowRoot.appendChild(meterPillEl);

    // Toast
    toastEl = document.createElement('div');
    toastEl.id = 'doom-toast-msg';
    shadowRoot.appendChild(toastEl);
  }

  // --------------------------------------------------------------------------
  // Dual-Engine Post Tracking Architecture
  // --------------------------------------------------------------------------

  // Comprehensive selectors for LinkedIn feed posts & social wrappers
  const POST_SELECTORS = [
    'div[data-id*="urn:li:"]',
    'div[data-urn*="urn:li:"]',
    'div.feed-shared-update-v2',
    'div[data-view-name="feed-full-update"]',
    'div.occludable-update',
    '.feed-shared-social-action-bar',
    'article',
    '.mock-post' // demo page
  ].join(',');

  function extractCanonicalId(el) {
    if (!el) return null;

    // 1. Check data-id
    const dataId = el.getAttribute('data-id');
    if (dataId && dataId.includes('urn:li:')) return dataId;

    // 2. Check data-urn
    const dataUrn = el.getAttribute('data-urn');
    if (dataUrn && dataUrn.includes('urn:li:')) return dataUrn;

    // 3. Check data-view-tracking-id
    if (el.dataset && el.dataset.viewTrackingId) return `tracking-${el.dataset.viewTrackingId}`;

    // 4. Look inside child nodes
    const child = el.querySelector('[data-id*="urn:li:"], [data-urn*="urn:li:"]');
    if (child) {
      const cid = child.getAttribute('data-id') || child.getAttribute('data-urn');
      if (cid && cid.includes('urn:li:')) return cid;
    }

    // 5. Look for link to update URN
    const link = el.querySelector('a[href*="urn:li:activity:"], a[href*="urn:li:share:"], a[href*="urn:li:ugcPost:"]');
    if (link) {
      const match = link.href.match(/urn:li:[a-zA-Z0-9_-]+:[0-9]+/);
      if (match) return match[0];
    }

    // 6. Demo fallback
    if (el.dataset && el.dataset.postId) return el.dataset.postId;
    if (el.id && el.id.startsWith('demo-')) return el.id;

    return null;
  }

  // Unified post evaluation (Engine 1: DOM URNs + Engine 2: Scroll Depth)
  function scanFeed(e) {
    if (!flamesEnabled || Date.now() < snoozeUntil) {
      updateDisplay();
      return;
    }

    // --- Engine 2: Live Bidirectional Scroll Position ---
    // A typical LinkedIn post is roughly 500px tall.
    // Using live scrollY (not a max) means scrolling back UP decrements the count.
    currentScrollY = Math.max(
      window.scrollY || 0,
      document.documentElement.scrollTop || 0,
      document.body.scrollTop || 0,
      e && e.target && e.target.scrollTop ? e.target.scrollTop : 0
    );
    const distanceEstimate = Math.floor(currentScrollY / 500);

    // --- Engine 1: DOM URN Post Tracker ---
    // Adds posts to the Set when first seen; also removes them if they scroll
    // back into view from the top (the user scrolled back up).
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    const elements = document.querySelectorAll(POST_SELECTORS);

    elements.forEach((el) => {
      const postContainer = el.classList.contains('feed-shared-social-action-bar')
        ? el.closest('div.feed-shared-update-v2, div.occludable-update, article, div[data-id], div[data-urn]') || el
        : el;

      const postId = extractCanonicalId(postContainer);
      if (!postId) return;

      const rect = postContainer.getBoundingClientRect();

      // Count a post when it has scrolled into the upper 75% of the viewport
      if (rect.top < viewportHeight * 0.75 && rect.bottom > 0) {
        if (!scrolledPosts.has(postId)) {
          scrolledPosts.add(postId);
          console.log(`[LinkedIn Flames Scroller] Post counted (${scrolledPosts.size}/${maxPosts}):`, postId);
        }
      }

      // Decrement: if the post is fully back below the top of the viewport
      // (user scrolled back up and it re-entered from the top), remove it.
      if (rect.top > viewportHeight * 0.5 && scrolledPosts.has(postId)) {
        scrolledPosts.delete(postId);
        console.log(`[LinkedIn Flames Scroller] Post uncounted (${scrolledPosts.size}/${maxPosts}):`, postId);
      }
    });

    updateDisplay(distanceEstimate);
  }

  function getEffectiveCount(distanceEstimate) {
    const dist = distanceEstimate !== undefined ? distanceEstimate : Math.floor(maxScrollY / 500);
    // Whichever engine found more posts wins!
    return Math.max(scrolledPosts.size, dist);
  }

  // Update UI Elements
  function updateDisplay(distanceEstimate) {
if (!window.location.pathname.startsWith('/feed')) {
      if (overlayEl) {
        overlayEl.style.setProperty('--flame-h', '0px');
        overlayEl.style.display = 'none'; // <-- Add this to completely hide the overlay DOM element
      }
      if (meterPillEl) meterPillEl.style.display = 'none';
      return;
    } else {
      if (overlayEl) overlayEl.style.display = 'flex'; // <-- Ensure it reappears on the feed
    }

    if (!overlayEl || !shadowRoot) return;

    const isSnoozed = Date.now() < snoozeUntil;
    if (!flamesEnabled || isSnoozed) {
      overlayEl.style.setProperty('--flame-h', '0px');
      if (meterPillEl) meterPillEl.style.display = isSnoozed ? 'flex' : 'none';
      const text = shadowRoot.getElementById('doom-text');
      if (text && isSnoozed) text.innerText = 'Snoozed 💧';
      return;
    }

    if (meterPillEl) meterPillEl.style.display = 'flex';

    const count = getEffectiveCount(distanceEstimate);
    const ratio = Math.min(count / maxPosts, 1.0);

    const textEl = shadowRoot.getElementById('doom-text');
    const fillEl = shadowRoot.getElementById('doom-fill');
    const iconEl = shadowRoot.getElementById('doom-icon');

    if (textEl) textEl.innerText = `${count} / ${maxPosts} posts`;
    if (fillEl) fillEl.style.width = `${Math.round(ratio * 100)}%`;
    if (iconEl) {
      iconEl.innerText = ratio >= 1.0 ? '😈' : ratio >= 0.7 ? '🥵' : ratio >= 0.4 ? '😅' : '🔥';
    }

    if (count === 0) {
      overlayEl.style.setProperty('--flame-h', '0px');
    } else if (ratio < 1.0) {
      const h = Math.round(12 + ratio * 72);
      overlayEl.style.setProperty('--flame-h', `${h}vh`);
      removeModal();
      isInfernoActive = false;
    } else {
      // 10+ posts reached: FULL INFERNO!
      overlayEl.style.setProperty('--flame-h', '100vh');
      if (!isInfernoActive) {
        isInfernoActive = true;
        showInterventionModal(count);
      }
    }
  }

  function showInterventionModal(count) {
    if (shadowRoot.getElementById('inferno-modal-overlay')) return;

    const modal = document.createElement('div');
    modal.id = 'inferno-modal-overlay';
    modal.innerHTML = `
      <div class="inferno-modal-card">
        <h2>DOOMSCROLL MAXED OUT!</h2>
        <p>You have scrolled past <strong>${count} posts</strong> on LinkedIn. Ready to create one yourself?</p>
        <button class="inferno-btn" id="doom-act-post">Create new post</button>
      </div>
    `;

    shadowRoot.appendChild(modal);

    // Button 1: Post something - navigate in the same tab to the post composer
    modal.querySelector('#doom-act-post').addEventListener('click', () => {
      // ?shareActive=true tells LinkedIn's SPA to open the post composer immediately
      window.location.href = 'https://www.linkedin.com/feed/?shareActive=true';
    });
  }

  function removeModal() {
    if (!shadowRoot) return;
    const modal = shadowRoot.getElementById('inferno-modal-overlay');
    if (modal) modal.remove();
  }

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.innerText = msg;
    toastEl.style.display = 'block';
    setTimeout(() => {
      toastEl.style.display = 'none';
    }, 4000);
  }

  // --------------------------------------------------------------------------
  // Robust Multi-Target Event Listeners
  // --------------------------------------------------------------------------
  let isScrollScheduled = false;
  function handleScroll(e) {
    if (!isScrollScheduled) {
      isScrollScheduled = true;
      window.requestAnimationFrame(() => {
        scanFeed(e);
        isScrollScheduled = false;
      });
    }
  }

  // Listen in capture mode on window, document, and document.body
  window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
  document.addEventListener('scroll', handleScroll, { capture: true, passive: true });

  // Debounced MutationObserver for dynamic infinite scroll updates
  let mutationTimeout = null;
  const feedObserver = new MutationObserver(() => {
    if (mutationTimeout) clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
      scanFeed();
    }, 250);
  });

  function start() {
    initShadowUI();
    scanFeed();

    const targetNode = document.querySelector('main') || document.body;
    if (targetNode) {
      feedObserver.observe(targetNode, {
        childList: true,
        subtree: true
      });
    }
  }

  // Track the current URL so we know when it changes
let lastUrl = location.href;

function checkPageNavigation() {
  if (location.href === lastUrl) return;
  lastUrl = location.href;

  const isFeed = window.location.pathname.startsWith('/feed');

  if (!isFeed) {
    // Instantly collapse flames, hide bottom bar, and hide pill when leaving feed
    if (overlayEl) {
      overlayEl.style.setProperty('--flame-h', '0px');
      overlayEl.style.display = 'none';
    }
    if (meterPillEl) {
      meterPillEl.style.display = 'none';
    }
  } else {
    // Restore display when returning to feed
    if (overlayEl) overlayEl.style.display = 'flex';
    if (meterPillEl) meterPillEl.style.display = 'flex';
  }
}

// Check for SPA route changes every 500ms
setInterval(checkPageNavigation, 500);

  // Message Handler for Popup
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === 'GET_STATUS') {
          sendResponse({
            scrolledPosts: getEffectiveCount(),
            maxPosts,
            isInferno: isInfernoActive
          });
        } else if (msg.action === 'TEST_INFERNO') {
          for (let i = 0; i < maxPosts; i++) {
            scrolledPosts.add(`test-post-${i}`);
          }
          maxScrollY = maxPosts * 500;
          updateDisplay();
          sendResponse({ ok: true });
        } else if (msg.action === 'RESET_COUNTER') {
          scrolledPosts.clear();
          maxScrollY = 0;
          isInfernoActive = false;
          removeModal();
          updateDisplay();
          sendResponse({ ok: true });
        }
        return true;
      });
    }
  } catch (_) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
