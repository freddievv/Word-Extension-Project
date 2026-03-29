window.__wordoHelper = window.__wordoHelper || {};

window.__wordoHelper.getTab = () => new Promise((resolve) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs?.[0]));
});

window.__wordoHelper.isValidTab = (tab) => {
  return tab?.url && 
         !tab.url.startsWith('chrome://') && 
         !tab.url.startsWith('chrome-extension://');
};

window.__wordoHelper.sendMessage = async (action, data = {}) => {
  const tab = await window.__wordoHelper.getTab();
  if (!window.__wordoHelper.isValidTab(tab)) return null;
  
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { action, ...data }, (resp) => {
      resolve(chrome.runtime.lastError ? null : resp);
    });
  });
};

window.__wordoHelper.broadcast = async (action, data = {}) => {
  const tab = await window.__wordoHelper.getTab();
  if (!tab) return;
  
  try {
    if (chrome.scripting?.executeScript) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: (a, d) => window.postMessage({ __wordo: true, action: a, ...d }, '*'),
        args: [action, data]
      });
    }
  } catch {}
};

window.__wordoHelper.looksLikeWord = (text) => {
  const t = String(text || '').trim();
  if (!t || t.length > 100) return false;
  if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(t)) return false;
  const letterCount = (t.match(/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/g) || []).length;
  return letterCount >= t.length * 0.5;
};

window.__wordoHelper.readClipboardText = async () => {
  try {
    if (navigator.clipboard?.readText) {
      const text = String(await navigator.clipboard.readText()).trim();
      if (text) return text;
    }
  } catch {}
  
  try {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand && document.execCommand('paste');
    const value = String(textarea.value || '').trim();
    document.body.removeChild(textarea);
    if (success && value) return value;
  } catch {}
  
  return '';
};

window.__wordoHelper.fetchWithTimeout = (url, timeout = 10000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  return fetch(url, { signal: controller.signal })
    .then((response) => {
      clearTimeout(timer);
      return response;
    })
    .catch((error) => {
      clearTimeout(timer);
      throw error;
    });
};

window.__wordoHelper.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

window.__wordoHelper.getDefinition = async (word) => {
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await window.__wordoHelper.fetchWithTimeout(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
          8000
        );

        if (response?.ok) {
          let data = null;
          try { data = await response.json(); } catch (e) { console.warn('Dictionary JSON parse failed', e); }
          const meanings = data?.[0]?.meanings || [];
          if (meanings.length) {
            const output = [];
            meanings.slice(0, 3).forEach((meaning, idx) => {
              const part = meaning.partOfSpeech || 'meaning';
              const definitions = meaning.definitions || [];

              if (definitions.length > 0) {
                if (idx > 0) output.push('\n' + '─'.repeat(24));
                output.push(`\n${part.toUpperCase()}\n`);
                definitions.slice(0, 2).forEach((def, i) => {
                  if (def.definition) {
                    output.push(`${i + 1}. ${def.definition}`);
                    if (def.example) output.push(`  "${def.example}"`);
                  }
                });
              }
            });

            if (output.length) return output.join('\n').trim();
          }
        }
      } catch (err) {
        if (err && err.name === 'AbortError') throw new Error('Request timeout. Please try again.');
        console.warn('Dictionary attempt failed', err);
        if (attempt === 0) await window.__wordoHelper.sleep(250);
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout. Please try again.');
    }
  }
  
  const candidates = [word, word.toLowerCase(), word[0] ? word[0].toUpperCase() + word.slice(1) : word];
  
  for (const candidate of candidates) {
    try {
      const wikiResponse = await window.__wordoHelper.fetchWithTimeout(
        `https://en.wiktionary.org/api/rest_v1/page/summary/${encodeURIComponent(candidate)}`,
        7000
      );
      if (wikiResponse?.ok) {
        let wikiData = null;
        try { wikiData = await wikiResponse.json(); } catch (e) { console.warn('Wiktionary JSON parse failed', e); }
        if (wikiData?.extract) return wikiData.extract;
      }
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('Request timeout. Please try again.');
      console.warn('Wiktionary fetch failed for', candidate, error);
    }
  }
  
  return 'Definition not available. Try selecting a single word, or Search for more results.';
};

