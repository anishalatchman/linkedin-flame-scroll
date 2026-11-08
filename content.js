/**
 * LinkedIn Doomscroll Inferno 🔥
 * Cartoon Animated Flames & Doomscroll Intervention Content Script
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__linkedinDoomscrollInfernoLoaded) return;
  window.__linkedinDoomscrollInfernoLoaded = true;

  // Configuration state
  let config = {
    maxPosts: 10,
    flamesEnabled: true,
    snoozeUntil: 0
  };

  // Tracking state
  const seenPosts = new Set();
  const passedPosts = new Set();
  let currentFlameHeightPercent = 5;
  let isInfernoActive = false;
  let isModalOpen = false;

  // Load saved preferences
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['maxPosts', 'flamesEnabled', 'snoozeUntil'], (result) => {
      if (result.maxPosts) config.maxPosts = Number(result.maxPosts);
      if (result.flamesEnabled !== undefined) config.flamesEnabled = result.flamesEnabled;
      if (result.snoozeUntil) config.snoozeUntil = Number(result.snoozeUntil);
      updateDisplay();
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.maxPosts) config.maxPosts = Number(changes.maxPosts.newValue);
      if (changes.flamesEnabled !== undefined) config.flamesEnabled = changes.flamesEnabled.newValue;
      if (changes.snoozeUntil) config.snoozeUntil = Number(changes.snoozeUntil.newValue);
      updateDisplay();
    });
  }

  // Build the DOM overlays
  function initOverlay() {
    if (document.getElementById('linkedin-flames-overlay')) return;

    // 1. Flames Container
    const flameOverlay = document.createElement('div');
    flameOverlay.id = 'linkedin-flames-overlay';

    // Ambient heat glow
    const heatGlow = document.createElement('div');
    heatGlow.className = 'flame-heat-glow';
    flameOverlay.appendChild(heatGlow);

    // Layered Cartoon Flame SVGs
    const svgWrapper = document.createElement('div');
    svgWrapper.className = 'flame-svg-wrapper';

    const redLayer = document.createElement('div');
    redLayer.className = 'flame-layer layer-red';

    const orangeLayer = document.createElement('div');
    orangeLayer.className = 'flame-layer layer-orange';

    const yellowLayer = document.createElement('div');
    yellowLayer.className = 'flame-layer layer-yellow';

    const lightLayer = document.createElement('div');
    lightLayer.className = 'flame-layer layer-light';

    svgWrapper.appendChild(redLayer);
    svgWrapper.appendChild(orangeLayer);
    svgWrapper.appendChild(yellowLayer);
    svgWrapper.appendChild(lightLayer);
    flameOverlay.appendChild(svgWrapper);

    // Bottom solid burning coal bed
    const baseBar = document.createElement('div');
    baseBar.className = 'flame-base-bar';
    flameOverlay.appendChild(baseBar);

    // Spurt random sparks container
    const sparksContainer = document.createElement('div');
    sparksContainer.id = 'flame-sparks-container';
    flameOverlay.appendChild(sparksContainer);

    document.body.appendChild(flameOverlay);

    // 2. Floating Doom Meter HUD
    const meterPill = document.createElement('div');
    meterPill.id = 'doom-meter-pill';
    meterPill.innerHTML = `
      <span class="meter-icon" id="meter-demon-icon">🔥</span>
      <div class="meter-text-group">
        <span class="meter-title">Feed Heat</span>
        <span class="meter-counter" id="meter-counter-text">0 / ${config.maxPosts} posts</span>
      </div>
      <div class="meter-bar-container">
        <div class="meter-bar-fill" id="meter-bar-fill"></div>
      </div>
    `;

    meterPill.title = 'LinkedIn Doomscroll Inferno: Flame rises with every post scrolled past!';
    meterPill.addEventListener('click', () => {
      // Small easter-egg: shake the meter or open trigger
      meterPill.classList.add('shake-warning');
      setTimeout(() => meterPill.classList.remove('shake-warning'), 500);
    });

    document.body.appendChild(meterPill);

    // 3. Celebratory Toast
    const toast = document.createElement('div');
    toast.id = 'doom-celebrate-toast';
    toast.innerText = '🚀 Awesome! You chose to create instead of consume.';
    document.body.appendChild(toast);

    // Periodically spawn cartoon sparks
    spawnPeriodicSparks();
  }

  // Generate floating cartoon sparks
  function spawnPeriodicSparks() {
    const container = document.getElementById('flame-sparks-container');
    if (!container) return;

    setInterval(() => {
      if (!config.flamesEnabled || isSnoozed()) return;

      const spark = document.createElement('div');
      spark.className = 'flame-spark';

      const leftPercent = Math.random() * 96 + 2; // 2% to 98%
      const size = Math.random() * 8 + 6; // 6px to 14px
      const travel = -(Math.random() * 180 + 100);
      const drift = (Math.random() - 0.5) * 80;
      const dur = Math.random() * 1.5 + 1.2;

      spark.style.left = `${leftPercent}%`;
      spark.style.width = `${size}px`;
      spark.style.height = `${size}px`;
      spark.style.setProperty('--spark-travel', `${travel}px`);
      spark.style.setProperty('--spark-drift', `${drift}px`);
      spark.style.setProperty('--spark-dur', `${dur}s`);

      container.appendChild(spark);

      setTimeout(() => {
        spark.remove();
      }, dur * 1000);
    }, 350);
  }

  // Check if currently snoozed
  function isSnoozed() {
    return Date.now() < (config.snoozeUntil || 0);
  }

  // Post element selectors for LinkedIn (and Demo)
  const POST_SELECTORS = [
    'div.feed-shared-update-v2',
    'div[data-urn*="urn:li:activity:"]',
    'div[data-id*="urn:li:activity:"]',
    'div[data-view-name="feed-full-update"]',
    'div.occludable-update',
    '.mock-post' // for demo.html
  ];

  function getAllPostElements() {
    const elements = [];
    for (const selector of POST_SELECTORS) {
      const found = document.querySelectorAll(selector);
      found.forEach(el => {
        // Filter out small embedded sub-components, keep distinct top-level post containers
        if (!elements.includes(el) && el.offsetHeight > 100) {
          elements.push(el);
        }
      });
    }
    return elements;
  }

  // Determine a unique identifier for each post
  function getPostId(el, index) {
    return (
      el.getAttribute('data-urn') ||
      el.getAttribute('data-id') ||
      el.getAttribute('data-chameleon-result-urn') ||
      el.id ||
      el.dataset.postId ||
      `post-idx-${index}`
    );
  }

  // Check posts scrolled past
  function evaluateScroll() {
    if (!config.flamesEnabled || isSnoozed()) {
      resetFlamesToResting();
      return;
    }

    const posts = getAllPostElements();
    const viewportHeight = window.innerHeight;

    posts.forEach((postEl, index) => {
      const postId = getPostId(postEl, index);
      seenPosts.add(postId);

      const rect = postEl.getBoundingClientRect();
      // A post is considered "scrolled past" if its bottom is above the middle of viewport
      // or its top has scrolled significantly past the top of the viewport
      if (rect.bottom < viewportHeight * 0.55 || rect.top < -rect.height * 0.6) {
        if (!passedPosts.has(postId)) {
          passedPosts.add(postId);
          onPostScrolledPast();
        }
      }
    });

    updateDisplay();
  }

  function onPostScrolledPast() {
    const pill = document.getElementById('doom-meter-pill');
    if (pill) {
      pill.classList.remove('shake-warning');
      void pill.offsetWidth; // trigger reflow
      pill.classList.add('shake-warning');
    }
  }

  // Update visual flame height & counter
  function updateDisplay() {
    const flameOverlay = document.getElementById('linkedin-flames-overlay');
    const counterText = document.getElementById('meter-counter-text');
    const barFill = document.getElementById('meter-bar-fill');
    const demonIcon = document.getElementById('meter-demon-icon');

    if (!flameOverlay) return;

    if (!config.flamesEnabled || isSnoozed()) {
      flameOverlay.style.setProperty('--flame-height', '0px');
      flameOverlay.style.display = 'none';
      if (counterText) counterText.innerText = 'Snoozed 💧';
      if (barFill) barFill.style.width = '0%';
      return;
    }

    flameOverlay.style.display = 'flex';

    const count = passedPosts.size;
    const max = config.maxPosts;
    const ratio = Math.min(count / max, 1.0);

    // Update meter counter text and fill bar
    if (counterText) {
      counterText.innerText = `${count} / ${max} posts`;
    }
    if (barFill) {
      barFill.style.width = `${Math.round(ratio * 100)}%`;
    }

    // Dynamic flame emoji state
    if (demonIcon) {
      if (ratio >= 1.0) demonIcon.innerText = '😈';
      else if (ratio >= 0.75) demonIcon.innerText = '🥵';
      else if (ratio >= 0.4) demonIcon.innerText = '😅';
      else demonIcon.innerText = '🔥';
    }

    // Calculate height of the cartoon flames
    if (count === 0) {
      flameOverlay.style.setProperty('--flame-height', '45px');
    } else if (ratio < 1.0) {
      // Progressively expand from 10% to 85% of screen height
      const targetPercent = Math.round(10 + ratio * 75);
      flameOverlay.style.setProperty('--flame-height', `${targetPercent}vh`);
      flameOverlay.classList.remove('inferno-active');
      removeVignette();
    } else {
      // 10+ posts reached: FULL INFERNO!
      flameOverlay.style.setProperty('--flame-height', '100vh');
      flameOverlay.classList.add('inferno-active');
      triggerInferno();
    }
  }

  function resetFlamesToResting() {
    const flameOverlay = document.getElementById('linkedin-flames-overlay');
    if (flameOverlay) {
      flameOverlay.style.setProperty('--flame-height', '0px');
      flameOverlay.classList.remove('inferno-active');
    }
    removeVignette();
    removeModal();
    isInfernoActive = false;
  }

  // Trigger Full Inferno Modal & Screen Shake
  function triggerInferno() {
    if (isInfernoActive) return;
    isInfernoActive = true;

    // 1. Comic Screen Quake
    document.body.classList.add('inferno-quake');
    setTimeout(() => {
      document.body.classList.remove('inferno-quake');
    }, 600);

    // 2. Fiery Vignette Border
    addVignette();

    // 3. Show Intervention Modal
    showInterventionModal();
  }

  function addVignette() {
    if (!document.getElementById('inferno-vignette')) {
      const vignette = document.createElement('div');
      vignette.id = 'inferno-vignette';
      vignette.className = 'inferno-vignette';
      document.body.appendChild(vignette);
    }
  }

  function removeVignette() {
    const vignette = document.getElementById('inferno-vignette');
    if (vignette) vignette.remove();
  }

  function showInterventionModal() {
    if (document.getElementById('inferno-modal-overlay')) return;
    isModalOpen = true;

    const overlay = document.createElement('div');
    overlay.id = 'inferno-modal-overlay';
    overlay.innerHTML = `
      <div class="inferno-modal-card">
        <div class="inferno-demon-badge">🔥</div>
        <h2 class="inferno-modal-title">
          DOOMSCROLL INFERNO!
          <br>
          <span class="badge-highlight">${passedPosts.size} POSTS CONSUMED</span>
        </h2>
        <p class="inferno-modal-desc">
          You have scrolled past <strong>${passedPosts.size} posts</strong> on LinkedIn!
          Your time and attention are going up in smoke. It's time to choose:
          contribute something meaningful or escape the feed!
        </p>

        <div class="inferno-actions">
          <button class="inferno-btn inferno-btn-contribute" id="btn-doom-contribute">
            ✍️ Post Something & Contribute to Society
          </button>
          <button class="inferno-btn inferno-btn-leave" id="btn-doom-leave">
            🚪 Get Off LinkedIn & Save Your Brain
          </button>
          <button class="inferno-btn inferno-btn-snooze" id="btn-doom-snooze">
            💧 Extinguish with Water (5 min snooze)
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Handle Button 1: Post Something & Contribute
    document.getElementById('btn-doom-contribute').addEventListener('click', handleContributeAction);

    // Handle Button 2: Get Off LinkedIn
    document.getElementById('btn-doom-leave').addEventListener('click', handleLeaveAction);

    // Handle Button 3: Extinguish / Snooze
    document.getElementById('btn-doom-snooze').addEventListener('click', handleSnoozeAction);
  }

  function removeModal() {
    const modal = document.getElementById('inferno-modal-overlay');
    if (modal) modal.remove();
    isModalOpen = false;
  }

  // Action 1: Contribute to Society
  function handleContributeAction() {
    removeModal();
    resetFlamesToResting();

    // Reset passed count so user has a clean slate
    passedPosts.clear();
    isInfernoActive = false;

    // Smoothly scroll to the very top to reach the post composer
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      // Find LinkedIn "Start a post" button
      const postTriggers = [
        'button.share-box-feed-entry__trigger',
        'button[data-view-name="share-box-feed-entry-trigger"]',
        'div.share-box-feed-entry button',
        '#mock-start-post', // Demo button
        'button.artdeco-button--muted'
      ];

      let clicked = false;
      for (const sel of postTriggers) {
        const btn = document.querySelector(sel);
        if (btn) {
          btn.click();
          clicked = true;
          break;
        }
      }

      // Show celebratory toast
      const toast = document.getElementById('doom-celebrate-toast');
      if (toast) {
        toast.innerText = '💡 Excellent choice! Share your knowledge and contribute to society.';
        toast.classList.add('toast-show');
        setTimeout(() => toast.classList.remove('toast-show'), 4500);
      }
    }, 600);
  }

  // Action 2: Get Off LinkedIn
  function handleLeaveAction() {
    removeModal();

    // Try opening exit.html or redirect
    const exitUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('exit.html')
      : 'exit.html';

    // If on LinkedIn, navigate away to the zen exit page
    window.location.href = exitUrl;
  }

  // Action 3: Snooze for 5 minutes
  function handleSnoozeAction() {
    removeModal();
    const snoozeDurationMs = 5 * 60 * 1000; // 5 minutes
    config.snoozeUntil = Date.now() + snoozeDurationMs;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ snoozeUntil: config.snoozeUntil });
    }

    resetFlamesToResting();
    passedPosts.clear();
    isInfernoActive = false;

    const toast = document.getElementById('doom-celebrate-toast');
    if (toast) {
      toast.innerText = '💧 Sizzz! Flames doused. You have 5 minutes of peace.';
      toast.classList.add('toast-show');
      setTimeout(() => toast.classList.remove('toast-show'), 3500);
    }
  }

  // Listen to messages from popup (e.g. Test Inferno, Reset Count)
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'GET_STATUS') {
        sendResponse({
          scrolledPosts: passedPosts.size,
          maxPosts: config.maxPosts,
          isInferno: isInfernoActive
        });
      } else if (request.action === 'TEST_INFERNO') {
        // Mock reaching max posts to test immediately
        for (let i = 0; i < config.maxPosts; i++) {
          passedPosts.add(`test-post-${i}`);
        }
        updateDisplay();
        sendResponse({ success: true });
      } else if (request.action === 'RESET_COUNTER') {
        passedPosts.clear();
        isInfernoActive = false;
        resetFlamesToResting();
        updateDisplay();
        sendResponse({ success: true });
      }
      return true;
    });
  }

  // Throttled scroll listener
  let scrollTimeout = null;
  window.addEventListener('scroll', () => {
    if (scrollTimeout) return;
    scrollTimeout = setTimeout(() => {
      scrollTimeout = null;
      evaluateScroll();
    }, 60);
  }, { passive: true });

  // DOM MutationObserver to detect infinite scrolling posts loaded dynamically
  const observer = new MutationObserver((mutations) => {
    let hasNewNodes = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        hasNewNodes = true;
        break;
      }
    }
    if (hasNewNodes) {
      evaluateScroll();
    }
  });

  // Start initialization
  function start() {
    initOverlay();
    evaluateScroll();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
