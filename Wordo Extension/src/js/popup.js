document.addEventListener('DOMContentLoaded', async () => {
  const ui = {
    selectedWord: document.getElementById('selectedWord'),
    definitionBox: document.getElementById('definitionBox'),
    translateBox: document.getElementById('translateBox'),
    notesList: document.getElementById('notesList'),
    wordInput: document.getElementById('wordInput'),
    btnSetWord: document.getElementById('btnSetWord'),
    btnSave: document.getElementById('btnSave'),
    btnSearch: document.getElementById('btnSearch'),
    btnClearNotes: document.getElementById('btnClearNotes'),
    btnClearSelected: document.getElementById('btnClearSelected'),
    targetLang: document.getElementById('targetLang'),
    darkModeToggle: document.getElementById('darkModeToggle')
  };

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  if (ui.btnSave) ui.btnSave.title = isMac ? 'Save (Cmd+S)' : 'Save (Ctrl+S)';
  if (ui.btnClearSelected) ui.btnClearSelected.title = 'Clear selection (Ctrl+X)';
  if (ui.btnClearNotes) ui.btnClearNotes.title = 'Clear all notes (Ctrl+Shift+C)';

  let state = { word: '', notes: [], isPDF: false };
  const CACHE_TTL = 1000 * 60 * 60; 
  let lastDisplayedWord = '';
  let undoStack = [];



  const pushUndoState = (action, previousState) => {
    undoStack.push({ action, previousState, timestamp: Date.now() });
    if (undoStack.length > 20) undoStack.shift();
  };

  const executeUndo = () => {
    if (undoStack.length === 0) return;
    const undo = undoStack.pop();
    const { action, previousState } = undo;

    if (action === 'save') {
      state.notes = previousState.notes;
      chrome.storage.local.set({ notes: state.notes }, () => {
        renderNotes();
        ui.definitionBox.textContent = previousState.definition || 'Select a word on the page first, then click the extension icon';
      });
    } else if (action === 'clearNotes') {
      state.notes = previousState.notes;
      chrome.storage.local.set({ notes: state.notes }, () => {
        renderNotes();
        ui.definitionBox.textContent = previousState.definition || 'Select a word on the page first, then click the extension icon';
      });
    } else if (action === 'clearSelection') {
      state.word = previousState.word;
      ui.selectedWord.textContent = state.word || 'None';
      ui.definitionBox.textContent = previousState.definition || 'Select a word on the page first, then click the extension icon';
      ui.translateBox.textContent = previousState.translation || 'Choose a language to translate';
    }
  };

  const readCache = async (key) => {
    try {
      const storage = await new Promise((resolve) => chrome.storage.local.get('cache', resolve));
      const c = storage.cache || {};
      const entry = c[key];
      if (!entry) return null;
      if (Date.now() - (entry.ts || 0) > CACHE_TTL) return null;
      return entry.value;
    } catch { return null; }
  };

  const writeCache = async (key, value) => {
    try {
      const storage = await new Promise((resolve) => chrome.storage.local.get('cache', resolve));
      const c = storage.cache || {};
      c[key] = { value, ts: Date.now() };
      await new Promise((resolve) => chrome.storage.local.set({ cache: c }, resolve));
    } catch {}
  };

  const getTab = window.__wordoHelper.getTab;
  const isValidTab = window.__wordoHelper.isValidTab;
  const sendMessage = window.__wordoHelper.sendMessage;
  const broadcast = window.__wordoHelper.broadcast;
  const looksLikeWord = window.__wordoHelper.looksLikeWord;
  const readClipboardText = window.__wordoHelper.readClipboardText;
  const getDefinition = window.__wordoHelper.getDefinition;
  const translate = window.__wordoHelper.translate;
  const getSelectionFromPage = window.__wordoHelper.getSelectionFromPage;

  const setSelectedWordUI = async (w) => {
    const rawWord = String(w || '').trim();
    state.word = rawWord;
    
    if (canSaveWord(rawWord)) {
      ui.selectedWord.textContent = rawWord;
    } else if (rawWord) {
      ui.selectedWord.textContent = 'Select only 1-2 words';
    } else {
      ui.selectedWord.textContent = 'None';
    }

    if (!canSaveWord(rawWord)) return;

    const defKey = `def:${state.word.toLowerCase()}`;
    const transKey = `trans:${state.word.toLowerCase()}:${ui.targetLang.value}`;

    ui.definitionBox.classList.add('loading');
    ui.translateBox.classList.add('loading');
    ui.definitionBox.classList.add('fade-temp');
    ui.translateBox.classList.add('fade-temp');

    
    const cachedDef = await readCache(defKey);
    if (cachedDef) {
      ui.definitionBox.textContent = cachedDef;
      ui.definitionBox.classList.remove('loading');
      ui.definitionBox.classList.add('fade-in');
    } else {
      ui.definitionBox.textContent = 'Loading definition...';
      try {
        const definition = await getDefinition(state.word);
        ui.definitionBox.textContent = definition;
        ui.definitionBox.classList.remove('loading');
        ui.definitionBox.classList.add('fade-in');
        writeCache(defKey, definition);
      } catch (error) {
        if (state.word.length === 1) {
          ui.definitionBox.textContent = 'Single character selected. Use Quick Search or type a full word.';
        } else {
          ui.definitionBox.textContent = error.message || 'Definition not available.';
        }
        ui.definitionBox.classList.remove('loading');
        ui.definitionBox.classList.add('fade-in');
      }
    }

    
    if (!canTranslateWord(state.word)) {
      ui.translateBox.textContent = 'Word is too long to translate';
      ui.translateBox.classList.remove('loading');
      ui.translateBox.classList.add('fade-in');
    } else {
      const cachedTrans = await readCache(transKey);
      if (cachedTrans) {
        ui.translateBox.textContent = cachedTrans;
        ui.translateBox.classList.remove('loading');
        ui.translateBox.classList.add('fade-in');
      } else {
        ui.translateBox.textContent = 'Translating...';
        try {
          const translated = await translate(state.word, ui.targetLang.value);
          ui.translateBox.textContent = translated;
          ui.translateBox.classList.remove('loading');
          ui.translateBox.classList.add('fade-in');
          writeCache(transKey, translated);
        } catch (error) {
          if (state.word.length === 1) {
            ui.translateBox.textContent = 'Single character selected — translation may be unavailable.';
          } else {
            ui.translateBox.textContent = error.message || 'Translation not available.';
          }
          ui.translateBox.classList.remove('loading');
          ui.translateBox.classList.add('fade-in');
        }
      }
    }

    ui.definitionBox.classList.remove('fade-temp');
    ui.translateBox.classList.remove('fade-temp');

    lastDisplayedWord = state.word;
    try { updateSaveButton(); } catch (e) {}

    setTimeout(() => {
      ui.definitionBox.classList.remove('fade-in');
      ui.translateBox.classList.remove('fade-in');
    }, 200);
  };

  
  const canSaveWord = (w) => {
    try {
      if (!w) return false;
      const s = String(w || '').trim();
      if (!s) return false;
      
      const norm = window.__wordo && window.__wordo.normalizeWord ? window.__wordo.normalizeWord(s) : '';
      if (norm) {
        const cnt = norm.split(' ').filter(Boolean).length;
        return cnt >= 1 && cnt <= 2;
      }
      
      const parts = s.split(/\s+/).filter(Boolean);
      if (parts.length < 1 || parts.length > 2) return false;
      for (const p of parts) {
        if (window.__wordoHelper && window.__wordoHelper.looksLikeWord) {
          if (!window.__wordoHelper.looksLikeWord(p)) return false;
        } else {
          if (!/^[A-Za-z\p{L}]/u.test(p)) return false;
        }
      }
      return true;
    } catch (e) { return false; }
  };

  const canTranslateWord = (w) => {
    try {
      return canSaveWord(w);
    } catch (e) { return false; }
  };

  const updateSaveButton = () => {
    try {
      const ok = canSaveWord(state.word || ui.wordInput.value);
      ui.btnSave.disabled = !ok;
      if (!ok) {
        ui.btnSave.setAttribute('aria-disabled', 'true');
        ui.btnSave.style.opacity = '0.6';
        ui.btnSave.style.cursor = 'not-allowed';
        ui.btnSave.title = 'Only 1–2 words can be saved';
      } else {
        ui.btnSave.removeAttribute('aria-disabled');
        ui.btnSave.style.opacity = '';
        ui.btnSave.style.cursor = '';
        ui.btnSave.removeAttribute('title');
      }
    } catch (e) {}
  };

  const renderNotes = () => {
    const previousItems = Array.from(ui.notesList.querySelectorAll('.word-item'));
    previousItems.forEach(item => item.classList.add('removing'));

    setTimeout(() => {
      ui.notesList.innerHTML = '';

      if (!state.notes.length) {
        const empty = document.createElement('div');
        empty.className = 'word-item show';
        empty.innerHTML = '<div class="word-info"><span class="word-text">No saved words yet.</span></div>';
        ui.notesList.appendChild(empty);
        return;
      }

      state.notes.slice().reverse().forEach((note, index) => {
        const item = document.createElement('div');
        item.className = 'word-item';
        item.style.cursor = 'pointer';
        const dateStr = note.savedAt ? new Date(note.savedAt).toLocaleDateString() : '';
        item.innerHTML = `<div class="word-info"><span class="word-text">${note.word}</span>${dateStr ? `<span class="word-date">${dateStr}</span>` : ''}</div>`;
        item.addEventListener('click', async () => {
          setSelectedWordUI(note.word);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.type = 'button';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Remove this word';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const actualIndex = state.notes.length - 1 - index;
          const wordToRemove = note.word;
          state.notes.splice(actualIndex, 1);
          chrome.storage.local.set({ notes: state.notes }, () => {
            renderNotes();
          });
        });
        item.appendChild(deleteBtn);
        ui.notesList.appendChild(item);
        setTimeout(() => item.classList.add('show'), index < 3 ? index * 30 : 90);
      });
    }, 200);
  };

  const checkPendingWord = () => {
    return new Promise((resolve) => {
      chrome.storage.local.get('pendingWord', (storage) => {
        if (storage.pendingWord) {
          const word = storage.pendingWord;
          chrome.storage.local.remove('pendingWord', () => {
            resolve(word);
          });
        } else {
          resolve(null);
        }
      });
    });
  };

  const waitForPendingWord = async () => {
    let word = await checkPendingWord();
    if (word) return word;

    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 100));
      word = await checkPendingWord();
      if (word) return word;
    }
    return null;
  };

  const storage = await new Promise((resolve) => {
    chrome.storage.local.get(['darkMode', 'notes', 'pendingWord'], resolve);
  });

  const pendingWordFromFloating = await waitForPendingWord();

  if (pendingWordFromFloating) {
    setSelectedWordUI(pendingWordFromFloating);
  } else if (storage.pendingWord) {
    const pendingWord = storage.pendingWord;
    chrome.storage.local.remove('pendingWord');
    setSelectedWordUI(pendingWord);
  }

  const isDarkMode = !!storage.darkMode;
  ui.darkModeToggle.checked = isDarkMode;
  document.body.classList.toggle('dark-mode', isDarkMode);
  
  state.notes = Array.isArray(storage.notes) ? storage.notes : [];
  renderNotes();
  try { updateSaveButton(); } catch (e) {}

  const currentTab = await getTab();
  const tabIsValid = isValidTab(currentTab);

  if (tabIsValid) {
    const ping = await sendMessage('ping');
    state.isPDF = !!ping?.isPDF || !!currentTab?.url?.toLowerCase().endsWith('.pdf');
    await sendMessage('setDarkMode', { enabled: isDarkMode });
    await broadcast('setDarkMode', { enabled: isDarkMode });

    if (state.isPDF) {
      const clipboard = await readClipboardText();
      if (clipboard && looksLikeWord(clipboard)) {
        setSelectedWordUI(clipboard);
      }
    }

    if (!state.word) {
      const selectedText = await getSelectionFromPage();
      if (selectedText) {
        setSelectedWordUI(selectedText);
      }
    }

    if (state.isPDF) {
      if (state.word) await setSelectedWordUI(state.word);
      else ui.definitionBox.textContent = 'Select text in PDF, then open Wordo press Ctrl+C,.';
    } else {
      if (state.word) await setSelectedWordUI(state.word);
      else ui.definitionBox.textContent = 'Select a word on the page first, then click the extension icon';
    }
  } else {
    ui.definitionBox.textContent = "Extension doesn't work on Chrome pages. Open a website.";
  }

  ui.btnSetWord.addEventListener('click', async () => {
    const word = ui.wordInput.value.trim();
    if (word) {
      setSelectedWordUI(word);
      const ping = await sendMessage('ping');
      state.isPDF = !!ping?.isPDF || state.isPDF;
    }
  });

  ui.wordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      ui.btnSetWord.click();
    }
  });

  ui.wordInput.addEventListener('input', () => {
    try { updateSaveButton(); } catch (e) {}
  });



  ui.btnSearch.addEventListener('click', () => {
    if (state.word) {
      chrome.tabs.create({ 
        url: `https://www.google.com/search?q=${encodeURIComponent(`define ${state.word}`)}`
      });
    }
  });

  if (ui.targetLang) {
    ui.targetLang.addEventListener('change', async () => {
      if (!state.word) return;
      
      if (!canTranslateWord(state.word)) {
        ui.translateBox.textContent = 'Word is too long to translate';
        return;
      }

      const transKey = `trans:${state.word.toLowerCase()}:${ui.targetLang.value}`;
      const cached = await readCache(transKey);
      if (cached) {
        ui.translateBox.textContent = cached;
        ui.translateBox.classList.add('fade-in');
        setTimeout(() => ui.translateBox.classList.remove('fade-in'), 200);
        return;
      }

      ui.translateBox.classList.add('loading');
      ui.translateBox.textContent = 'Translating...';
      try {
        const translated = await translate(state.word, ui.targetLang.value);
        ui.translateBox.textContent = translated;
        writeCache(transKey, translated);
      } catch (error) {
        if (state.word.length === 1) ui.translateBox.textContent = 'Single character selected — translation may be unavailable.';
        else ui.translateBox.textContent = error.message || 'Failed to translate.';
      }
      ui.translateBox.classList.remove('loading');
      ui.translateBox.classList.add('fade-in');
      setTimeout(() => ui.translateBox.classList.remove('fade-in'), 200);
    });
  }
  if (ui.btnClearSelected) {
    ui.btnClearSelected.addEventListener('click', () => {
      pushUndoState('clearSelection', {
        word: state.word,
        definition: ui.definitionBox.textContent,
        translation: ui.translateBox.textContent
      });

      state.word = '';
      ui.wordInput.value = '';

      ui.selectedWord.classList.add('fade-temp');
      ui.definitionBox.classList.add('fade-temp');
      ui.translateBox.classList.add('fade-temp');

      setTimeout(() => {
        ui.selectedWord.textContent = 'None';
        ui.definitionBox.classList.remove('loading');
        ui.translateBox.classList.remove('loading');
        ui.definitionBox.textContent = 'Select a word on the page first, then click the extension icon';
        ui.translateBox.textContent = 'Choose a language to translate';

        ui.selectedWord.classList.remove('fade-temp');
        ui.definitionBox.classList.remove('fade-temp');
        ui.translateBox.classList.remove('fade-temp');

        lastDisplayedWord = '';
        try { updateSaveButton(); } catch (e) {}
      }, 200);
    });
  }


  ui.btnSave.addEventListener('click', () => {
    const candidate = state.word || ui.wordInput.value.trim();
    if (!candidate) {
      return;
    }

    if (!canSaveWord(candidate)) {
      return;
    }

    if (state.notes.some((note) => note.word.toLowerCase() === candidate.toLowerCase())) {
      return;
    }

    pushUndoState('save', { notes: [...state.notes] });
    state.notes.push({ word: candidate, savedAt: Date.now() });
    chrome.storage.local.set({ notes: state.notes }, () => {
      renderNotes();
      updateSaveButton();
    });
  });

  ui.btnClearNotes.addEventListener('click', () => {
    if (!state.notes.length) return;
    pushUndoState('clearNotes', { notes: [...state.notes] });
    state.notes = [];
    chrome.storage.local.set({ notes: state.notes }, () => {
      renderNotes();
    });
  });

  ui.darkModeToggle.addEventListener('change', async () => {
    const darkModeEnabled = ui.darkModeToggle.checked;
    document.body.classList.toggle('dark-mode', darkModeEnabled);
    chrome.storage.local.set({ darkMode: darkModeEnabled });
    await sendMessage('setDarkMode', { enabled: darkModeEnabled });
    await broadcast('setDarkMode', { enabled: darkModeEnabled });
  });

  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const saveShortcut = isMac ? (e.metaKey && e.key === 's') : (e.ctrlKey && e.key === 's');
    const clearSelection = e.ctrlKey && e.key === 'x';
    const clearAllNotes = e.ctrlKey && e.shiftKey && e.key === 'C';
    const undoShortcut = isMac ? (e.metaKey && e.key === 'z') : (e.ctrlKey && e.key === 'z');

    if (saveShortcut) {
      e.preventDefault();
      ui.btnSave.click();
    } else if (clearSelection) {
      e.preventDefault();
      ui.btnClearSelected.click();
    } else if (clearAllNotes) {
      e.preventDefault();
      ui.btnClearNotes.click();
    } else if (undoShortcut) {
      e.preventDefault();
      executeUndo();
    }
  });

});