window.__wordoHelper.translate = async (word, targetLang) => {
  const cleanWord = (w) => String(w || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s'-]/g, '').trim();
  const cleaned = cleanWord(word);
  
  if (!cleaned) {
    throw new Error('Please enter a valid word to translate.');
  }
  
  if (cleaned.length > 100) {
    throw new Error('Word is too long. Please enter a shorter word.');
  }
  
  const singularize = (w) => {
    if (w.endsWith('ies') && w.length > 3) return w.slice(0, -3) + 'y';
    if (w.endsWith('es') && !w.endsWith('ss') && w.length > 2) return w.slice(0, -2);
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 1) return w.slice(0, -1);
    return w;
  };
  
  const pastTense = (w) => {
    if (w.endsWith('ied')) return w.slice(0, -3) + 'y';
    if (w.endsWith('ed') && w.length > 2) return w.slice(0, -2);
    return w;
  };
  
  const ingForm = (w) => {
    if (w.endsWith('ing') && w.length > 4) return w.slice(0, -3);
    return w;
  };
  
  const candidates = [cleaned, singularize(cleaned), pastTense(cleaned), ingForm(cleaned)];
  const uniqueCandidates = [...new Set(candidates)];
  
  const tryTranslate = async (text) => {
    if (!text) return null;

    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timeoutMs = 8000 + attempt * 3000;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${encodeURIComponent(targetLang)}`,
          { signal: controller.signal }
        );
        clearTimeout(timer);

        if (!response.ok) {
          console.warn('Translate response not ok', response.status);
          if (attempt === 0) await window.__wordoHelper.sleep(200);
          continue;
        }

        let data = null;
        try { data = await response.json(); } catch (e) { console.warn('Translate JSON parse failed', e); }

        if (!data || typeof data !== 'object') {
          if (attempt === 0) await window.__wordoHelper.sleep(200);
          continue;
        }

        if (data.responseStatus === 200 && data.responseData?.translatedText) {
          let translated = data.responseData.translatedText.trim();
          const originalClean = text.toLowerCase().trim();

          if (Array.isArray(data.matches) && data.matches.length) {
            const prefer = data.matches.find((m) => {
              if (!m || !m.translation) return false;
              const t = String(m.translation).trim();
              if (!t) return false;
              if (t.toLowerCase() === originalClean) return false;
              if (t.length > 60) return false;
              return true;
            });
            if (prefer && prefer.translation) translated = String(prefer.translation).trim();
          }

          if (translated && translated.toLowerCase() !== originalClean) return translated;
        }

        if (attempt === 0) await window.__wordoHelper.sleep(200);
      } catch (error) {
        clearTimeout(timer);
        if (error && error.name === 'AbortError') {
          console.warn('Translate request timed out');
        } else {
          console.warn('Translate fetch failed', error);
        }
        if (attempt === 0) await window.__wordoHelper.sleep(250);
      }
    }
    return null;
  };
  
  for (const candidate of uniqueCandidates) {
    const result = await tryTranslate(candidate);
    if (result) return result;
    
    await new Promise(r => setTimeout(r, 100));
  }
  
  throw new Error('Translation not found. Try a simpler word form.');
};

window.__wordoHelper.getSelectionFromPage = async () => {
  const tab = await window.__wordoHelper.getTab();
  if (!window.__wordoHelper.isValidTab(tab)) return '';
  
  const trim = (value) => String(value || '').trim();
  
  try {
    if (chrome.scripting?.executeScript) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => {
          const pick = (v) => String(v || '').trim();
          
          const direct = pick(window.getSelection?.().toString());
          if (direct) return direct;
          
          try {
            const activeElement = document.activeElement;
            if (activeElement) {
              const tag = (activeElement.tagName || '').toUpperCase();
              if ((tag === 'INPUT' || tag === 'TEXTAREA') && typeof activeElement.selectionStart === 'number') {
                const value = pick(activeElement.value);
                const start = activeElement.selectionStart;
                const end = activeElement.selectionEnd;
                const part = pick(value.slice(start, end));
                if (part) return part;
              }
              
              if (activeElement.isContentEditable) {
                const selected = pick(window.getSelection?.().toString());
                if (selected) return selected;
              }
            }
          } catch {}
          
          try {
            const docsIframe = document.querySelector('iframe.docs-texteventtarget-iframe');
            if (docsIframe && docsIframe.contentWindow) {
              const text = pick(docsIframe.contentWindow.getSelection?.().toString());
              if (text) return text;
            }
          } catch {}
          
          const overlay = document.querySelector('.kix-selection-overlay');
          const overlayText = pick(overlay?.textContent);
          if (overlayText) return overlayText;
          
          return '';
        }
      });
      
      if (Array.isArray(results)) {
        for (const result of results) {
          const value = String(result?.result || '').trim();
          if (value && window.__wordoHelper.looksLikeWord(value)) {
            return value;
          }
        }
      }
    }
  } catch {}
  
  const fromContent = await new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { action: 'getSelection' }, (resp) => {
      resolve(chrome.runtime.lastError || !resp ? '' : String(resp.word || '').trim());
    });
  });
  
  if (fromContent && window.__wordoHelper.looksLikeWord(fromContent)) {
    return fromContent;
  }
  
  const clipboard = await window.__wordoHelper.readClipboardText();
  if (clipboard && window.__wordoHelper.looksLikeWord(clipboard)) {
    return clipboard;
  }
  
  return '';
};

