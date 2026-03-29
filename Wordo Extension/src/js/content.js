(function() {
  'use strict';

  if (window.__wordoLoaded) return;
  window.__wordoLoaded = true;

  const detectEnv = () => {
    const url = (location.href || '').toLowerCase();
    const contentType = (document.contentType || '').toLowerCase();

    const isPDF = () => {
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
      return false;
    };

    const isGoogleDocs = () => {
      const urlPatterns = [
        'docs.google.com/document',
        'docs.google.com/presentation',
        'docs.google.com/spreadsheets',
        'docs.google.com/drawings'
      ];
      if (urlPatterns.some(pattern => url.includes(pattern))) return true;

      const selectors = [
        '.kix-wordhtmlgenerator-word-node',
        '.kix-selection-overlay',
        '.docs-texteventtarget-iframe',
        '.kix-app-content',
        '.docos-content',
        '[data-docos-typed]',
        '.kix-document-content'
      ];
      if (document.querySelector(selectors.join(','))) return true;

      const gdocIframe = Array.from(document.querySelectorAll('iframe[src*="docs.google.com"]')).some((frame) => {
        const src = frame.getAttribute('src') || '';
        return src.includes('docs.google.com/document') || src.includes('docs.google.com/spreadsheets');
      });
      if (gdocIframe) return true;

      return false;
    };

    return { isPDF: isPDF(), isGoogleDocs: isGoogleDocs() };
  };

  const getSelectionText = () => window.__wordo?.getSelectionText?.() || '';

  const { isPDF, isGoogleDocs } = detectEnv();

  const handleMessage = (request, sender, sendResponse) => {
    if (!request || typeof request.action !== 'string') return;

    if (request.action === 'ping') {
      sendResponse({ ready: true, isPDF: !!isPDF, isGoogleDocs: !!isGoogleDocs });
      return true;
    }

    if (request.action === 'getSelection') {
      const word = getSelectionText();
      sendResponse({ word, isPDF: !!isPDF, isGoogleDocs: !!isGoogleDocs });
      return true;
    }

    if (request.action === 'setDarkMode') {
      sendResponse({ success: true, isPDF: !!isPDF, isGoogleDocs: !!isGoogleDocs });
      return true;
    }

    

    sendResponse({ isPDF: !!isPDF, isGoogleDocs: !!isGoogleDocs });
    return true;
  };

  chrome.runtime.onMessage.addListener(handleMessage);
})();

