/**
 * LinkedIn Doomscroll Inferno 🔥
 * Robust, SPA-Resilient Post Tracker & Cartoon Flames
 */

(function () {
  'use strict';

  // 1. Guard against running in iframes or double loading
  if (window !== window.top) return;
  if (window.__linkedinDoomInfernoLoaded) return;
  window.__linkedinDoomInfernoLoaded = true;

  console.log('[Doomscroll Inferno] 🔥 Extension initialized. Watching feed...');

  // Configuration
  let maxPosts = 10;
  let flamesEnabled = true;
  let snoozeUntil = 0;

  // Set-based tracking to survive LinkedIn DOM recycling & virtual scrolling
  const scrolledPosts = new Set();
  let isInfernoActive = false;
  let overlayEl = null;
  let meterPillEl = null;

  // Load preferences from storage
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['maxPosts', 'flamesEnabled', 'snoozeUntil'], (res) => {
      if (res.maxPosts) maxPosts = Number(res.maxPosts);
      if (res.flamesEnabled !== undefined) flamesEnabled = res.flamesEnabled;
      if (res.snoozeUntil) snoozeUntil = Number(res.snoozeUntil);
      updateDisplay();
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.maxPosts) maxPosts = Number(changes.maxPosts.newValue);
      if (changes.flamesEnabled !== undefined) flamesEnabled = changes.flamesEnabled.newValue;
      if (changes.snoozeUntil) snoozeUntil = Number(changes.snoozeUntil.newValue);
      updateDisplay();
    });
  }

  // Create minimal flame overlay
  function createOverlay() {
    if (document.getElementById('linkedin-flames-overlay')) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'linkedin-flames-overlay';

    overlayEl.innerHTML = `
      <div class="flame-svg-strip">
        <svg viewBox="0 0 1200 200" preserveAspectRatio="none">
          <!-- Red Outer Flame -->
          <path class="flame-path-red" d="M0,200 L0,120 C50,40 80,140 120,60 C160,140 200,20 240,110 C280,40 320,130 360,70 C400,10 440,120 480,50 C520,130 560,30 600,110 C640,40 680,120 720,60 C760,10 800,130 840,40 C880,110 920,50 960,120 C1000,30 1040,130 1080,60 C1120,20 1160,110 1200,100 L1200,200 Z" />
          <!-- Orange Mid Flame -->
          <path class="flame-path-orange" d="M0,200 L0,140 C50,70 80,150 120,90 C160,150 200,50 240,130 C280,70 320,150 360,100 C400,40 440,140 480,80 C520,150 560,60 600,130 C640,70 680,140 720,90 C760,40 800,150 840,70 C880,130 920,80 960,140 C1000,60 1040,150 1080,90 C1120,50 1160,130 1200,120 L1200,200 Z" />
          <!-- Yellow Core Flame -->
          <path class="flame-path-yellow" d="M0,200 L0,160 C50,110 80,170 120,130 C160,170 200,90 240,150 C280,110 320,170 360,130 C400,80 440,160 480,120 C520,170 560,100 600,150 C640,110 680,160 720,130 C760,80 800,170 840,110 C880,150 920,120 960,160 C1000,100 1040,170 1080,130 C1120,90 1160,150 1200,150 L1200,200 Z" />
          <!-- Hot White Accents -->
          <ellipse cx="240" cy="170" rx="12" ry="20" class="flame-path-white" />
          <ellipse cx="480" cy="165" rx="12" ry="20" class="flame-path-white" />
          <ellipse cx="720" cy="170" rx="12" ry="20" class="flame-path-white" />
          <ellipse cx="960" cy="165" rx="12" ry="20" class="flame-path-white" />
        </svg>
      </div>
      <div class="flame-bottom-bar"></div>
    `;
    document.documentElement.appendChild(overlayEl);

    // Floating Doom Meter HUD (Bottom Left)
    meterPillEl = document.createElement('div');
    meterPillEl.id = 'doom-meter-pill';
    meterPillEl.innerHTML = `
      <span class="doom-meter-icon" id="doom-icon">🔥</span>
      <span class="doom-meter-text" id="doom-text">0 / ${maxPosts} posts</span>
      <div class="doom-bar-bg">
        <div class="doom-bar-fill" id="doom-fill"></div>
      </div>
    `;
    document.documentElement.appendChild(meterPillEl);

    // Notification toast
    const toast = document.createElement('div');
    toast.id = 'doom-toast-msg';
    document.documentElement.appendChild(toast);
  }

  // Stable structural selectors for LinkedIn feed updates
  const POST_SELECTORS = [
    'div[data-id^="urn:li:"]',
    'div[data-urn^="urn:li:"]',
    'div.occludable-update',
    'div.feed-shared-update-v2',
    'div[data-view-name="feed-full-update"]',
    'article',
    '.mock-post' // demo page
  ].join(',');

  // Extract a unique identifier from a post container
  function getPostIdentifier(el) {
    // 1. Direct data-id (e.g., data-id="urn:li:activity:...")
    const dataId = el.getAttribute('data-id');
    if (dataId && dataId.startsWith('urn:li:')) return dataId;

    // 2. Direct data-urn
    const dataUrn = el.getAttribute('data-urn');
    if (dataUrn && dataUrn.startsWith('urn:li:')) return dataUrn;

    // 3. dataset.viewTrackingId
    if (el.dataset && el.dataset.viewTrackingId) return `tracking-${el.dataset.viewTrackingId}`;

    // 4. Look inside element for child with data-id or data-urn
    const childUrn = el.querySelector('[data-id^="urn:li:"], [data-urn^="urn:li:"]');
    if (childUrn) {
      const cid = childUrn.getAttribute('data-id') || childUrn.getAttribute('data-urn');
      if (cid && cid.startsWith('urn:li:')) return cid;
    }

    // 5. Look for link containing urn:li:activity / share / ugcPost
    const postLink = el.querySelector('a[href*="urn:li:activity:"], a[href*="urn:li:share:"], a[href*="urn:li:ugcPost:"]');
    if (postLink) {
      const match = postLink.href.match(/urn:li:[a-zA-Z0-9_-]+:[0-9]+/);
      if (match) return match[0];
    }

    // 6. Demo fallback
    if (el.dataset && el.dataset.postId) return el.dataset.postId;
    if (el.id && el.id.startsWith('demo-')) return el.id;

    return null;
  }

  // Scan feed elements and detect posts scrolled into or past view
  function scanFeed() {
    if (!flamesEnabled || Date.now() < snoozeUntil) {
      updateDisplay();
      return;
    }

    const postElements = document.querySelectorAll(POST_SELECTORS);
    let newlyScrolled = false;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    postElements.forEach((post) => {
      const postId = getPostIdentifier(post);
      if (!postId || scrolledPosts.has(postId)) return;

      const rect = post.getBoundingClientRect();
      // Only count genuine post blocks with measurable height
      if (rect.height < 50) return;

      // Count a post when it enters the user's active reading/scroll zone
      // (top of post has scrolled above the lower 70% of the viewport)
      if (rect.top < viewportHeight * 0.70 && rect.bottom > 0) {
        scrolledPosts.add(postId);
        newlyScrolled = true;
        console.log(`[Doomscroll Inferno] 🔥 New post scrolled past (${scrolledPosts.size}/${maxPosts}):`, postId);
      }
    });

    if (newlyScrolled) {
      updateDisplay();
    }
  }

  // Update visual flame height & counter
  function updateDisplay() {
    if (!overlayEl) return;

    const isSnoozed = Date.now() < snoozeUntil;
    if (!flamesEnabled || isSnoozed) {
      overlayEl.style.setProperty('--flame-h', '0px');
      if (meterPillEl) meterPillEl.style.display = isSnoozed ? 'flex' : 'none';
      const text = document.getElementById('doom-text');
      if (text && isSnoozed) text.innerText = 'Snoozed 💧';
      return;
    }

    if (meterPillEl) meterPillEl.style.display = 'flex';

    const count = scrolledPosts.size;
    const ratio = Math.min(count / maxPosts, 1.0);

    const textEl = document.getElementById('doom-text');
    const fillEl = document.getElementById('doom-fill');
    const iconEl = document.getElementById('doom-icon');

    if (textEl) textEl.innerText = `${count} / ${maxPosts} posts`;
    if (fillEl) fillEl.style.width = `${Math.round(ratio * 100)}%`;
    if (iconEl) {
      iconEl.innerText = ratio >= 1.0 ? '😈' : ratio >= 0.7 ? '🥵' : ratio >= 0.4 ? '😅' : '🔥';
    }

    if (count === 0) {
      overlayEl.style.setProperty('--flame-h', '0px');
    } else if (ratio < 1.0) {
      // Smoothly expand cartoon flames from 12vh to 82vh
      const h = Math.round(12 + ratio * 70);
      overlayEl.style.setProperty('--flame-h', `${h}vh`);
      removeModal();
      isInfernoActive = false;
    } else {
      // 10+ posts reached: FULL INFERNO!
      overlayEl.style.setProperty('--flame-h', '100vh');
      if (!isInfernoActive) {
        isInfernoActive = true;
        showInterventionModal();
      }
    }
  }

  function showInterventionModal() {
    if (document.getElementById('inferno-modal-overlay')) return;

    const modal = document.createElement('div');
    modal.id = 'inferno-modal-overlay';
    modal.innerHTML = `
      <div class="inferno-modal-card">
        <div style="font-size: 44px; margin-bottom: 6px;">🔥</div>
        <h2>DOOMSCROLL INFERNO!</h2>
        <p>
          You have scrolled past <strong>${scrolledPosts.size} posts</strong> on LinkedIn!
          Your feed has consumed you. Will you contribute something to society or escape the screen?
        </p>
        <div class="inferno-actions">
          <button class="inferno-btn btn-post-society" id="doom-act-post">
            ✍️ Post Something & Contribute to Society
          </button>
          <button class="inferno-btn btn-leave-linkedin" id="doom-act-leave">
            🚪 Get Off LinkedIn & Save Your Brain
          </button>
          <button class="inferno-btn btn-snooze-flames" id="doom-act-snooze">
            💧 Extinguish with Water (5 min snooze)
          </button>
        </div>
      </div>
    `;

    document.documentElement.appendChild(modal);

    // Button 1: Post something
    document.getElementById('doom-act-post').addEventListener('click', () => {
      removeModal();
      scrolledPosts.clear();
      isInfernoActive = false;
      updateDisplay();

      window.scrollTo({ top: 0, behavior: 'smooth' });

      setTimeout(() => {
        const postBtn = document.querySelector(
          'button.share-box-feed-entry__trigger, button[data-view-name="share-box-feed-entry-trigger"], div.share-box-feed-entry button, #mock-start-post'
        );
        if (postBtn) postBtn.click();
        showToast('💡 Great choice! Inspire and contribute to society.');
      }, 500);
    });

    // Button 2: Leave LinkedIn
    document.getElementById('doom-act-leave').addEventListener('click', () => {
      removeModal();
      const exitUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
        ? chrome.runtime.getURL('exit.html')
        : 'exit.html';
      window.location.href = exitUrl;
    });

    // Button 3: Snooze
    document.getElementById('doom-act-snooze').addEventListener('click', () => {
      removeModal();
      snoozeUntil = Date.now() + 5 * 60 * 1000;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.set({ snoozeUntil });
      }
      scrolledPosts.clear();
      isInfernoActive = false;
      updateDisplay();
      showToast('💧 Sizzz! Flames doused for 5 minutes.');
    });
  }

  function removeModal() {
    const modal = document.getElementById('inferno-modal-overlay');
    if (modal) modal.remove();
  }

  function showToast(msg) {
    const toast = document.getElementById('doom-toast-msg');
    if (!toast) return;
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 4000);
  }

  // Communication with popup.js
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === 'GET_STATUS') {
        sendResponse({
          scrolledPosts: scrolledPosts.size,
          maxPosts,
          isInferno: isInfernoActive
        });
      } else if (msg.action === 'TEST_INFERNO') {
        for (let i = 0; i < maxPosts; i++) {
          scrolledPosts.add(`test-post-${i}`);
        }
        updateDisplay();
        sendResponse({ ok: true });
      } else if (msg.action === 'RESET_COUNTER') {
        scrolledPosts.clear();
        isInfernoActive = false;
        removeModal();
        updateDisplay();
        sendResponse({ ok: true });
      }
      return true;
    });
  }

  // 1. Throttled capture-phase scroll listener (catches scroll on window OR any scrollable feed container)
  let isScrollScheduled = false;
  window.addEventListener(
    'scroll',
    () => {
      if (!isScrollScheduled) {
        isScrollScheduled = true;
        window.requestAnimationFrame(() => {
          scanFeed();
          isScrollScheduled = false;
        });
      }
    },
    { capture: true, passive: true }
  );

  // 2. Debounced MutationObserver to detect infinite scroll injections cleanly
  let mutationTimeout = null;
  const feedObserver = new MutationObserver(() => {
    if (mutationTimeout) clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
      scanFeed();
    }, 250);
  });

  function startObserver() {
    createOverlay();
    scanFeed();

    const targetNode = document.querySelector('main') || document.body;
    if (targetNode) {
      feedObserver.observe(targetNode, {
        childList: true,
        subtree: true
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
