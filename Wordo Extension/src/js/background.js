chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  if (!request || request.action !== "wordoFloatingSelected") return false;

  const word = request.word;

  chrome.storage.local.set({ pendingWord: word }, () => {

    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    sendResponse({ success: true });

    if (request.openPopup) openWordoPopup();

  });

  return true;

});


function openWordoPopup() {
  try {
    if (chrome.action && chrome.action.openPopup) chrome.action.openPopup().catch(() => {});
  } catch (e) {}
}