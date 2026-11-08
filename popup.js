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

  // Load saved settings
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['maxPosts', 'flamesEnabled'], (res) => {
      if (res.maxPosts) {
        thresholdSlider.value = res.maxPosts;
        thresholdVal.textContent = `${res.maxPosts} posts`;
      }
      if (res.flamesEnabled !== undefined) {
        toggleFlames.checked = res.flamesEnabled;
      }
    });
  }

  // Poll current tab status
  function fetchTabStatus() {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !tabs[0].id) return;

      chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_STATUS' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          counterText.textContent = 'Active on LinkedIn / Demo';
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
  }

  fetchTabStatus();

  // Slider change
  thresholdSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    thresholdVal.textContent = `${val} posts`;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ maxPosts: Number(val) });
    }
  });

  // Toggle flames
  toggleFlames.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ flamesEnabled: enabled });
    }
  });

  // Test Inferno button
  btnTestInferno.addEventListener('click', () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !tabs[0].id) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'TEST_INFERNO' }, () => {
        fetchTabStatus();
      });
    });
  });

  // Reset Counter button
  btnResetCounter.addEventListener('click', () => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0] || !tabs[0].id) return;
      chrome.tabs.sendMessage(tabs[0].id, { action: 'RESET_COUNTER' }, () => {
        fetchTabStatus();
      });
    });
  });
});
