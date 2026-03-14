(async () => {

  // ── Constants ─────────────────────────────────────────────────────────────
  const MIN_WIDTH  = 100;
  const MIN_HEIGHT = 100;
  const BTN_CLASS  = 'verifai-detect-btn';
  const BADGE_CLASS= 'verifai-badge';

  // ── Inject VerifAI button styles into the page ────────────────────────────
  if (!document.getElementById('verifai-styles')) {
    const style = document.createElement('style');
    style.id = 'verifai-styles';
    style.textContent = `
      .verifai-detect-btn {
        position: absolute;
        top: 8px;
        left: 8px;
        z-index: 2147483647;
        background: rgba(13, 15, 20, 0.92);
        color: #6ee7b7;
        border: 1px solid #6ee7b7;
        border-radius: 6px;
        font-size: 11px;
        font-family: system-ui, sans-serif;
        font-weight: 700;
        letter-spacing: 0.04em;
        padding: 4px 10px;
        cursor: pointer;
        pointer-events: all;
        white-space: nowrap;
        box-shadow: 0 2px 12px rgba(0,0,0,0.5);
        transition: background 0.15s ease, transform 0.1s ease;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .verifai-detect-btn:hover {
        background: rgba(110, 231, 183, 0.15);
        transform: scale(1.04);
      }
      .verifai-detect-btn.checking {
        color: #facc15;
        border-color: #facc15;
        pointer-events: none;
        animation: verifai-pulse 0.7s ease infinite;
      }
      .verifai-detect-btn.result-ai {
        color: #f87171;
        border-color: #f87171;
        background: rgba(248, 113, 113, 0.15);
        pointer-events: none;
      }
      .verifai-detect-btn.result-real {
        color: #6ee7b7;
        border-color: #6ee7b7;
        background: rgba(110, 231, 183, 0.15);
        pointer-events: none;
      }
      @keyframes verifai-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.5; }
      }
      .verifai-badge {
        position: absolute;
        z-index: 2147483647;
        font-size: 11px;
        font-family: system-ui, sans-serif;
        font-weight: 700;
        letter-spacing: 0.03em;
        padding: 3px 8px;
        border-radius: 5px;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        white-space: nowrap;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Helper: get all qualifying images ─────────────────────────────────────
  function getQualifiedImages() {
    return Array.from(document.querySelectorAll('img')).filter(img => {
      const w = img.naturalWidth  || img.width;
      const h = img.naturalHeight || img.height;
      return w >= MIN_WIDTH && h >= MIN_HEIGHT && img.src && img.src.startsWith('http');
    });
  }

  // ── Helper: ensure parent is positioned ───────────────────────────────────
  function ensurePositioned(el) {
    if (el && getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
    }
  }

  // ── Add a "Detect this image" button over a single image ──────────────────
  function addDetectButton(img) {
    // Don't add twice
    if (img.dataset.verifaiBtn === 'true') return;
    img.dataset.verifaiBtn = 'true';

    const parent = img.parentElement;
    ensurePositioned(parent);

    const btn = document.createElement('button');
    btn.className = BTN_CLASS;
    btn.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
      Detect
    `;

    // Position button over the image
    if (parent) {
      parent.appendChild(btn);
      btn.style.top  = `${img.offsetTop  + 8}px`;
      btn.style.left = `${img.offsetLeft + 8}px`;
    }

    // ── Button click: check this image ──────────────────────────────────────
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Show checking state
      btn.className = `${BTN_CLASS} checking`;
      btn.innerHTML = `
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        Checking…
      `;

      // Notify popup to show checking state
      chrome.runtime.sendMessage({ type: 'VERIFAI_IMAGE_RESULT', checking: true });

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'VERIFAI_CHECK_IMAGE',
          imageUrl: img.src
        });

        const isAI = response?.isAI;

        // Update button to show result
        if (isAI) {
          btn.className = `${BTN_CLASS} result-ai`;
          btn.innerHTML = '⚠ AI-Generated';
          applyBorder(img, true);
        } else {
          btn.className = `${BTN_CLASS} result-real`;
          btn.innerHTML = '✔ Authentic';
          applyBorder(img, false);
        }

        // Notify popup of result
        chrome.runtime.sendMessage({ type: 'VERIFAI_IMAGE_RESULT', isAI, checking: false });

      } catch (err) {
        console.warn('VerifAI: check failed', err);
        btn.className = BTN_CLASS;
        btn.innerHTML = '⚠ Retry';
      }
    });
  }

  // ── Apply coloured border to image ────────────────────────────────────────
  function applyBorder(img, isAI) {
    img.style.outline       = `3px solid ${isAI ? '#f87171' : '#6ee7b7'}`;
    img.style.outlineOffset = '2px';
  }

  // ── Remove all VerifAI buttons and badges from the page ───────────────────
  function removeAll() {
    document.querySelectorAll(`.${BTN_CLASS}`).forEach(el => el.remove());
    document.querySelectorAll(`.${BADGE_CLASS}`).forEach(el => el.remove());
    document.querySelectorAll('[data-verifai-btn]').forEach(el => {
      el.style.outline = '';
      el.style.outlineOffset = '';
      delete el.dataset.verifaiBtn;
    });
  }

  // ── Enable: add buttons to all qualified images ───────────────────────────
  function enableDetection() {
    getQualifiedImages().forEach(addDetectButton);

    // Also watch for new images added dynamically (infinite scroll etc.)
    if (!window.__verifaiObserver) {
      window.__verifaiObserver = new MutationObserver(() => {
        getQualifiedImages().forEach(addDetectButton);
      });
      window.__verifaiObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  // ── Disable: remove everything ────────────────────────────────────────────
  function disableDetection() {
    removeAll();
    if (window.__verifaiObserver) {
      window.__verifaiObserver.disconnect();
      window.__verifaiObserver = null;
    }
  }

  // ── Listen for messages from popup.js ─────────────────────────────────────
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'VERIFAI_ENABLE')  enableDetection();
    if (message.type === 'VERIFAI_DISABLE') disableDetection();
  });

  // ── On inject: check if toggle was already ON (e.g. after page navigation) ─
  chrome.storage.local.get('verifaiEnabled', ({ verifaiEnabled }) => {
    if (verifaiEnabled) enableDetection();
  });

})();
