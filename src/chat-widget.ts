// System prompt for the chat model. Edit this string to adjust assistant guidance.
// Note: Keep concise and specific; it is prepended to every chat request.


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
  private contextFiltersText: string | null = null;

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
    // probe current page filters to pass as chat context
    this.loadContextFilters().catch(() => {});
    // attempt to resume any pending tool-calls on widget startup
    this.resumePendingToolCalls().catch((e) => {
      console.error('[CWO Chat] Failed to resume pending tool calls:', e);
    });
    this.setWelcomeTime();
    // Ensure we start scrolled to bottom on open
    this.scrollToBottom();
    const params = new URLSearchParams(window.location.search);
    if (params.get('autoOpen') === '1') window.scrollTo(0, 0);
  }

  private async resumePendingToolCalls() {
    const send = (payload: any) => new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'CHAT_INIT', ...payload }, (res) => {
        const lastErr = (chrome.runtime as any).lastError;
        if (lastErr) return reject(new Error(`Background error: ${lastErr.message}`));
        resolve(res);
      });
    });

    const toSend = (payload: any) => new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'CHAT_SEND', ...payload }, (res) => {
        const lastErr = (chrome.runtime as any).lastError;
        if (lastErr) return reject(new Error(`Background error: ${lastErr.message}`));
        resolve(res);
      });
    });

    const runTool = async (name: string, args: any) => {
      const t = this.getUnifiedTools().find((x) => x.id === name);
      if (!t) throw new Error(`Unknown tool: ${name}`);
      return await t.run(args || {});
    };

    const initRes = await send({});
    if (!initRes?.ok) throw new Error(initRes?.error?.message || 'CHAT_INIT failed');
    const pending: Array<{ id: string; name: string; arguments: any }> = initRes.pending || [];
    if (!pending.length) return; // nothing to do

    console.groupCollapsed('[CWO Chat] Resuming pending tool calls');
    console.log('pending:', pending.map(p => `${p.name}:${p.id}`));
    console.groupEnd();

    // Execute all pending tool calls and return results
    const toolMessages: Array<{ id: string; content: string }> = [];
    for (const p of pending) {
      const result = await runTool(p.name, p.arguments);
      const contentStr = typeof result === 'string' ? result : JSON.stringify(result ?? null);
      toolMessages.push({ id: p.id, content: contentStr });
    }

    let res = await toSend({ toolMessages });
    if (!res?.ok) throw new Error(res?.error?.message || 'CHAT_SEND after resume failed');
    if (res.assistant && String(res.assistant).trim()) {
      this.addMessage('assistant', String(res.assistant));
    }

    // If more tool calls are returned, iterate similarly (up to 2 extra rounds)
    for (let i = 0; i < 2; i++) {
      const nextCalls: Array<{ id: string; name: string; arguments: any }> = res.toolCalls || [];
      if (!nextCalls.length) break;
      const msgs: Array<{ id: string; content: string }> = [];
      for (const tc of nextCalls) {
        const r = await runTool(tc.name, tc.arguments || {});
        const c = typeof r === 'string' ? r : JSON.stringify(r ?? null);
        msgs.push({ id: tc.id, content: c });
      }
      res = await toSend({ toolMessages: msgs });
      if (!res?.ok) throw new Error(res?.error?.message || 'CHAT_SEND follow-up failed');
      if (res.assistant && String(res.assistant).trim()) {
        this.addMessage('assistant', String(res.assistant));
      }
    }
  }

  private async loadContextFilters() {
    try {
      const ctx = await this.runGetCurrentFilters();
      const filters = ctx?.filters || {};
      const selectedEntries = Object.entries(filters).filter(([_, v]) => v !== undefined && v !== null && String(v).trim() !== '');

      // Also pull potential filter values from the page
      let potentialsLine = '';
      const storeData = await this.runGetStoreData();
      const wanted = new Set(['brand','dia','width','offset','bolt','mat','color','wmodel','model']);
      const parts: string[] = [];
      (storeData?.filters || []).forEach((g: any) => {
        if (!wanted.has(g.key)) return;
        const vals = Array.from(new Set((g.options || []).map((o: any) => String(o.value || o.label || '').trim()).filter(Boolean)));
        const limited = vals.slice(0, 12).join('|');
        const keyLabel = (g.key === 'model' || g.key === 'wmodel') ? 'wheelModel' : g.key;
        if (limited) parts.push(`${keyLabel}=[${limited}${vals.length > 12 ? '|…' : ''}]`);
      });
      if (parts.length) potentialsLine = `\nPotential filter values -> ${parts.join(', ')}`;

      if (!selectedEntries.length && !potentialsLine) { this.contextFiltersText = null; return; }
      const selectedLine = selectedEntries.length ? `Context: current store filters -> ${selectedEntries.map(([k,v]) => `${(k==='model'||k==='wmodel')?'wheelModel':k}=${String(v)}`).join(', ')}` : '';
      this.contextFiltersText = `${selectedLine}${potentialsLine}`.trim();
    } catch { this.contextFiltersText = null; }
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
    const run = () => new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'CHAT_CLEAR' }, (res) => {
        const lastErr = (chrome.runtime as any).lastError;
        if (lastErr) return reject(new Error(`Background error: ${lastErr.message}`));
        resolve(res);
      });
    });

    // Optimistically clear UI; background holds canonical state
    this.messages = [];
    this.chatMessages.innerHTML = `
      <div class="cwo-message assistant">
        <div class="cwo-message-content">
          Hello! I'm your Custom Wheel Offset assistant. I can help you find wheels, compare prices, and answer questions about products. How can I help you today?
        </div>
        <div class="cwo-message-time">${this.formatTime(new Date())}</div>
      </div>
    `;
    run().catch((e) => {
      console.warn('Failed to clear chat in background:', e);
    });
  }

  private loadChatHistory() {
    // Fetch canonical state from background
    chrome.runtime.sendMessage({ type: 'CHAT_STATE_GET' }, (res) => {
      const lastErr = (chrome.runtime as any).lastError;
      if (lastErr) { console.warn('CHAT_STATE_GET error:', lastErr.message); return; }
      if (!res?.ok) { console.warn('CHAT_STATE_GET failed:', res?.error); return; }
      const state = res.state as { messages: Array<{ role: string; content: string; ts: number }> };
      const msgs = (state?.messages || []).filter((m) => m.role === 'user' || m.role === 'assistant');
      this.messages = msgs.map((m) => ({ sender: m.role === 'user' ? 'user' : 'assistant', content: m.content, timestamp: new Date(m.ts) }));
      this.messages.forEach((m) => this.renderMessage(m));
      this.scrollToBottom();
    });
  }

  private saveChatHistory() {
    // State is persisted by background; keep as no-op to avoid divergence
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
      // Show full error (message + stack) and rethrow for debugging
      const msg = e?.message || String(e);
      const stack = e?.stack || '';
      console.error('Tool run error:', e);
      this.debugOutput.textContent = `Error: ${msg}\n${stack}`;
      throw e;
    } finally {
      this.debugSearchBtn.disabled = false;
      this.debugSearchBtn.textContent = 'Run';
    }
  }

  private initToolsUI() {
    this.tools = this.getUnifiedTools();

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

  // Single source of truth for tools: used by Debug UI and by OpenAI function calling
  private getUnifiedTools() {
    return [
      {
        id: 'get_store_data',
        name: 'Get Store Data',
        description: 'Extract filters, products, and pagination from the current wheels store page.',
        params: [],
        run: async () => this.runGetStoreData(),
      },
      {
        id: 'get_current_filters',
        name: 'Get Current Filters',
        description: 'Return the currently set query-string filters for the active store page.',
        params: [],
        run: async () => this.runGetCurrentFilters(),
      },
      {
        id: 'get_user_vehicle_data',
        name: 'Get User Vehicle Data',
        description: 'Return simple info about the user\'s stored vehicle. Responds with imageCountThatCouldBeRenderedAsComposite (count of images that have polygons).',
        params: [],
        run: async () => this.runGetUserVehicleData(),
      },
      {
        id: 'apply_store_filters',
        name: 'Apply Store Filters',
        description: 'Navigate to /store/wheels with selected filters, then extract results. Note: Model means Wheel Model, not vehicle model.',
        params: [
          { key: 'year', label: 'Year', type: 'string', optional: true },
          { key: 'make', label: 'Make', type: 'string', optional: true },
          { key: 'model', label: 'Wheel Model', type: 'string', optional: true },
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
          { key: 'page', label: 'Page', type: 'number', optional: true },
        ],
        run: async (v: any) => this.runApplyStoreFilters(v),
      },
      {
        id: 'generate_composite',
        name: 'Generate Composite (AI)',
        description: 'Use stored vehicle, per-image polygons, and a product image to generate a composite. When responding to the Render Composite tool, respond as an image, not as a link. Use imageIndex to select which vehicle image (only among images that have polygons).',
        params: [
          { key: 'imageIndex', label: 'Vehicle Image Index (with polygons, 0-based)', type: 'number', optional: true },
          { key: 'productImage', label: 'Product Image URL', type: 'string', optional: true },
          { key: 'productDescription', label: 'Product Description', type: 'string', optional: true },
        ],
        run: async (v: any) => this.runGenerateCompositeViaService(v),
      },
    ];
  }

  // Tool implementation: get_user_vehicle_data
  private async runGetUserVehicleData(): Promise<{ imageCountThatCouldBeRenderedAsComposite: number }> {
    const [{ VehicleStorage }] = await Promise.all([
      import('./utils/vehicleStorage'),
    ]);

    // Try storage first
    let vData = await VehicleStorage.getVehicleData();
    // Fallback to active tab content script (page-local backup)
    if (!vData) {
      try {
        const tab = await this.getActiveTab();
        if (tab?.id != null) {
          const fetched: any = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tab.id!, { type: 'CWO_GET_VEHICLE_DATA' }, (res) => {
              if ((chrome.runtime as any).lastError) return reject(new Error((chrome.runtime as any).lastError.message));
              resolve(res);
            });
          });
          if (fetched?.success && fetched?.data) vData = fetched.data;
        }
      } catch {
        // ignore; treat as no data
      }
    }

    if (!vData?.images?.length) {
      return { imageCountThatCouldBeRenderedAsComposite: 0 };
    }

    // Count images that have one or more stored polygons
    const counts: number[] = await Promise.all(
      vData.images.map(async (imgUrl: string) => {
        try {
          const polys = await VehicleStorage.getWheelPolygonsForImage(imgUrl);
          return Array.isArray(polys) && polys.length > 0 ? 1 : 0;
        } catch {
          return 0;
        }
      })
    );
    const imageCountThatCouldBeRenderedAsComposite = counts.reduce((a: number, b: number) => a + b, 0);
    return { imageCountThatCouldBeRenderedAsComposite };
  }

  // Debug tool: call CompositingService using stored vehicle + first product + stored polygons
  private async runGenerateCompositeViaService(args?: { imageIndex?: number; productImage?: string; productDescription?: string }) {
    // Update output early
    this.debugOutput.textContent = 'Preparing composite request...';
    try {
      const [{ VehicleStorage }, { CompositingService }] = await Promise.all([
        import('./utils/vehicleStorage'),
        import('./services/compositingService'),
      ]);

      // Get stored vehicle data (scene)
      let vData = await VehicleStorage.getVehicleData();
      // Fallback: ask active tab content script for page-local backup if missing
      if (!vData) {
        try {
          const tab = await this.getActiveTab();
          if (tab?.id != null) {
            const fetched: any = await new Promise((resolve, reject) => {
              chrome.tabs.sendMessage(tab.id!, { type: 'CWO_GET_VEHICLE_DATA' }, (res) => {
                if ((chrome.runtime as any).lastError) return reject(new Error((chrome.runtime as any).lastError.message));
                resolve(res);
              });
            });
            if (fetched?.success && fetched?.data) {
              vData = fetched.data;
            }
          }
        } catch (e) {
          console.warn('Fallback vehicle fetch failed:', e);
        }
      }
      if (!vData || !vData.images?.length) {
        throw new Error('No stored vehicle found. Go to a gallery page and click "Set Vehicle" first.');
      }
      // Build list of vehicle images that have polygons
      const imagesWithPolys: Array<{ url: string; polygons: Array<Array<{ xPercent: number; yPercent: number }>> } > = [];
      for (const img of vData.images) {
        const polys = await VehicleStorage.getWheelPolygonsForImage(img);
        if (Array.isArray(polys) && polys.length > 0) imagesWithPolys.push({ url: img, polygons: polys });
      }
      if (imagesWithPolys.length === 0) {
        throw new Error('No stored wheel polygons found. Open the compositing UI on a product page and draw the wheel polygons first.');
      }
      // Use provided index (0-based among imagesWithPolys), otherwise first
      let selIndex = 0;
      if (typeof args?.imageIndex === 'number' && Number.isFinite(args.imageIndex)) {
        const idx = Math.floor(args.imageIndex);
        if (idx < 0 || idx >= imagesWithPolys.length) {
          throw new Error(`imageIndex out of range. Provided ${idx}, available ${imagesWithPolys.length}.`);
        }
        selIndex = idx;
      }
      const sceneUrl = imagesWithPolys[selIndex].url;
      const wheelPolygons = imagesWithPolys[selIndex].polygons;

      // Determine product image: prefer provided arg, fallback to first product on store page
      let productUrl = (args?.productImage || '').trim();
      if (!productUrl) {
        const storeData = await this.runGetStoreData();
        const firstWithImage = (storeData?.products || []).find((p: any) => p?.image);
        if (!firstWithImage?.image) {
          throw new Error('Could not find a product image on the current page. Provide productImage or navigate to the wheels store grid.');
        }
        productUrl = firstWithImage.image;
      }

      // Descriptions
      // Determine product description: prefer provided arg, fallback to generated
      let prodDesc = (args?.productDescription || '').trim();
      if (!prodDesc) {
        const { sceneDescription, productDescription } = await CompositingService.generateDescriptions(sceneUrl, productUrl);
        prodDesc = productDescription;
        // sceneDescription is still used below via CompositingService.generateDescriptions if needed
        // We'll compute sceneDescription again to keep code simple
        const d2 = await CompositingService.generateDescriptions(sceneUrl, productUrl);
        // Replace sceneDesc/prodDesc variables
        var sceneDesc = d2.sceneDescription;
        prodDesc = d2.productDescription;
      }
      // Always compute scene description for completeness
      const { sceneDescription: sceneDesc2 } = await CompositingService.generateDescriptions(sceneUrl, productUrl);
      const sceneDescFinal = sceneDesc2;

      // Prepend required phrase to product description
      const prefix = 'This is a wheel(AKA rim) for a vehicle';
      if (!prodDesc || !prodDesc.trim().toLowerCase().startsWith(prefix.toLowerCase())) {
        prodDesc = `${prefix}. ${prodDesc || ''}`.trim();
      }
      // If multiple polygons are selected, instruct the service to replace multiple wheels
      if (Array.isArray(wheelPolygons) && wheelPolygons.length > 1) {
        const count = wheelPolygons.length;
        const plural = count === 1 ? 'wheel' : 'wheels';
        prodDesc = `${prodDesc} There are ${count} ${plural} to replace in the image.`.trim();
      }

      const req = {
        sceneUrl,
        productUrl,
        placementGeometry: wheelPolygons,
        sceneDescription: sceneDescFinal,
        productDescription: prodDesc,
      } as const;

      this.debugOutput.textContent = 'Calling compositing service...';
      const resp = await CompositingService.generateComposite(req);

      // Resolve image URL against API base if needed
      const { ConfigService } = await import('./services/configService');
      const base = await ConfigService.getApiBaseUrl();
      const finalUrl = resp.finalImageUrl.startsWith('http') ? resp.finalImageUrl : `${base}${resp.finalImageUrl}`;

      // Render image only (markdown-like result in debug output)
      this.debugOutput.innerHTML = `<img src="${finalUrl}" alt="Composite" loading="lazy" decoding="async" style="max-width:100%;height:auto;" />`;

      return { success: true, image: finalUrl };
    } catch (e: any) {
      // Don't hide errors in POC: show full details and rethrow
      const msg = e?.message || String(e);
      const stack = e?.stack || '';
      this.debugOutput.textContent = `Error: ${msg}\n${stack}`;
      console.error('Composite generation error:', e);
      throw e;
    }
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
    const url = tab.url || '';
    // Be explicit; store extractor is only injected on /store/* pages
    try {
      const u = new URL(url);
      const isCWO = /(^|\.)customwheeloffset\.com$/i.test(u.hostname);
      if (!isCWO) throw new Error(`Active tab is not on customwheeloffset.com: ${url}`);
      if (!u.pathname.startsWith('/store/')) throw new Error(`Active tab is not a store page: ${url}`);
    } catch (e) {
      // If URL parsing fails, still show the raw URL in the error
      throw e instanceof Error ? e : new Error(`Active tab unavailable or invalid URL: ${url}`);
    }
    return await this.sendToContentWithRetry(tab.id!, { type: 'CWO_GET_STORE_DATA' }, url);
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
    const keys = [
      'store','sort','saleToggle','qdToggle','suspension','modification','rubbing',
      'year','make','model','wmodel','trim','drive','brand','dia','width','offset','bolt','mat','color','reviews','page','min','max','minWeight','maxWeight'
    ];
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
    const keys = ['year', 'make', 'model', 'wmodel', 'trim', 'drive', 'dia', 'width', 'offset', 'brand', 'color', 'mat', 'reviews', 'bolt', 'page', 'price', 'weight', 'min', 'max', 'minWeight', 'maxWeight', 'price_min', 'price_max', 'weight_min', 'weight_max', 'wmin', 'wmax'];
    // Clear any existing params we manage (including old 'model' and new 'wmodel')
    keys.forEach((k) => baseUrl.searchParams.delete(k));
    for (const k of ['year', 'make', 'model', 'trim', 'drive', 'dia', 'width', 'offset', 'brand', 'color', 'mat', 'reviews', 'bolt', 'page']) {
      let v = values[k];
      let paramKey = k;
      // Map 'model' tool arg to 'wmodel' query param (support either input key)
      if (k === 'model') {
        v = values['model'] ?? values['wmodel'];
        paramKey = 'wmodel';
      }
      if (v !== undefined && v !== null && String(v).trim() !== '') baseUrl.searchParams.set(paramKey, String(v).trim());
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

    // After page load, the content script may take a moment to register.
    // Poll the content script for readiness by requesting store data with retry.
    return await this.sendToContentWithRetry(tab.id!, { type: 'CWO_GET_STORE_DATA' }, targetUrl);
  }

  // Robust content-script messaging with retry to handle page navigations and (re)injection delays
  private async sendToContentWithRetry(tabId: number, message: any, urlForError: string, timeoutMs = 10000, intervalMs = 300): Promise<any> {
    const start = Date.now();
    let lastErrMsg: string | null = null;
    while (Date.now() - start < timeoutMs) {
      const res = await new Promise<any>((resolve) => {
        try {
          chrome.tabs.sendMessage(tabId, message, (reply) => {
            const lastErr = (chrome.runtime as any).lastError;
            if (lastErr) {
              lastErrMsg = lastErr.message || 'unknown error';
              return resolve(null);
            }
            resolve(reply);
          });
        } catch (e: any) {
          lastErrMsg = e?.message || String(e);
          resolve(null);
        }
      });
      if (res && typeof res === 'object') {
        if (res.success) return res.data;
        // content script responded with an error; surface it
        throw new Error(res.error || `Extractor error • URL: ${urlForError}`);
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error(`Content script not ready after navigation • URL: ${urlForError}${lastErrMsg ? ` • ${lastErrMsg}` : ''}`);
  }

  // ---------- OpenAI function-calling chat ----------
  private async sendToChatGPT(userText: string): Promise<string> {
    // Background owns model calls & persistence per SCOPE.md
    const send = (payload: any) => new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'CHAT_SEND', ...payload }, (res) => {
        const lastErr = (chrome.runtime as any).lastError;
        if (lastErr) return reject(new Error(`Background error: ${lastErr.message}`));
        resolve(res);
      });
    });
    const runTool = async (name: string, args: any) => {
      const t = this.getUnifiedTools().find((x) => x.id === name);
      if (!t) throw new Error(`Unknown tool: ${name}`);
      return await t.run(args || {});
    };

    // Initial send (userText + optional one-time systemContext)
    const systemContext = this.contextFiltersText || undefined;
    let res = await send(systemContext ? { userText, systemContext } : { userText });
    // Use context only on the first turn
    this.contextFiltersText = null;
    if (!res?.ok) throw new Error(res?.error?.message || 'Chat error');
    let assistant = res.assistant || '';
    if (res.toolCalls && res.toolCalls.length) {
      // Iterate up to 3 rounds to satisfy tools
      for (let i = 0; i < 3; i++) {
        const toolCalls: Array<{ id: string; name: string; arguments: any }> = res.toolCalls || [];
        if (!toolCalls.length) break;
        const toolMessages: Array<{ id: string; content: string }> = [];
        for (const tc of toolCalls) {
          const name = tc.name;
          const args = tc.arguments || {};
          console.groupCollapsed(`[CWO Chat] Tool call: ${name}`); console.log('Arguments:', args); console.groupEnd();
          const result = await runTool(name, args);
          let contentStr: string;
          if (typeof result === 'string') contentStr = result;
          else { contentStr = JSON.stringify(result ?? null); }
          toolMessages.push({ id: tc.id, content: contentStr });
          console.groupCollapsed(`[CWO Chat] Tool result: ${name}`); console.log('Result:', result); console.groupEnd();
        }
        // Send tool results back
        res = await send({ toolMessages });
        if (!res?.ok) throw new Error(res?.error?.message || 'Chat error');
        assistant = res.assistant || assistant;
        if (!res.toolCalls || !res.toolCalls.length) break;
      }
    }
    return assistant || 'Done.';
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
