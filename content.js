/**
 * LinkedIn Doomscroll Inferno 🔥
 * Ultra-Lightweight Content Script (Zero-Lag, Non-Blocking)
 */

(function () {
  'use strict';

  // 1. Guard against running in iframes or double loading
  if (window !== window.top) return;
  if (window.__linkedinDoomInfernoLoaded) return;
  window.__linkedinDoomInfernoLoaded = true;

  // Configuration
  let maxPosts = 10;
  let flamesEnabled = true;
  let snoozeUntil = 0;

  // State
  const passedPosts = new Set();
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

    // Outer flames wrapper
    overlayEl = document.createElement('div');
    overlayEl.id = 'linkedin-flames-overlay';

    // Single vector cartoon flame strip
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

    // Floating HUD Pill (Bottom Left, completely clear of LinkedIn chat)
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

  // Get strictly top-level main feed posts
  function getFeedPosts() {
    const main = document.querySelector('main, [role="main"], .scaffold-layout__main') || document;
    const raw = main.querySelectorAll(
      'div.feed-shared-update-v2, div[data-view-name="feed-full-update"], [data-urn*="activity:"], .mock-post'
    );

    const posts = [];
    for (let i = 0; i < raw.length; i++) {
      const el = raw[i];
      // Skip if nested inside another post
      if (!el.parentElement || !el.parentElement.closest('div.feed-shared-update-v2, div[data-view-name="feed-full-update"], .mock-post')) {
        posts.push(el);
      }
    }
    return posts;
  }

  // Lightweight scroll check using requestAnimationFrame
  let isCheckingScroll = false;
  function onScroll() {
    if (isCheckingScroll) return;
    isCheckingScroll = true;

    window.requestAnimationFrame(() => {
      checkPostsScrolled();
      isCheckingScroll = false;
    });
  }

  function checkPostsScrolled() {
    if (!flamesEnabled || Date.now() < snoozeUntil) {
      if (overlayEl) overlayEl.style.setProperty('--flame-h', '0px');
      return;
    }

    // Require actual scrolling beyond page top
    if (window.scrollY < 120) return;

    const posts = getFeedPosts();
    let countChanged = false;

    for (let i = 0; i < posts.length; i++) {
      const el = posts[i];
      const id = el.getAttribute('data-urn') || el.getAttribute('data-id') || el.dataset.postId || `p-${i}`;
      if (passedPosts.has(id)) continue;

      const rect = el.getBoundingClientRect();
      // Only count if post has scrolled past top of the screen
      if (rect.bottom < 80 && rect.height > 60) {
        passedPosts.add(id);
        countChanged = true;
      }
    }

    if (countChanged) {
      updateDisplay();
    }
  }

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

    const count = passedPosts.size;
    const ratio = Math.min(count / maxPosts, 1.0);

    // Update meter text and progress bar
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
      // Dynamic height scaling smoothly from 12vh to 80vh
      const h = Math.round(10 + ratio * 70);
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
        <div style="font-size: 40px; margin-bottom: 4px;">🔥</div>
        <h2>DOOMSCROLL INFERNO!</h2>
        <p>
          You've scrolled past <strong>${passedPosts.size} posts</strong> on LinkedIn!
          Your screen is engulfed in flames. Will you post something and contribute to society, or escape the feed?
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
      passedPosts.clear();
      isInfernoActive = false;
      updateDisplay();

      // Smoothly scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Click "Start a post"
      setTimeout(() => {
        const postBtn = document.querySelector(
          'button.share-box-feed-entry__trigger, button[data-view-name="share-box-feed-entry-trigger"], div.share-box-feed-entry button, #mock-start-post'
        );
        if (postBtn) postBtn.click();
        showToast('💡 Great choice! Create and contribute rather than just consume.');
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
      passedPosts.clear();
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
          scrolledPosts: passedPosts.size,
          maxPosts,
          isInferno: isInfernoActive
        });
      } else if (msg.action === 'TEST_INFERNO') {
        for (let i = 0; i < maxPosts; i++) {
          passedPosts.add(`test-post-${i}`);
        }
        updateDisplay();
        sendResponse({ ok: true });
      } else if (msg.action === 'RESET_COUNTER') {
        passedPosts.clear();
        isInfernoActive = false;
        removeModal();
        updateDisplay();
        sendResponse({ ok: true });
      }
      return true;
    });
  }

  // Passive scroll listener (never blocks page scrolling)
  window.addEventListener('scroll', onScroll, { passive: true });

  // Initialize overlay cleanly when document is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createOverlay);
  } else {
    createOverlay();
  }
})();
