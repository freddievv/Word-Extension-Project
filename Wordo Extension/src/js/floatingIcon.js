(function () {
  "use strict";

  if (window.__wordoFloatingIcon) return;
  window.__wordoFloatingIcon = true;


  let floatingButton = null;
  let hideTimeout = null;
  let lastSelectedText = "";

  const ORIGINAL_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>';

  function createFloatingButton() {
    const btn = document.createElement("div");

    btn.id = "wordo-floating-icon";
    btn.innerHTML = ORIGINAL_ICON_SVG;

      btn.style.cssText = `
      position: fixed;
      z-index: 2147483647;
      width: 36px;
      height: 36px;
      background: #4a90d9;
      color: white;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 6px 18px rgba(0,0,0,0.28);
      display: none;
      align-items: center;
      justify-content: center;
      user-select: none;
      transition: opacity 180ms ease, transform 180ms cubic-bezier(.2,.9,.2,1);
      opacity: 0;
      transform: scale(0.88) translateY(0);
      will-change: opacity, transform, left, top;
    `;

    
    btn.setAttribute('role', 'button');
    btn.setAttribute('aria-label', 'Lookup selected word');
    btn.tabIndex = 0;

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (!lastSelectedText) return;

try {
  if (chrome?.runtime?.id) {
    chrome.runtime.sendMessage({
      action: "wordoFloatingSelected",
      word: lastSelectedText,
      openPopup: true
    });
  }
} catch (e) {
  console.warn("Wordo: extension context lost");
}
    });

    btn.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        btn.click();
      }
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.03)';
      btn.style.boxShadow = '0 8px 22px rgba(0,0,0,0.3)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 6px 18px rgba(0,0,0,0.28)';
    });

    (document.body || document.documentElement).appendChild(btn);

    return btn;
  }

  function positionIcon(range) {
    if (!floatingButton) return;

    const rect = range.getBoundingClientRect();

    let top = rect.top - 40;
    let left = rect.right + 8;

    
    const BUTTON_SIZE = 36;
    const PAD = 8;
    if (left + BUTTON_SIZE + PAD > window.innerWidth) {
      left = rect.left - BUTTON_SIZE - 8;
    }

    if (left < PAD) left = PAD;

    if (top < PAD) {
      top = rect.bottom + 8;
    }
    if (top + BUTTON_SIZE + PAD > window.innerHeight) {
      top = Math.max(PAD, window.innerHeight - BUTTON_SIZE - PAD);
    }

    floatingButton.style.display = 'flex';
    window.requestAnimationFrame(() => {
      floatingButton.style.left = Math.round(left) + 'px';
      floatingButton.style.top = Math.round(top) + 'px';
      
      window.requestAnimationFrame(() => {
        floatingButton.style.opacity = '1';
        floatingButton.style.transform = 'scale(1)';
      });
    });
  }

  function hideIcon() {
    if (!floatingButton) return;
    if (hideTimeout) clearTimeout(hideTimeout);
    floatingButton.style.opacity = '0';
    floatingButton.style.transform = 'scale(0.92)';
    hideTimeout = setTimeout(() => {
      if (floatingButton) floatingButton.style.display = 'none';
    }, 220);
  }

  function handleSelection() {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
      hideIcon();
      return;
    }

    const text = selection.toString().trim();

    if (!text || text.length > 100) {
      hideIcon();
      return;
    }

    if (text === lastSelectedText && floatingButton?.style.display === "flex") {
      return;
    }

    lastSelectedText = text;

    const range = selection.getRangeAt(0);

    if (!floatingButton) {
      floatingButton = createFloatingButton();
    }

    clearTimeout(hideTimeout);

    if (floatingButton._posTimer) clearTimeout(floatingButton._posTimer);
    floatingButton._posTimer = setTimeout(() => positionIcon(range), 40);
  }

  document.addEventListener("mouseup", function () {
    setTimeout(handleSelection, 20);
  });

  document.addEventListener("selectionchange", handleSelection);

  document.addEventListener(
    "scroll",
    function () {
      const selection = window.getSelection();

      if (!selection || selection.isCollapsed) {
        hideIcon();
      }
    },
    { passive: true }
  );

  document.addEventListener("mousedown", function (e) {
    if (floatingButton && !floatingButton.contains(e.target)) {
      hideIcon();
    }
  });
})();