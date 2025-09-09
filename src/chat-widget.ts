function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

class CustomWheelOffsetChatWidget {
  private isOpen = true;
  private currentMode: 'chat' | 'debug' = 'chat';
  private messages: Array<{ sender: 'user' | 'assistant'; content: string; timestamp: Date }> = [];
  private isLoading = false;

  private modeToggleBtn!: HTMLButtonElement;
  private chatMode!: HTMLElement;
  private debugMode!: HTMLElement;
  private chatMessages!: HTMLElement;
  private chatInput!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;
  private clearBtn!: HTMLButtonElement;
  private debugSearchBtn!: HTMLButtonElement;
  private debugOutput!: HTMLElement;
  private toolSelect!: HTMLSelectElement;
  private toolParams!: HTMLElement;
  private tools: any[] = [];

  constructor() {
    this.initializeElements();
    this.bindEvents();
    this.loadChatHistory();
    this.setWelcomeTime();
    // Ensure we start scrolled to bottom on open
    try { this.scrollToBottom(); } catch {}
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autoOpen') === '1') window.scrollTo(0, 0);
    } catch {}
  }

  private initializeElements() {
    this.modeToggleBtn = document.getElementById('cwo-mode-toggle') as HTMLButtonElement;
    this.chatMode = document.getElementById('cwo-chat-mode') as HTMLElement;
    this.debugMode = document.getElementById('cwo-debug-mode') as HTMLElement;
    this.chatMessages = document.getElementById('cwo-chat-messages') as HTMLElement;
    this.chatInput = document.getElementById('cwo-chat-input') as HTMLInputElement;
    this.sendBtn = document.getElementById('cwo-send-btn') as HTMLButtonElement;
    this.clearBtn = document.getElementById('cwo-clear-btn') as HTMLButtonElement;
    this.debugSearchBtn = document.getElementById('cwo-debug-search-btn') as HTMLButtonElement;
    this.debugOutput = document.getElementById('cwo-debug-output') as HTMLElement;
    this.toolSelect = document.getElementById('cwo-tool-select') as HTMLSelectElement;
    this.toolParams = document.getElementById('cwo-tool-params') as HTMLElement;
  }

  private bindEvents() {
    if (this.modeToggleBtn) {
      this.modeToggleBtn.addEventListener('click', () => {
        const next: 'chat' | 'debug' = this.currentMode === 'chat' ? 'debug' : 'chat';
        this.switchMode(next);
        this.updateModeToggleLabel();
      });
      this.updateModeToggleLabel();
    }

    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.chatInput.addEventListener('keypress', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.clearBtn.addEventListener('click', () => this.clearChatHistory());
    this.initToolsUI();
    this.debugSearchBtn.addEventListener('click', () => this.executeSelectedTool());
  }

  private switchMode(mode: 'chat' | 'debug') {
    this.currentMode = mode;
    this.chatMode.style.display = mode === 'chat' ? 'flex' : 'none';
    this.debugMode.classList.toggle('active', mode === 'debug');
    if (mode === 'chat') this.chatInput.focus();
  }

  private updateModeToggleLabel() {
    if (this.modeToggleBtn) this.modeToggleBtn.textContent = this.currentMode === 'debug' ? 'Chat' : 'Debug';
  }

  private async sendMessage() {
    const text = this.chatInput.value.trim();
    if (!text || this.isLoading) return;
    this.addMessage('user', text);
    this.chatInput.value = '';
    this.setSendButtonLoading(true);
    try {
      const reply = await this.sendToChatGPT(text);
      this.addMessage('assistant', reply);
    } catch (err) {
      console.error('ChatGPT API error:', err);
      this.addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
    } finally {
      this.setSendButtonLoading(false);
    }
  }

  private addMessage(sender: 'user' | 'assistant', content: string) {
    const msg = { sender, content, timestamp: new Date() };
    this.messages.push(msg);
    this.renderMessage(msg);
    this.saveChatHistory();
    this.scrollToBottom();
  }

  private renderMessage(m: { sender: 'user' | 'assistant'; content: string; timestamp: Date }) {
    const wrap = document.createElement('div');
    wrap.className = `cwo-message ${m.sender}`;
    const content = document.createElement('div');
    content.className = 'cwo-message-content';
    if (m.sender === 'assistant') {
      content.innerHTML = this.renderMarkdown(m.content);
    } else {
      content.textContent = m.content;
    }
    const time = document.createElement('div');
    time.className = 'cwo-message-time';
    time.textContent = this.formatTime(m.timestamp);
    wrap.appendChild(content);
    wrap.appendChild(time);
    this.chatMessages.appendChild(wrap);
  }

  private formatTime(d: Date) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private setSendButtonLoading(loading: boolean) {
    this.isLoading = loading;
    this.sendBtn.disabled = loading;
    this.sendBtn.innerHTML = loading ? '<div class="cwo-loading"></div>' : 'Send';
  }

  private clearChatHistory() {
    if (!confirm('Are you sure you want to clear the chat history?')) return;
    this.messages = [];
    this.chatMessages.innerHTML = `
      <div class="cwo-message assistant">
        <div class="cwo-message-content">
          Hello! I'm your Custom Wheel Offset assistant. I can help you find wheels, compare prices, and answer questions about products. How can I help you today?
        </div>
        <div class="cwo-message-time">${this.formatTime(new Date())}</div>
      </div>
    `;
    this.saveChatHistory();
  }

  private loadChatHistory() {
    try {
      const raw = localStorage.getItem('cwo-chat-history');
      if (!raw) return;
      this.messages = JSON.parse(raw);
      this.messages.forEach((m: any) => {
        m.timestamp = new Date(m.timestamp);
        this.renderMessage(m);
      });
      // After rendering prior messages, make sure the view is at the latest
      this.scrollToBottom();
    } catch (e) {
      console.error('Error loading chat history:', e);
    }
  }

  private saveChatHistory() {
    try { localStorage.setItem('cwo-chat-history', JSON.stringify(this.messages)); } catch (e) { console.error(e); }
  }

  private setWelcomeTime() {
    const el = document.getElementById('cwo-welcome-time');
    if (el) el.textContent = this.formatTime(new Date());
  }

  private scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  // ---------- Debug Tools (same as existing) ----------
  private async executeSelectedTool() {
    const t = this.getSelectedTool();
    if (!t) return;
    const values = this.collectToolParamValues(t);
    this.debugSearchBtn.disabled = true;
    this.debugSearchBtn.textContent = 'Running...';
    this.debugOutput.textContent = 'Running tool...';
    try {
      const res = await t.run(values);
      this.debugOutput.textContent = JSON.stringify(res, null, 2);
    } catch (e: any) {
      console.error('Tool run error:', e);
      this.debugOutput.textContent = `Error: ${e?.message || e}`;
    } finally {
      this.debugSearchBtn.disabled = false;
      this.debugSearchBtn.textContent = 'Run';
    }
  }

  private initToolsUI() {
    this.tools = [
      { id: 'getStoreData', name: 'Get Store Data', description: 'Extract filters, products, and pagination from the current wheels store page.', params: [], run: async () => this.runGetStoreData() },
      { id: 'getCurrentFilters', name: 'Get Current Filters', description: 'Return the currently set query-string filters for the active store page.', params: [], run: async () => this.runGetCurrentFilters() },
      { id: 'applyStoreFilters', name: 'Apply Store Filters', description: 'Navigate to /store/wheels with selected filters, then extract results.', params: [
        { key: 'year', label: 'Year', type: 'string', optional: true },
        { key: 'make', label: 'Make', type: 'string', optional: true },
        { key: 'model', label: 'Model', type: 'string', optional: true },
        { key: 'trim', label: 'Trim', type: 'string', optional: true },
        { key: 'drive', label: 'Drive', type: 'string', optional: true },
        { key: 'brand', label: 'Brand', type: 'string', optional: true },
        { key: 'dia', label: 'Diameter', type: 'string', optional: true },
        { key: 'width', label: 'Width', type: 'string', optional: true },
        { key: 'offset', label: 'Offset', type: 'string', optional: true },
        { key: 'bolt', label: 'Bolt', type: 'string', optional: true },
        { key: 'mat', label: 'Material', type: 'string', optional: true },
        { key: 'color', label: 'Finish', type: 'string', optional: true },
        { key: 'price', label: 'Price Range (e.g. 100 to 250)', type: 'string', optional: true },
        { key: 'min', label: 'Price Min', type: 'number', optional: true },
        { key: 'max', label: 'Price Max', type: 'number', optional: true },
        { key: 'weight', label: 'Weight Range (e.g. 20 to 35)', type: 'string', optional: true },
        { key: 'minWeight', label: 'Weight Min', type: 'number', optional: true },
        { key: 'maxWeight', label: 'Weight Max', type: 'number', optional: true },
        // Legacy/alternate keys kept for compatibility with older flows
        { key: 'price_min', label: 'Price Min (legacy)', type: 'number', optional: true },
        { key: 'price_max', label: 'Price Max (legacy)', type: 'number', optional: true },
        { key: 'weight_min', label: 'Weight Min (legacy)', type: 'number', optional: true },
        { key: 'weight_max', label: 'Weight Max (legacy)', type: 'number', optional: true },
        { key: 'reviews', label: 'Min Reviews', type: 'number', optional: true },
        { key: 'page', label: 'Page', type: 'number', optional: true }
      ], run: async (v: any) => this.runApplyStoreFilters(v) }
    ];

    this.toolSelect.innerHTML = '';
    this.tools.forEach((t, i) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      if (i === 0) opt.selected = true;
      this.toolSelect.appendChild(opt);
    });
    this.toolSelect.addEventListener('change', () => this.renderToolParams(this.getSelectedTool()));
    this.renderToolParams(this.getSelectedTool());
    this.debugSearchBtn.textContent = 'Run';
  }

  private getSelectedTool() {
    const id = this.toolSelect.value;
    return this.tools.find((t) => t.id === id);
  }

  private renderToolParams(tool: any) {
    this.toolParams.innerHTML = '';
    tool.params.forEach((p: any) => {
      const label = document.createElement('label');
      label.className = 'cwo-debug-label';
      label.htmlFor = `tool-param-${p.key}`;
      label.textContent = p.label;
      const input = document.createElement('input');
      input.className = 'cwo-debug-input';
      input.id = `tool-param-${p.key}`;
      input.setAttribute('data-key', p.key);
      input.setAttribute('data-type', p.type);
      input.type = p.type === 'number' ? 'number' : 'text';
      this.toolParams.appendChild(label);
      this.toolParams.appendChild(input);
    });
  }

  private collectToolParamValues(tool: any) {
    const values: Record<string, any> = {};
    tool.params.forEach((p: any) => {
      const el = document.getElementById(`tool-param-${p.key}`) as HTMLInputElement | null;
      if (!el) return;
      const v = el.value;
      if (v === '' && p.optional) return;
      values[p.key] = p.type === 'number' ? (v ? Number(v) : undefined) : v;
    });
    return values;
  }

  private getActiveTab(): Promise<chrome.tabs.Tab> {
    return new Promise((resolve) => chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs[0])));
  }

  private async runGetStoreData(): Promise<any> {
    const tab = await this.getActiveTab();
    if (!tab || tab.id == null) throw new Error('No active tab');
    return await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id!, { type: 'CWO_GET_STORE_DATA' }, (res) => {
        if ((chrome.runtime as any).lastError) return reject(new Error((chrome.runtime as any).lastError.message));
        if (!res) return reject(new Error('No response from content script'));
        res.success ? resolve(res.data) : reject(new Error(res.error || 'Unknown error'));
      });
    });
  }

  private async runGetCurrentFilters(): Promise<any> {
    const tab = await this.getActiveTab();
    if (!tab) throw new Error('No active tab');
    const urlStr = tab.url || '';
    let u: URL | null = null;
    try { u = new URL(urlStr); } catch { return { url: urlStr, filters: {} }; }

    const pick = (key: string) => {
      const v = u!.searchParams.get(key);
      return v != null && String(v).trim() !== '' ? v : undefined;
    };

    const filters: Record<string, any> = {};
    const keys = ['year','make','model','trim','drive','brand','dia','width','offset','bolt','mat','color','reviews','page','min','max','minWeight','maxWeight'];
    for (const k of keys) {
      const v = pick(k);
      if (v !== undefined) filters[k] = v;
    }

    return { url: u.toString(), filters };
  }

  private async runApplyStoreFilters(values: Record<string, any>): Promise<any> {
    const tab = await this.getActiveTab();
    if (!tab || tab.id == null) throw new Error('No active tab');
    const baseUrl = new URL(tab.url || 'https://www.customwheeloffset.com/store/wheels');
    baseUrl.pathname = '/store/wheels';
    const keys = ['year', 'make', 'model', 'trim', 'drive', 'dia', 'width', 'offset', 'brand', 'color', 'mat', 'reviews', 'bolt', 'page', 'price', 'weight', 'min', 'max', 'minWeight', 'maxWeight', 'price_min', 'price_max', 'weight_min', 'weight_max', 'wmin', 'wmax'];
    keys.forEach((k) => baseUrl.searchParams.delete(k));
    for (const k of ['year', 'make', 'model', 'trim', 'drive', 'dia', 'width', 'offset', 'brand', 'color', 'mat', 'reviews', 'bolt', 'page']) {
      const v = values[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') baseUrl.searchParams.set(k, String(v).trim());
    }

    // Price: site uses min/max for price
    const priceStr = values['price'];
    let minVal = values['min'];
    let maxVal = values['max'];
    const legacyMin = values['price_min'];
    const legacyMax = values['price_max'];
    // Parse "100 to 250" or "100-250" if provided
    if ((!minVal || !maxVal) && priceStr && String(priceStr).trim()) {
      const m = String(priceStr).match(/(-?\d+(?:\.\d+)?)\s*(?:to|-)\s*(-?\d+(?:\.\d+)?)/i);
      if (m) { minVal = m[1]; maxVal = m[2]; }
    }
    if (!minVal && legacyMin != null) minVal = legacyMin;
    if (!maxVal && legacyMax != null) maxVal = legacyMax;
    if (minVal != null && String(minVal).trim() !== '') baseUrl.searchParams.set('min', String(minVal).trim());
    if (maxVal != null && String(maxVal).trim() !== '') baseUrl.searchParams.set('max', String(maxVal).trim());

    // Weight: site uses minWeight/maxWeight
    const weightStr = values['weight'];
    let wminVal = values['minWeight'];
    let wmaxVal = values['maxWeight'];
    const legacyWMin = values['weight_min'];
    const legacyWMax = values['weight_max'];
    if ((!wminVal || !wmaxVal) && weightStr && String(weightStr).trim()) {
      const m = String(weightStr).match(/(-?\d+(?:\.\d+)?)\s*(?:to|-)\s*(-?\d+(?:\.\d+)?)/i);
      if (m) { wminVal = m[1]; wmaxVal = m[2]; }
    }
    if (!wminVal && legacyWMin != null) wminVal = legacyWMin;
    if (!wmaxVal && legacyWMax != null) wmaxVal = legacyWMax;
    if (wminVal != null && String(wminVal).trim() !== '') baseUrl.searchParams.set('minWeight', String(wminVal).trim());
    if (wmaxVal != null && String(wmaxVal).trim() !== '') baseUrl.searchParams.set('maxWeight', String(wmaxVal).trim());

    const targetUrl = baseUrl.toString();
    console.log('Applying filters:', targetUrl);

    // If URL already matches, skip navigation and extract immediately
    if ((tab.url || '') === targetUrl) {
      return this.runGetStoreData();
    }

    // Navigate and wait for completion (with timeout)
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const listener = (updatedTabId: number, info: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tab.id && info.status === 'complete') {
          if (settled) return;
          settled = true;
          try { chrome.tabs.onUpdated.removeListener(listener); } catch {}
          resolve();
        }
      };

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { chrome.tabs.onUpdated.removeListener(listener); } catch {}
        reject(new Error('Navigation timeout'));
      }, 20000);

      chrome.tabs.onUpdated.addListener(listener);
      chrome.tabs.update(tab.id!, { url: targetUrl }, () => {
        const err = (chrome.runtime as any).lastError;
        if (err && !settled) {
          settled = true;
          clearTimeout(timeout);
          try { chrome.tabs.onUpdated.removeListener(listener); } catch {}
          reject(new Error(err.message));
        }
      });
    });

    return this.runGetStoreData();
  }

  // ---------- OpenAI function-calling chat ----------
  private async sendToChatGPT(userText: string): Promise<string> {
    // Pull from settings first
    const cfg: any = await new Promise((resolve) => chrome.storage.local.get('extensionConfig', (res) => resolve(res['extensionConfig'] || {})));
    let apiKey = (cfg.openaiApiKey || '').trim();
    let model = (cfg.openaiModel || '').trim();
    // Fallback to dotenv-injected values at build time
    if (!apiKey && (process as any).env && (process as any).env.OPENAI_API_KEY) apiKey = (process as any).env.OPENAI_API_KEY;
    if (!model && (process as any).env && (process as any).env.OPENAI_MODEL) model = (process as any).env.OPENAI_MODEL;
    if (!model) model = 'gpt-4o-mini';
    if (!apiKey) return 'OpenAI API key is not set. Add it in Settings, or provide OPENAI_API_KEY via .env at build time.';

    const toOpenAIMsgs = () => {
      const msgs: any[] = [];
      for (const m of this.messages) msgs.push({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.content });
      msgs.push({ role: 'user', content: userText });
      return msgs;
    };

    const tools = [
      { type: 'function', function: { name: 'get_store_data', description: 'Extract filters, products, and pagination from the current wheels store page.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
      { type: 'function', function: { name: 'get_current_filters', description: 'Return the currently set query-string filters from the active store page.', parameters: { type: 'object', properties: {}, additionalProperties: false } } },
      { type: 'function', function: { name: 'apply_store_filters', description: 'Navigate the active tab to /store/wheels with selected filters, then return store data.', parameters: { type: 'object', properties: { year: { type: 'string' }, make: { type: 'string' }, model: { type: 'string' }, trim: { type: 'string' }, drive: { type: 'string' }, brand: { type: 'string' }, dia: { type: 'string' }, width: { type: 'string' }, offset: { type: 'string' }, bolt: { type: 'string' }, mat: { type: 'string' }, color: { type: 'string' }, reviews: { type: 'number' }, page: { type: 'number' }, price: { type: 'string' }, min: { type: 'number' }, max: { type: 'number' }, weight: { type: 'string' }, minWeight: { type: 'number' }, maxWeight: { type: 'number' }, price_min: { type: 'number' }, price_max: { type: 'number' }, weight_min: { type: 'number' }, weight_max: { type: 'number' } }, additionalProperties: false } } }
    ];

    const callOpenAI = async (messages: any[]) => {
      const body = { model, messages, tools, tool_choice: 'auto' } as any;
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error(`OpenAI error ${resp.status}: ${await resp.text()}`);
      return await resp.json();
    };

    const runTool = async (name: string, args: any) => {
      if (name === 'get_store_data') return await this.runGetStoreData();
      if (name === 'get_current_filters') return await this.runGetCurrentFilters();
      if (name === 'apply_store_filters') return await this.runApplyStoreFilters(args || {});
      throw new Error(`Unknown tool: ${name}`);
    };

    let messages = toOpenAIMsgs();
    let data = await callOpenAI(messages);
    let msg = data.choices?.[0]?.message;
    if (!msg) return 'No response from model';

    for (let i = 0; i < 3; i++) {
      const toolCalls = msg.tool_calls || [];
      if (!toolCalls.length) break;
      const toolMsgs: any[] = [];
      for (const tc of toolCalls) {
        const fnName = tc.function?.name;
        const argsStr = tc.function?.arguments || '{}';
        let args: any = {};
        try { args = JSON.parse(argsStr || '{}'); } catch {}
        // Log tool call and parameters
        try {
          console.groupCollapsed(`[CWO Chat] Tool call requested: ${fnName}`);
          console.log('Arguments:', args);
          console.groupEnd();
        } catch {}
        const result = await runTool(fnName, args);
        try {
          console.groupCollapsed(`[CWO Chat] Tool result: ${fnName}`);
          console.log('Result:', result);
          console.groupEnd();
        } catch {}
        // The Chat Completions API requires tool message `content` to be a string.
        // Ensure we never pass `undefined` (which would drop the field and 400).
        let contentStr: string;
        if (typeof result === 'string') {
          contentStr = result;
        } else {
          try {
            contentStr = JSON.stringify(result ?? null);
          } catch {
            contentStr = String(result);
          }
        }
        toolMsgs.push({ role: 'tool', tool_call_id: tc.id, content: contentStr });
      }
      messages.push({ role: 'assistant', content: msg.content || '', tool_calls: msg.tool_calls });
      messages.push(...toolMsgs);
      data = await callOpenAI(messages);
      msg = data.choices?.[0]?.message;
      if (!msg) break;
    }
    return msg?.content || 'Done.';
  }

  // ---------- Minimal Markdown renderer (safe) ----------
  private renderMarkdown(md: string): string {
    if (!md) return '';

    // Extract fenced code blocks first and replace with placeholders
    const codeBlocks: string[] = [];
    let idx = 0;
    md = md.replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, _lang, body) => {
      const html = `<pre><code>${escapeHtml(String(body))}</code></pre>`;
      const token = `@@CODE_BLOCK_${idx++}@@`;
      codeBlocks.push(html);
      return token;
    });

    // Escape the rest
    let out = escapeHtml(md);

    // Inline code
    out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${escapeHtml(String(code))}</code>`);

    // Images ![alt](http...)
    out = out.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_m, alt, url) => {
      const safeAlt = escapeHtml(String(alt || ''));
      const safeUrl = String(url).replace(/"/g, '%22');
      return `<img src="${safeUrl}" alt="${safeAlt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" style="max-width:100%;height:auto;" />`;
    });

    // Links [text](http...)
    out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, text, url) => {
      const safeText = escapeHtml(String(text));
      const safeUrl = String(url).replace(/"/g, '%22');
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeText}</a>`;
    });

    // Bold then italics
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(^|[^*])\*(.+?)\*(?!\*)/g, '$1<em>$2</em>');

    // Headings (start of line)
    out = out.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>')
             .replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>')
             .replace(/^####\s+(.*)$/gm, '<h4>$1</h4>')
             .replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
             .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
             .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');

    // Lists (very simple): group consecutive - or * lines into <ul>
    out = out.replace(/(?:^(?:- |\* ).*(?:\n|$))+?/gm, (block) => {
      const items = block.trim().split(/\n/).map(l => l.replace(/^(?:- |\* )/, '').trim()).filter(Boolean);
      if (!items.length) return block;
      return `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;
    });

    // Paragraphs: wrap isolated lines not already within tags
    out = out.split(/\n{2,}/).map(chunk => {
      if (/^\s*</.test(chunk)) return chunk; // starts with a tag
      return `<p>${chunk.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    // Restore fenced code blocks
    out = out.replace(/@@CODE_BLOCK_(\d+)@@/g, (_m, n) => codeBlocks[Number(n)] || '');

    return out;
  }
}

document.addEventListener('DOMContentLoaded', () => { new CustomWheelOffsetChatWidget(); });

export {};
