# Wordo - Smart Word Learning Browser Extension

A lightweight, minimal Chrome extension that enables intelligent word lookup, translation, and vocabulary building directly from any webpage. Wordo captures selected text, fetches accurate definitions from external APIs, provides multi-language translations, and persists your learning journey through Chrome's native storage system.

## 📖 What is Wordo?

Wordo is a browser companion for language learners and curious readers. While browsing any website, you can:
- **Select** any word or phrase
- **Click** the Wordo extension icon
- **Instantly** see the definition, translation, and option to save to your vocabulary list

No disruption to your browsing flow. No complex navigation. Just select → click → learn.

## ✨ Features

- **Instant Word Definitions** - Get accurate definitions from Dictionary API with Wiktionary fallback
- **Multi-language Translations** - Translate to Filipino, Spanish, Japanese, Korean, or Chinese
- **Vocabulary Persistence** - Save words to your personal notes with timestamps
- **Smart Caching** - 1-hour TTL cache for definitions and translations (no redundant API calls)
- **PDF Support** - Works with PDF files in Chrome (with "Allow access to file URLs" permission)
- **Manual Input** - Type words directly without selecting text
- **Keyboard Shortcuts**:
  - `Ctrl+S` / `Cmd+S` - Save word
  - `Ctrl+X` - Clear selection
  - `Ctrl+Shift+C` - Clear all notes
  - `Ctrl+Z` / `Cmd+Z` - Undo last action
- **Undo History** - 20-action undo stack for saves, selections, and clears
- **Dark Mode** - Seamless light/dark theme toggle
- **Quick Search** - One-click Google search for word definitions
- **Minimal UI** - Clean, distraction-free popup interface
- **Smooth Animations** - 200ms unified transitions for polished feel

---

## 🏗️ System Architecture

