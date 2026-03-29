window.__wordo = window.__wordo || {};

window.__wordo.looksLikeWord = (text) => {
  if (!text || text.length === 0 || text.length > 100) return false;
  if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(text)) return false;
  const letterCount = (text.match(/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/g) || []).length;
  return letterCount >= text.length * 0.5;
};

window.__wordo.isPDFNow = () => {
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

window.__wordo.detectEnv = () => {
  const url = (location.href || '').toLowerCase();
  const contentType = (document.contentType || '').toLowerCase();
  
  const isPDF = contentType === 'application/pdf' ||
    !!document.querySelector('embed[type="application/pdf"], object[type="application/pdf"]') ||
    url.endsWith('.pdf') ||
    !!document.querySelector('.textLayer, #viewer, #viewerContainer, #pdfViewer, [data-pdfjs], #toolbarViewer, .pdfViewer') ||
    !!window.pdfjsLib ||
    !!document.querySelector('canvas[data-page-number]') ||
    Array.from(document.querySelectorAll('iframe[src]')).some((frame) => {
      const src = (frame.getAttribute('src') || '').toLowerCase();
      return src.includes('.pdf') || src.includes('pdf') || src.includes('viewer') || 
             src.includes('google.com/viewer') || src.includes('gview');
    });
  
  const isGoogleDocs = url.includes('docs.google.com/document') ||
    url.includes('docs.google.com/presentation') ||
    url.includes('docs.google.com/spreadsheets') ||
    url.includes('docs.google.com/drawings') ||
    !!document.querySelector('.kix-wordhtmlgenerator-word-node,.kix-selection-overlay,iframe.docs-texteventtarget-iframe,.kix-app-content,.docos-content,[data-docos-typed],.kix-document-content');
  
  return { isPDF, isGoogleDocs };
};

window.__wordo.getSelectionText = () => {
  const pick = (value) => String(value || '').trim();
  
  try {
    const selection = pick(window.getSelection?.().toString());
    if (selection && window.__wordo.looksLikeWord(selection)) return selection;
  } catch {}
  
  try {
    const docsIframe = document.querySelector('iframe.docs-texteventtarget-iframe');
    if (docsIframe && docsIframe.contentWindow) {
      const text = pick(docsIframe.contentWindow.getSelection?.().toString());
      if (text && window.__wordo.looksLikeWord(text)) return text;
    }
  } catch {}
  
  try {
    const overlay = document.querySelector('.kix-selection-overlay');
    const text = pick(overlay?.textContent);
    if (text && window.__wordo.looksLikeWord(text)) return text;
  } catch {}
  
  return '';
};

window.__wordo.normalizeWord = (text) => {
  const cleaned = (text || '').trim().replace(/\s+/g, ' ');
  const words = cleaned.split(' ');
  
  if (!cleaned || words.length < 1 || words.length > 3) return '';
  
  try {
    if (!/^[\p{L}\p{M}'\u2019\u2018\u02BC\u02BB\s-]+$/u.test(cleaned)) return '';
  } catch {
    if (!/^[A-Za-zñÑ'''\u02bc\u02bb\s-]+$/.test(cleaned)) return '';
  }
  
  return cleaned.toLowerCase();
};

