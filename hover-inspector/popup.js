const statusEl = document.getElementById('status');
const toggleBtn = document.getElementById('toggleBtn');

init();

async function init() {
  const tab = await getActiveTab();
  const state = await safeSend(tab?.id, { type: 'GET_STATE' });
  updateUI(state?.enabled === true);
}

toggleBtn.addEventListener('click', async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  await ensureContentScript(tab.id);
  const result = await safeSend(tab.id, { type: 'TOGGLE_ASSISTANT' });

  if (result?.enabled !== undefined) {
    updateUI(result.enabled);
  }
});

function updateUI(enabled) {
  toggleBtn.textContent = enabled ? 'Disable Assistant' : 'Enable Assistant';
  setStatus(enabled ? 'Assistant overlay active' : 'Assistant disabled');
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function getActiveTab() {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs[0]));
  });
}

// Inyecta content script dinámicamente si no está presente
async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  } catch (err) {
    console.log("[Hover Inspector] Injecting content script...");
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['contentScript.js']
    });
  }
}

function safeSend(tabId, payload) {
  return new Promise(resolve => {
    if (!tabId) return resolve(null);
    try {
      chrome.tabs.sendMessage(tabId, payload, res => {
        const err = chrome.runtime.lastError;
        if (err) return resolve(null);
        resolve(res);
      });
    } catch {
      resolve(null);
    }
  });
}