### **Component Overview**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Chrome Browser Environment                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  📄 Webpage / PDF                                        │   │
│  │  (User selects word via triple-click or drag)           │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │ trigger                              │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  🔗 Content Script (content.js)                         │   │
│  │  • Captures selected text from DOM                       │   │
│  │  • Listens to extension icon click                       │   │
│  │  • Sends selected word to popup via messaging API        │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │ chrome.runtime.sendMessage()        │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  🎨 Popup (popup.html + popup.js)                       │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │ • Display selected word                           │  │   │
│  │  │ • Input field for manual entry                    │  │   │
│  │  │ • Buttons: Set, Search, Save, Clear              │  │   │
│  │  │ • Language selector (Filipino, Spanish, etc.)     │  │   │
│  │  │ • Definition display box                          │  │   │
│  │  │ • Translation display box                         │  │   │
│  │  │ • Saved words list with timestamps                │  │   │
│  │  │ • Dark mode toggle                                │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └────────────┬──────────────────────────────┬──────────────┘   │
│               │                              │                   │
│               │ getDefinition()              │ readCache()       │
│               │ translate()                  │ writeCache()      │
│               │                              │                   │
│               ▼                              ▼                   │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐ │
│  │  📚 Helper Logic         │  │  💾 Chrome Storage API       │ │
│  │  (helper.js)             │  │  (chrome.storage.local)      │ │
│  │                          │  │                              │ │
│  │ • API call handlers      │  │ Storage Schema:              │ │
│  │ • Error management       │  │ • cache: {                   │ │
│  │ • Timeout logic          │  │   def:word: {...}            │ │
│  │ • Text parsing           │  │   trans:word:lang: {...}     │ │
│  │ • DOM helper utils       │  │ }                            │ │
│  └──────────────────────────┘  │ • notes: [{...}]             │ │
│                                 │ • darkMode: boolean          │ │
│               │                 └──────────────────────────────┘ │
│               │ External API Calls                               │
│               ▼                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  🌐 External APIs                                        │   │
│  │                                                           │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ Dictionary API (https://api.dictionaryapi.dev/)    │ │   │
│  │  │ GET /api/v2/entries/en/{word}                      │ │   │
│  │  │ Returns: definitions, phonetics, word forms        │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                           │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ Wiktionary API (Fallback)                          │ │   │
│  │  │ GET /w/api.php?action=query&titles={word}          │ │   │
│  │  │ Returns: extracts for Tagalog/non-standard words   │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  │                                                           │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │ MyMemory Translation API                           │ │   │
│  │  │ GET /api/get?q={text}&langpair=en|{target_lang}    │ │   │
│  │  │ Returns: translated text                           │ │   │
│  │  └────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### **Data Flow Lifecycle**

#### **1️⃣ Word Selection & Capture**
```
User selects word on webpage
    ↓
Content Script (content.js) intercepts selection
    ↓
Extension icon triggered
    ↓
chrome.runtime.sendMessage() → sends selected text to popup
    ↓
Popup receives word via listener
```

#### **2️⃣ Definition Lookup**
```
User clicks "Set" in popup OR hits Enter in input field
    ↓
setSelectedWordUI(word) called
    ↓
Check cache: readCache('def:' + word)
    ├─ Cache HIT → Display cached definition instantly (← 1ms)
    └─ Cache MISS → Proceed to API call
    ↓
Call getDefinition(word) from helper.js
    ↓
Dictionary API request
    ├─ 200 OK → Parse response → writeCache() → Display
    └─ Error → Fallback to Wiktionary API
    ↓
Wiktionary fallback (for Tagalog/edge cases)
    ├─ 200 OK → Parse extract → Cache → Display
    └─ Error → Show "Definition not available"
```

#### **3️⃣ Translation Flow**
```
User selects target language from dropdown
    ↓
Language change triggers translation lookup
    ↓
Check cache: readCache('trans:' + word + ':' + language)
    ├─ Cache HIT → Display instantly
    └─ Cache MISS → Proceed to API
    ↓
Call translate(word, language) from helper.js
    ↓
MyMemory Translation API request
    ├─ 200 OK → Parse response → writeCache() → Display
    └─ Error → Show "Translation not available"
```

#### **4️⃣ Save Word (with Undo)**
```
User clicks "Save to Notes"
    ↓
Validation checks:
    ├─ Word exists? No → Return
    ├─ 1–2 words only? No → Return
    └─ Already saved? No → Proceed
    ↓
pushUndoState('save', { notes: previousNotes })
    ↓
Add to state.notes array + new timestamp
    ↓
chrome.storage.local.set({ notes: state.notes })
    ↓
renderNotes() → Display updated note list
    ↓
Definition stays visible (stays in definitionBox)
```

#### **5️⃣ Undo Action (Ctrl+Z / Cmd+Z)**
```
User presses undo shortcut
    ↓
executeUndo() called
    ↓
Pop from undoStack (max 20 actions stored)
    ↓
Restore previous state:
    ├─ If 'save' action → Remove note from list
    ├─ If 'clearNotes' action → Restore all notes
    └─ If 'clearSelection' action → Restore word + definition
    ↓
chrome.storage.local.set({ notes: restored.notes })
    ↓
UI updates seamlessly
```

#### **6️⃣ Persistent Storage (Chrome Storage API)**
```
All data stored in chrome.storage.local (per-browser, per-user):

{
  cache: {
    "def:word": { value: "...", ts: 1711000000000 },
    "trans:word:fil": { value: "...", ts: 1711000000000 }
    // 1-hour TTL: expired entries ignored on read
  },
  
  notes: [
    { word: "sesquipedalian", savedAt: 1710999999000 },
    { word: "defenestration", savedAt: 1710999998000 }
  ],
  
  darkMode: true
}

Persistence advantages:
• Survives browser restart
• Zero external server dependency
• Fast local reads (no network latency)
• Privacy: data never leaves device
```

---

## 🔌 Chrome Extension Messaging Protocol

### **Popup ↔ Content Script Communication**

```
┌─────────────────┐                    ┌──────────────────┐
│  popup.js       │                    │  content.js      │
│  (popup side)   │                    │  (webpage side)  │
└────────┬────────┘                    └────────┬─────────┘
         │                                      │
         │ chrome.tabs.sendMessage()            │
         │ {action: "getSelection"}             │
         │─────────────────────────────────────>│
         │                                      │
         │                         Read clipboard
         │                         Extract from DOM
         │                                      │
         │ chrome.runtime.onMessage.addListener │
         │<─────────────────────────────────────┤
         │ {data: "selected text"}              │
         │                                      │
    Parse word     
    Fetch definition
    Update UI
```

---

## 📊 Data Schema

### **Chrome Storage Structure**

```javascript
// Cache Schema (1-hour TTL per entry)
{
  cache: {
    "def:serendipity": {
      value: "the occurrence of events by chance in a happy or beneficial way",
      ts: 1711012345000
    },
    "trans:beautiful:fil": {
      value: "maganda",
      ts: 1711012346000
    }
  }
}

// Notes Schema (Vocabulary List)
{
  notes: [
    {
      word: "pragmatic",
      savedAt: 1711012000000
    },
    {
      word: "ephemeral",
      savedAt: 1711011999000
    }
  ]
}

// User Preferences
{
  darkMode: true
}
```

---

## 🔄 How Each Component Works

### **popup.js (Main Business Logic)**
- **State Management**: Maintains current word, notes list, undo stack
- **UI Event Handlers**: Click events for Save, Clear, Search buttons
- **Definition Fetching**: `setSelectedWordUI()` orchestrates API calls
- **Caching**: `readCache()` / `writeCache()` prevent redundant API calls
- **Undo System**: `pushUndoState()` / `executeUndo()` manage 20-action history
- **Keyboard Shortcuts**: Detects Ctrl+S, Ctrl+Z, Ctrl+Shift+C (platform-aware)

### **helper.js (External API Handler)**
- **getDefinition()**: Calls Dictionary API, falls back to Wiktionary
- **translate()**: Calls MyMemory Translation API
- **Error Handling**: Timeout logic (5s), fallback chains
- **Response Parsing**: Extracts relevant data from API responses

### **content.js (Webpage Integration)**
- **Selection Listener**: Detects user-selected text
- **Icon Click Handler**: Triggers when extension icon clicked
- **Message Relay**: Sends selected text to popup via `chrome.runtime.sendMessage()`
- **PDF Support**: Works in both webpages and PDF viewers

### **styles.css (UI Polish)**
- **Minimal Design**: No gradients, flat modern aesthetic
- **200ms Unified Transitions**: All animations (buttons, boxes, lists) use ease-in-out
- **Dark Mode**: Full dark color scheme with proper contrast
- **Responsive Layout**: Adapts to 300px minimum width

### **popup.html (Structure)**
- **Semantic HTML**: Proper ARIA labels for accessibility
- **Container Layout**: Stats → Input → Definition → Translation → Notes → Settings

---

## 🎯 Key Design Principles

| Principle | Implementation |
|-----------|-----------------|
| **Minimal** | No toast notifications; definition stays visible after actions |
| **Fast** | 1-hour cache eliminates redundant API calls |
| **Persistent** | Chrome Storage API preserves notes across sessions |
| **Smooth** | 200ms transitions, unified easing throughout |
| **Reliable** | Fallback chains (Dictionary → Wiktionary) prevent blank states |
| **Accessible** | Keyboard shortcuts (Ctrl+S, Ctrl+Z) + ARIA labels |

---

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the extension folder
5. **For PDF support:** Click "Details" on Wordo extension → Enable "Allow access to file URLs"

## Usage

### Method 1: Select Text
1. Select any word on a webpage
2. Click the Wordo extension icon
3. View the definition and translation instantly

### Method 2: Type Word
1. Click the Wordo extension icon
2. Type a word in the input box
3. Click "Set" or press Enter
4. View results

### Keyboard Shortcuts
- `Ctrl+S` / `Cmd+S` - Save word to notes
- `Ctrl+X` - Clear selection
- `Ctrl+Shift+C` - Clear all notes
- `Ctrl+Z` / `Cmd+Z` - Undo last action

## Technologies

- **Chrome Extension Manifest V3** - Modern extension API
- **Dictionary API** (https://dictionaryapi.dev) - Primary definition source
- **Wiktionary API** - Fallback for Tagalog/non-standard words
- **MyMemory Translation API** - Multi-language translation
- **Chrome Storage API** - Local data persistence
- **Chrome Messaging API** - Content script ↔ Popup communication
- **Vanilla JavaScript (ES6+)** - No frameworks, minimal dependencies

## System Flow Diagram

The following diagram illustrates the complete user interaction flow and system response paths within Wordo Extension:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     WORDO EXTENSION SYSTEM FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

                          ╔════════════════════════╗
                          ║  USER SELECTS WORD    ║
                          ║   (On Webpage)        ║
                          ╚═════════════╤══════════╝
                                        │
                                        ▼
                          ╔════════════════════════╗
                          ║  CONTENT SCRIPT       ║
                          ║  CAPTURES SELECTION   ║
                          ╚═════════════╤══════════╝
                                        │
                                        ▼
                    ╔═══════════════════════════════════╗
                    ║  SEND TO POPUP: Selected Word    ║
                    ║  Chrome Messaging API             ║
                    ╚═════════════╤═══════════════════╝
                                  │
                                  ▼
                    ╔══════════════════════════════════╗
                    ║  POPUP RECEIVES WORD            ║
                    ║  setSelectedWordUI()             ║
                    ╚════════╤═════════════════════════╝
                             │
                             ▼
                    ┌──────────────────────┐
                    │ Check Cache Status   │
                    │ (1-hour TTL)         │
                    └─────────┬────────┬───┘
                              │        │
                    ┌─────────▼──┐  ┌──▼─────────────┐
                    │  CACHED?   │  │  NOT CACHED?   │
                    │   YES      │  │    NO          │
                    └──────┬─────┘  └────┬───────────┘
                           │             │
            ┌──────────────▼─┐   ┌───────▼──────────────┐
            │ Load from      │   │ Fetch from APIs      │
            │ Chrome Storage │   │ (Dictionary API)     │
            │ (Memory only)  │   └──────┬──────────────┘
            └────────────────┘          │
                    │                   ▼
                    │          ┌────────────────────┐
                    │          │  Successfully      │
                    │          │  retrieved?        │
                    │          └─┬──────────────┬───┘
                    │            │              │
                    │  ┌─────────▼──┐   ┌──────▼─────────┐
                    │  │    YES     │   │     NO         │
                    │  │ Parse JSON │   │  Try Fallback  │
                    │  │ Extract    │   │  (Wiktionary)  │
                    │  │ Definition │   └────┬────────────┘
                    │  └─────────┬──┘         │
                    │            │           │
                    └──────────┬─┘           ▼
                               │    ┌────────────────┐
                               │    │  Fallback      │
                               │    │  Successful?   │
                               │    └─┬──────────┬───┘
                               │      │          │
                        ┌──────┴──────▼┐       ┌▼─────────┐
                        │ Definition   │       │ Show     │
                        │ Available    │       │ Error    │
                        │              │       │ Message  │
                        └──────┬───────┘       └──────────┘
                               │
                               ▼
                    ╔═══════════════════════════╗
                    ║ RENDER DEFINITION UI      ║
                    ║ • Word                    ║
                    ║ • Phonetic/Audio          ║
                    ║ • Part of Speech          ║
                    ║ • Meanings (max 3)        ║
                    ║ • Examples                ║
                    ║ (200ms fade-in animation) ║
                    ╚═════════════╤═════════════╝
                                  │
                    ┌─────────────▼──────────────┐
                    │  USER SELECTS ACTION      │
                    │  (Buttons)                │
                    └──┬───┬───┬───┬────────────┘
                       │   │   │   │
        ┌──────────┐   │   │   │   ┌──────────────┐
        │ TRANSLATE│   │   │   │   │ CLEAR        │
        │          │   │   │   │   │ SELECTION    │
        └────┬─────┘   │   │   │   └──────┬───────┘
             │         │   │   │          │
             ▼         │   │   ▼          ▼
    ┌─────────────┐    │   │  ┌──────────────────┐
    │ Translate   │    │   │  │ Reset UI         │
    │ Definition  │    │   │  │ Clear Definition │
    │ & Display   │    │   │  │ Clear Input      │
    │ (200ms)     │    │   │  │ State: ""        │
    │             │    │   │  │ Push Undo Stack  │
    └─────────────┘    │   │  └──────────────────┘
                       │   │
                       │   └──────────────┐
                       │                  │
                       ▼                  ▼
             ┌─────────────────┐   ┌────────────────┐
             │ SAVE WORD       │   │ DELETE NOTE    │
             │ (from list)     │   │ (from list)    │
             └────┬────────────┘   └───┬────────────┘
                  │                    │
                  ▼                    ▼
        ┌────────────────────┐  ┌──────────────────┐
        │ Validation Check   │  │ Remove from      │
        │ • 1-2 words only?  │  │ Saved Notes      │
        │ • Max length 50?   │  │ Chrome Storage   │
        │                    │  │ Push Undo Stack  │
        └────┬───────────┬───┘  └──────────────────┘
             │           │
        ┌────▼──┐    ┌───▼──────┐
        │ VALID │    │ INVALID  │
        │       │    │ (Reject) │
        └───┬───┘    └──────────┘
            │
            ▼
  ┌──────────────────────────┐
  │ Store to Chrome Storage  │
  │ • Add to notes array     │
  │ • Add timestamp          │
  │ • Persisted across      │
  │   sessions              │
  └────────┬─────────────────┘
           │
           ▼
  ┌──────────────────────────┐
  │ Push to Undo Stack       │
  │ • Action type: "save"    │
  │ • Previous state saved   │
  │ • Max 20 actions         │
  └────────┬─────────────────┘
           │
           ▼
  ╔════════════════════════╗
  ║ UPDATE UI              ║
  ║ • Increment stats      ║
  ║ • Render notes list    ║
  ║ • Show animations      ║
  ║ • Keep definition      ║
  ║ Definition stays       ║
  ║ visible (smooth UX)    ║
  ╚════════════════════════╝

┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONCURRENT FLOWS                                     │
└─────────────────────────────────────────────────────────────────────────────┘

UNDO ACTION (Ctrl+Z):
  ├─ Pop last action from stack
  ├─ Restore previous state
  │  ├─ If "save": Remove from notes
  │  ├─ If "clear": Restore selected word
  │  └─ If "delete": Restore deleted note
  └─ Re-render UI with 200ms animation

CACHE MANAGEMENT:
  ├─ Write on successful API fetch
  │  ├─ Key: word (lowercase)
  │  ├─ Value: { definition, translation, timestamp }
  │  └─ TTL: 1 hour (3600000ms)
  ├─ Check TTL before using
  │  ├─ If expired: Fetch fresh from API
  │  └─ If valid: Use cached copy
  └─ Persist across popup closes/opens

KEYBOARD SHORTCUTS:
  ├─ Ctrl+S / Cmd+S → Save word
  ├─ Ctrl+X → Clear selection
  ├─ Ctrl+Shift+C → Clear all notes
  └─ Ctrl+Z / Cmd+Z → Undo last action

┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONDITIONAL LOGIC DECISION TABLE                         │
└─────────────────────────────────────────────────────────────────────────────┘

WORD DETECTION:
  ┌─────────────────┬──────────────┬───────────────────────────────┐
  │ Condition       │ Result       │ Action                        │
  ├─────────────────┼──────────────┼───────────────────────────────┤
  │ Empty string    │ Invalid      │ Show placeholder, disable UI  │
  │ 1-2 words       │ Valid        │ Allow save, translate         │
  │ 3+ words        │ Invalid      │ Show "Too many words" hint    │
  │ > 50 chars      │ Invalid      │ Show "Too long" hint          │
  │ Special chars + │ Valid        │ Strip/sanitize, then proceed  │
  │ alphanumeric    │              │                               │
  └─────────────────┴──────────────┴───────────────────────────────┘

ACTION SELECTION:
  ┌─────────────────┬──────────────┬───────────────────────────────┐
  │ User Input      │ Condition    │ Processing Path               │
  ├─────────────────┼──────────────┼───────────────────────────────┤
  │ Select word     │ Has content? │ Fetch def + cache + render    │
  │ Click Save      │ Valid word?  │ Store + undo + rerender       │
  │ Click Translate │ Def loaded?  │ Fetch trans + cache + display │
  │ Click Clear     │ Word present?│ Reset state + undo + rerender │
  │ Click Delete    │ Note exists? │ Remove + undo + rerender      │
  │ Ctrl+Z          │ History?     │ Pop stack + restore + rerender│
  └─────────────────┴──────────────┴───────────────────────────────┘

RESULT HANDLING:
  ┌─────────────────┬──────────────┬───────────────────────────────┐
  │ Result Type     │ Status       │ Output Action                 │
  ├─────────────────┼──────────────┼───────────────────────────────┤
  │ Definition      │ Success      │ Parse + render + cache + UI   │
  │ Definition      │ API Error    │ Try fallback (Wiktionary)     │
  │ Definition      │ Not found    │ Show "No definition" message  │
  │ Translation     │ Success      │ Display in translation box    │
  │ Translation     │ Error        │ Show "Translation failed"     │
  │ Save operation  │ Valid        │ Store + history + UI update   │
  │ Save operation  │ Invalid      │ Show validation error         │
  │ Cache check     │ Hit          │ Load instant (no API call)    │
  │ Cache check     │ Miss/Expired │ Fetch fresh data from API     │
  └─────────────────┴──────────────┴───────────────────────────────┘

ANIMATION & STATE TRANSITIONS:
  ├─ Definition fade-in: 200ms ease-in-out (opacity 0→1)
  ├─ Button press: scale 0.95 + shadow (50ms active state)
  ├─ Hover effect: translateY -1px + enhanced shadow
  ├─ Word list stagger: First 3 items with 50ms delays
  ├─ All transitions: Unified 200ms ease-in-out timing
  └─ Dark mode toggle: Smooth 200ms color transition

PERSISTENCE & STATE MANAGEMENT:
  ├─ Chrome Local Storage
  │  ├─ notes: Array of saved words with timestamps
  │  ├─ cache: { word: { def, trans, timestamp } }
  │  ├─ darkMode: Boolean preference
  │  └─ undoStack: Array of max 20 previous states
  ├─ Local State Object
  │  ├─ word: Current selected/typed word
  │  ├─ notes: Copy of saved notes in memory
  │  └─ isPDF: Detected document type
  └─ Session State
     ├─ Definition box display status
     ├─ Translation box display status
     └─ UI animation states

```

### System Flow Key Features:

**Decision Points:**
- **Cache Status Check** - Determines if data needs API fetch or is available locally
- **Validation Check** - Ensures word meets 1-2 word and character length requirements
- **API Success Check** - Routes to fallback if primary API fails
- **Action Selection** - Routes user input to appropriate processing path

**Action Paths:**
1. **Definition Lookup** → Cache Check → API Fetch → Parse → Render → Cache Store
2. **Save Word** → Validation → Chrome Storage → Undo Stack → UI Update
3. **Translate** → Definition Available? → Fetch Translation → Display
4. **Clear Selection** → Reset State → Undo Stack → Rerender
5. **Delete Note** → Remove from Storage → Undo Stack → Rerender
6. **Undo Action** → Pop Stack → Restore State → Rerender

**Conditional Logic:**
- **Caching Layer** - Avoids redundant API calls within 1-hour window
- **Fallback Chain** - Dictionary API → Wiktionary API ensures coverage
- **Validation Gate** - Prevents invalid saves and maintains data integrity
- **Undo Depth** - Limits stack to 20 actions for memory efficiency
- **Animation Triggers** - Smooth 200ms transitions on all state changes

**Output Stages:**
1. *Loading* - Show spinner while fetching
2. *Definition Display* - Render with formatted structure
3. *Action Confirmation* - Update UI with operation result
4. *Persistence* - Store to Chrome Storage
5. *History Tracking* - Add to undo stack
6. *Rerender* - Update all visible elements

