function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

async function dumpStorage() {
  const local = await chrome.storage.local.get(null);
  const sync = await chrome.storage.sync.get(null).catch(() => ({}));
  const dump = { local, sync };
  byId('storage-dump').textContent = JSON.stringify(dump, null, 2);
}

async function clearLocalStorage() {
  await chrome.storage.local.clear();
  await dumpStorage();
}

function openChatWidgetTab() {
  const url = new URL(chrome.runtime.getURL('chat-widget.html'));
  url.searchParams.set('autoOpen', '1');
  window.open(url.toString(), '_blank');
}

function openCwoSite() {
  window.open('https://www.customwheeloffset.com', '_blank');
}

function toggleEmbeddedChat() {
  const frame = byId<HTMLIFrameElement>('chat-iframe');
  if (!frame.src) {
    const url = new URL(chrome.runtime.getURL('chat-widget.html'));
    url.searchParams.set('autoOpen', '1');
    frame.src = url.toString();
  }
  frame.style.display = frame.style.display === 'none' ? 'block' : 'none';
}

async function init() {
  try {
    // Environment info
    const manifest = chrome.runtime.getManifest();
    byId('ext-version').textContent = manifest.version || 'n/a';
    // chrome.runtime.id may be undefined in some contexts; fallback to URL parse
    const id = chrome.runtime.id || location.host.split('/')[0];
    byId('ext-id').textContent = id || 'unknown';

    // Buttons
    byId('open-chat-widget').addEventListener('click', openChatWidgetTab);
    byId('open-test-cwo').addEventListener('click', openCwoSite);
    byId('refresh-storage').addEventListener('click', dumpStorage);
    byId('clear-storage').addEventListener('click', clearLocalStorage);
    byId('toggle-chat-iframe').addEventListener('click', toggleEmbeddedChat);

    // Initial storage dump
    await dumpStorage();
  } catch (e) {
    console.error('Debug page init error', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

export {};

