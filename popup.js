/**
 * Popup Script for LinkedIn Doomscroll Inferno
 */

document.addEventListener('DOMContentLoaded', () => {
  const toggleFlames = document.getElementById('toggle-flames');
  const thresholdSlider = document.getElementById('threshold-slider');
  const thresholdVal = document.getElementById('threshold-val');
  const btnTestInferno = document.getElementById('btn-test-inferno');
  const btnResetCounter = document.getElementById('btn-reset-counter');
  const counterText = document.getElementById('popup-counter-text');
  const progressFill = document.getElementById('popup-progress-fill');
  const heatBadge = document.getElementById('heat-badge');

  function getStorage(keys, cb) {
    try {
      const storage = chrome.storage.local || chrome.storage.sync;
      if (storage) { storage.get(keys, cb); return; }
    } catch (_) {}
    cb({});
  }

  function setStorage(items) {
    try {
      const storage = chrome.storage.local || chrome.storage.sync;
      if (storage) storage.set(items);
    } catch (_) {}
  }

  // Check whether the current tab is a LinkedIn (or demo) tab
  function isLinkedInTab(url) {
    if (!url) return false;
    return url.includes('linkedin.com') || url.includes('demo.html');
  }

  // Load saved settings
  getStorage(['maxPosts', 'flamesEnabled'], (res) => {
    if (res && res.maxPosts) {
      thresholdSlider.value = res.maxPosts;
      thresholdVal.textContent = `${res.maxPosts} posts`;
    }
    if (res && res.flamesEnabled !== undefined) {
      toggleFlames.checked = res.flamesEnabled;
    }
  });

  // Show a "not on LinkedIn" state in the popup
  function showNotOnLinkedIn() {
    counterText.textContent = 'Open LinkedIn to track posts';
    heatBadge.textContent = 'Inactive';
    heatBadge.style.background = '#F3F4F6';
    heatBadge.style.color = '#6B7280';
    btnTestInferno.disabled = true;
    btnTestInferno.style.opacity = '0.5';
    btnResetCounter.disabled = true;
    btnResetCounter.style.opacity = '0.5';
  }

  // Poll current tab status — only send messages if on a LinkedIn tab
  function fetchTabStatus() {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) { showNotOnLinkedIn(); return; }

        const tab = tabs[0];

        // Guard: don't send a message if not on LinkedIn
        if (!isLinkedInTab(tab.url)) {
          showNotOnLinkedIn();
          return;
        }

        // Safe sendMessage with explicit lastError check to suppress console errors
        chrome.tabs.sendMessage(tab.id, { action: 'GET_STATUS' }, (response) => {
          // Read lastError immediately — this is what clears the error from the console
          const err = chrome.runtime.lastError;
          if (err || !response) {
            // Content script not injected yet — tab probably needs a refresh
            counterText.textContent = 'Refresh the LinkedIn tab to activate';
            heatBadge.textContent = 'Not Loaded';
            heatBadge.style.background = '#FFF8E6';
            heatBadge.style.color = '#A37200';
            return;
          }

          const count = response.scrolledPosts || 0;
          const max = response.maxPosts || 10;
          const percent = Math.min(100, Math.round((count / max) * 100));

          counterText.textContent = `${count} / ${max} posts scrolled`;
          progressFill.style.width = `${percent}%`;

          if (response.isInferno || percent >= 100) {
            heatBadge.textContent = '🔥 INFERNO';
            heatBadge.style.background = '#FFEAEA';
            heatBadge.style.color = '#C41400';
          } else if (percent > 60) {
            heatBadge.textContent = '🥵 Scorching';
            heatBadge.style.background = '#FFF3D6';
            heatBadge.style.color = '#D95A00';
          } else if (percent > 20) {
            heatBadge.textContent = 'Warm';
            heatBadge.style.background = '#FFF8E6';
            heatBadge.style.color = '#A37200';
          } else {
            heatBadge.textContent = 'Simmering';
            heatBadge.style.background = '#E8F5E9';
            heatBadge.style.color = '#2E7D32';
          }
        });
      });
    } catch (_) {}
  }

  fetchTabStatus();

  // Slider change
  thresholdSlider.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    thresholdVal.textContent = `${val} posts`;
    setStorage({ maxPosts: val });
  });

  // Toggle flames
  toggleFlames.addEventListener('change', (e) => {
    setStorage({ flamesEnabled: e.target.checked });
  });

  // Helper: send message only to LinkedIn tabs
  function sendToLinkedIn(action, cb) {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0] || !isLinkedInTab(tabs[0].url)) return;
        chrome.tabs.sendMessage(tabs[0].id, { action }, () => {
          // Consume lastError so Chrome doesn't log it
          void chrome.runtime.lastError;
          if (cb) cb();
        });
      });
    } catch (_) {}
  }

  // Test Inferno button
  btnTestInferno.addEventListener('click', () => {
    sendToLinkedIn('TEST_INFERNO', fetchTabStatus);
  });

  // Reset Counter button
  btnResetCounter.addEventListener('click', () => {
    sendToLinkedIn('RESET_COUNTER', fetchTabStatus);
  });
});
