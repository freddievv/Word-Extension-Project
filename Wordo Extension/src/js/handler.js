(function() {
  'use strict';

  if (window.__wordoPDFLoaded) return;
  window.__wordoPDFLoaded = true;

  const isPDFNow = () => {
    const url = (location.href || '').toLowerCase();
    const contentType = (document.contentType || '').toLowerCase();

    if (contentType === 'application/pdf') return true;
    if (document.querySelector('embed[type="application/pdf"], object[type="application/pdf"]')) return true;
    if (url.endsWith('.pdf')) return true;
    if (url.includes('drive.google.com/file') || url.includes('drive.google.com/view')) return true;
    if (url.includes('docs.google.com/gview') || url.includes('docs.google.com/viewer')) return true;
    if (document.querySelector('.textLayer, #viewer, #viewerContainer, #pdfViewer, [data-pdfjs], #toolbarViewer, .pdfViewer')) return true;
    if (window.pdfjsLib || document.querySelector('canvas[data-page-number]')) return true;

    const iframePdf = Array.from(document.querySelectorAll('iframe[src]')).some((frame) => {
      const src = (frame.getAttribute('src') || '').toLowerCase();
      return src.includes('.pdf') || src.includes('pdf') || src.includes('viewer') || 
             src.includes('google.com/viewer') || src.includes('gview');
    });
    if (iframePdf) return true;

    if (url.includes('docs.google.com/document') || url.includes('docs.google.com/presentation') || 
        url.includes('docs.google.com/spreadsheets') || url.includes('docs.google.com/drawings')) return true;

    return false;
  };

  const getSelectionText = () => {
    const pick = (value) => String(value || '').trim();
    
    try {
      const selection = pick(window.getSelection?.().toString());
      if (selection && window.__wordo?.looksLikeWord?.(selection)) return selection;
    } catch {}

    try {
      const docsIframe = document.querySelector('iframe.docs-texteventtarget-iframe');
      if (docsIframe && docsIframe.contentWindow) {
        const text = pick(docsIframe.contentWindow.getSelection?.().toString());
        if (text && window.__wordo?.looksLikeWord?.(text)) return text;
      }
    } catch {}

    try {
      const overlay = document.querySelector('.kix-selection-overlay');
      const text = pick(overlay?.textContent);
      if (text && window.__wordo?.looksLikeWord?.(text)) return text;
    } catch {}

    return '';
  };

  const initPDFHandler = () => {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (!request || typeof request.action !== 'string') return;

      if (request.action === 'ping') {
        sendResponse({ ready: true, isPDF: true });
        return true;
      }

      if (request.action === 'getSelection') {
        const word = window.__wordo ? getSelectionText() : '';
        sendResponse({ word, isPDF: true });
        return true;
      }

      if (request.action === 'setDarkMode') {
        sendResponse({ success: true, isPDF: true });
        return true;
      }

      sendResponse({ isPDF: true });
      return true;
    });
  };

  if (isPDFNow()) {
    initPDFHandler();
    return;
  }

  const startTime = Date.now();
  const pollInterval = setInterval(() => {
    if (isPDFNow()) {
      clearInterval(pollInterval);
      initPDFHandler();
    }
    if (Date.now() - startTime > 10000) {
      clearInterval(pollInterval);
    }
  }, 250);
})();

