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

    // Init tools UI
    initToolsUI();
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

// ----------------- Tools UI -----------------

type ToolParam = {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean';
  placeholder?: string;
  optional?: boolean;
};

type ToolDef = {
  id: string;
  name: string;
  description: string;
  params: ToolParam[];
  run: (values: Record<string, any>) => Promise<any>;
};

function getActiveTabId(): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (tab && tab.id != null) resolve(tab.id);
      else reject(new Error('No active tab'));
    });
  });
}

async function runGetStoreData(): Promise<any> {
  const tabId = await getActiveTabId();
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: 'CWO_GET_STORE_DATA' }, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!res) { reject(new Error('No response from content script')); return; }
      if (res.success) resolve(res.data);
      else reject(new Error(res.error || 'Unknown error'));
    });
  });
}

async function runApplyStoreFilters(values: Record<string, any>): Promise<any> {
  // Build query from provided values
  const tabId = await getActiveTabId();
  const tab = await new Promise<chrome.tabs.Tab>((resolve) => chrome.tabs.get(tabId, resolve));
  const baseUrl = new URL(tab.url || 'https://www.customwheeloffset.com/store/wheels');
  baseUrl.pathname = '/store/wheels';

  // Clear existing relevant params
  const keys = ['dia', 'width', 'offset', 'brand', 'color', 'mat', 'reviews', 'bolt', 'page'];
  keys.forEach((k) => baseUrl.searchParams.delete(k));

  for (const k of keys) {
    const v = values[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      baseUrl.searchParams.set(k, String(v).trim());
    }
  }

  // Navigate, then wait for complete and query store data
  await new Promise<void>((resolve, reject) => {
    const listener = (updatedTabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.update(tabId, { url: baseUrl.toString() }, (t) => {
      if (chrome.runtime.lastError) {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error(chrome.runtime.lastError.message));
      }
    });
  });

  // After load, fetch store data to show output
  return runGetStoreData();
}

function initToolsUI() {
  const tools: ToolDef[] = [
    {
      id: 'getStoreData',
      name: 'Get Store Data',
      description: 'Extract filters, products, and pagination from the current wheels store page.',
      params: [],
      run: async () => runGetStoreData(),
    },
    {
      id: 'applyStoreFilters',
      name: 'Apply Store Filters',
      description: 'Navigate to /store/wheels with selected filters, then extract the results.',
      params: [
        { key: 'brand', label: 'Brand', type: 'string', placeholder: 'e.g., Method' , optional: true},
        { key: 'dia', label: 'Diameter', type: 'string', placeholder: 'e.g., 20', optional: true },
        { key: 'width', label: 'Width', type: 'string', placeholder: 'e.g., 12', optional: true },
        { key: 'offset', label: 'Offset', type: 'string', placeholder: 'e.g., -44', optional: true },
        { key: 'bolt', label: 'Bolt Pattern', type: 'string', placeholder: 'e.g., 6x139.7', optional: true },
        { key: 'mat', label: 'Material', type: 'string', placeholder: 'e.g., Forged', optional: true },
        { key: 'color', label: 'Finish', type: 'string', placeholder: 'e.g., Black', optional: true },
        { key: 'reviews', label: 'Min Reviews', type: 'number', placeholder: 'e.g., 4', optional: true },
        { key: 'page', label: 'Page', type: 'number', placeholder: 'e.g., 2', optional: true },
      ],
      run: async (vals) => runApplyStoreFilters(vals),
    },
  ];

  const select = byId<HTMLSelectElement>('tool-select');
  const paramsEl = byId<HTMLDivElement>('tool-params');
  const helpEl = byId<HTMLSpanElement>('tool-help');
  const runBtn = byId<HTMLButtonElement>('tool-run');
  const outputEl = byId<HTMLPreElement>('tool-output');

  // Populate select
  select.innerHTML = '';
  tools.forEach((t, i) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    if (i === 0) opt.selected = true;
    select.appendChild(opt);
  });

  function renderParams(tool: ToolDef) {
    paramsEl.innerHTML = '';
    helpEl.textContent = tool.description;
    tool.params.forEach((p) => {
      const label = document.createElement('label');
      label.htmlFor = `tool-param-${p.key}`;
      label.textContent = p.label;

      const input = document.createElement('input');
      input.id = `tool-param-${p.key}`;
      input.placeholder = p.placeholder || '';
      input.setAttribute('data-key', p.key);
      input.setAttribute('data-type', p.type);
      input.style.cssText = 'padding:6px 8px; border:1px solid #e1e5e9; border-radius:6px;';

      if (p.type === 'number') input.type = 'number'; else input.type = 'text';

      paramsEl.appendChild(label);
      paramsEl.appendChild(input);
    });
  }

  function getSelectedTool(): ToolDef {
    const id = select.value;
    const tool = tools.find((t) => t.id === id)!;
    return tool;
  }

  select.addEventListener('change', () => renderParams(getSelectedTool()));
  renderParams(getSelectedTool());

  runBtn.textContent = 'Run';
  runBtn.addEventListener('click', async () => {
    const tool = getSelectedTool();
    const values: Record<string, any> = {};
    tool.params.forEach((p) => {
      const el = document.getElementById(`tool-param-${p.key}`) as HTMLInputElement | null;
      if (!el) return;
      const v = el.value;
      if (v === '' && p.optional) return;
      values[p.key] = p.type === 'number' ? (v ? Number(v) : undefined) : v;
    });

    outputEl.textContent = 'Running…';
    try {
      const result = await tool.run(values);
      outputEl.textContent = JSON.stringify(result, null, 2);
    } catch (e: any) {
      outputEl.textContent = `Error: ${e?.message || String(e)}`;
    }
  });
}
