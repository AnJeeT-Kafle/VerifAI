document.addEventListener('DOMContentLoaded', () => {
  const detectToggle  = document.getElementById('detectToggle');
  const toggleSubtitle= document.getElementById('toggleSubtitle');
  const toggleRow     = document.querySelector('.toggle-row');
  const statusText    = document.getElementById('statusText');
  const resultFlash   = document.getElementById('resultFlash');
  const flashDot      = document.getElementById('flashDot');
  const flashText     = document.getElementById('flashText');

  // ── Restore toggle state from storage on popup open ─────────────────────
  chrome.storage.local.get('verifaiEnabled', ({ verifaiEnabled }) => {
    if (verifaiEnabled) {
      detectToggle.checked = true;
      setToggleUI(true);
    }
  });

  // ── Toggle change handler ────────────────────────────────────────────────
  detectToggle.addEventListener('change', async () => {
    const isOn = detectToggle.checked;

    // Persist state so it survives popup close/reopen
    chrome.storage.local.set({ verifaiEnabled: isOn });

    setToggleUI(isOn);

    // Get active tab and send toggle message to content script
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    if (isOn) {
      // Inject content script first, then tell it to enable
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        chrome.tabs.sendMessage(tab.id, { type: 'VERIFAI_ENABLE' }).catch(() => {});
      } catch (err) {
        console.error('VerifAI: inject error', err);
        statusText.textContent = `Error: ${err.message}`;
      }
    } else {
      // Tell content script to disable and remove all buttons
      chrome.tabs.sendMessage(tab.id, { type: 'VERIFAI_DISABLE' }).catch(() => {});
    }
  });

  // ── Listen for per-image results from content.js ─────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'VERIFAI_IMAGE_RESULT') {
      showFlash(message.isAI, message.checking);
    }
  });

  // ── UI helpers ───────────────────────────────────────────────────────────
  function setToggleUI(isOn) {
    if (isOn) {
      toggleSubtitle.textContent = 'Detection is ON';
      toggleSubtitle.classList.add('on');
      toggleRow.classList.add('active');
      statusText.textContent = 'Click any image button to check it';
    } else {
      toggleSubtitle.textContent = 'Detection is off';
      toggleSubtitle.classList.remove('on');
      toggleRow.classList.remove('active');
      statusText.textContent = 'Toggle on to start detecting';
      resultFlash.classList.add('hidden');
    }
  }

  function showFlash(isAI, checking) {
    resultFlash.classList.remove('hidden', 'flash-ai', 'flash-real');
    flashDot.className = 'flash-dot';

    if (checking) {
      flashDot.classList.add('dot-checking');
      flashText.textContent = 'Checking image…';
      resultFlash.style.borderColor = '';
    } else if (isAI) {
      flashDot.classList.add('dot-ai');
      flashText.textContent = '⚠ AI-Generated image detected';
      resultFlash.classList.add('flash-ai');
    } else {
      flashDot.classList.add('dot-real');
      flashText.textContent = '✔ Authentic — not AI generated';
      resultFlash.classList.add('flash-real');
    }
  }
});
