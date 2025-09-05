class CustomWheelOffsetChatWidget {
    constructor() {
        this.isOpen = !0, this.currentMode = "chat", this.messages = [], this.isLoading = !1, this.initializeElements(), this.bindEvents(), this.loadChatHistory(), this.setWelcomeTime(), function () {
            try {
                const e = new URLSearchParams(window.location.search);
                "1" === e.get("autoOpen") && window.scrollTo(0, 0)
            } catch (e) {
            }
        }()
    }

    initializeElements() {
        this.modeToggleBtn = document.getElementById("cwo-mode-toggle"), this.chatMode = document.getElementById("cwo-chat-mode"), this.debugMode = document.getElementById("cwo-debug-mode"), this.chatMessages = document.getElementById("cwo-chat-messages"), this.chatInput = document.getElementById("cwo-chat-input"), this.sendBtn = document.getElementById("cwo-send-btn"), this.clearBtn = document.getElementById("cwo-clear-btn"), this.debugSearchBtn = document.getElementById("cwo-debug-search-btn"), this.debugOutput = document.getElementById("cwo-debug-output"), this.toolSelect = document.getElementById("cwo-tool-select"), this.toolParams = document.getElementById("cwo-tool-params")
    }

    bindEvents() {
        this.modeToggleBtn && (this.modeToggleBtn.addEventListener("click", (() => {
            const e = "chat" === this.currentMode ? "debug" : "chat";
            this.switchMode(e), this.updateModeToggleLabel()
        })), this.updateModeToggleLabel()), this.sendBtn.addEventListener("click", (() => this.sendMessage())), this.chatInput.addEventListener("keypress", (e => {
            "Enter" !== e.key || e.shiftKey || (e.preventDefault(), this.sendMessage())
        })), this.clearBtn.addEventListener("click", (() => this.clearChatHistory())), this.initToolsUI(), this.debugSearchBtn.addEventListener("click", (() => this.executeSelectedTool()))
    }

    toggleWidget() {
        this.isOpen ? this.closeWidget() : this.openWidget()
    }

    openWidget() {
        this.isOpen = !0, this.chatInput.focus()
    }

    closeWidget() {
        this.isOpen = !1
    }

    switchMode(e) {
        this.currentMode = e, this.chatMode.style.display = "chat" === e ? "flex" : "none", this.debugMode.classList.toggle("active", "debug" === e), "chat" === e && this.chatInput.focus()
    }

    updateModeToggleLabel() {
        this.modeToggleBtn && (this.modeToggleBtn.textContent = "debug" === this.currentMode ? "Chat" : "Debug")
    }

    async sendMessage() {
        const e = this.chatInput.value.trim();
        if (e && !this.isLoading) {
            this.addMessage("user", e), this.chatInput.value = "", this.setSendButtonLoading(!0);
            try {
                const t = await this.sendToChatGPT(e);
                this.addMessage("assistant", t)
            } catch (e) {
                console.error("ChatGPT API error:", e), this.addMessage("assistant", "Sorry, I encountered an error. Please try again.")
            } finally {
                this.setSendButtonLoading(!1)
            }
        }
    }

    async sendToChatGPT(e) {
        return await new Promise((e => setTimeout(e, 1e3))), e.toLowerCase().includes("wheel") || e.toLowerCase().includes("rim") ? "I can help you find wheels! I have access to the Custom Wheel Offset database. You can ask me about specific brands, sizes, finishes, or price ranges. What are you looking for?" : e.toLowerCase().includes("price") || e.toLowerCase().includes("cost") ? "I can help you find wheels within your budget! What price range are you looking for? I can search for wheels from $100 to $2000+ depending on your needs." : e.toLowerCase().includes("brand") ? "We have many great wheel brands available including ARKON OFF-ROAD, Anthem Off-Road, Fuel, and many more. Which brand interests you most?" : "I'm here to help you find the perfect wheels! I can search our database for specific brands, sizes, finishes, and price ranges. What would you like to know?"
    }

    addMessage(e, t) {
        const s = {sender: e, content: t, timestamp: new Date};
        this.messages.push(s), this.renderMessage(s), this.saveChatHistory(), this.scrollToBottom()
    }

    renderMessage(e) {
        const t = document.createElement("div");
        t.className = `cwo-message ${e.sender}`;
        const s = document.createElement("div");
        s.className = "cwo-message-content", s.textContent = e.content;
        const o = document.createElement("div");
        o.className = "cwo-message-time", o.textContent = this.formatTime(e.timestamp), t.appendChild(s), t.appendChild(o), this.chatMessages.appendChild(t)
    }

    formatTime(e) {
        return e.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})
    }

    setSendButtonLoading(e) {
        this.isLoading = e, this.sendBtn.disabled = e, this.sendBtn.innerHTML = e ? '<div class="cwo-loading"></div>' : "Send"
    }

    clearChatHistory() {
        confirm("Are you sure you want to clear the chat history?") && (this.messages = [], this.chatMessages.innerHTML = `\n                <div class="cwo-message assistant">\n                    <div class="cwo-message-content">\n                        Hello! I'm your Custom Wheel Offset assistant. I can help you find wheels, compare prices, and answer questions about products. How can I help you today?\n                    </div>\n                    <div class="cwo-message-time">${this.formatTime(new Date)}</div>\n                </div>\n            `, this.saveChatHistory())
    }

    loadChatHistory() {
        try {
            const e = localStorage.getItem("cwo-chat-history");
            e && (this.messages = JSON.parse(e), this.messages.forEach((e => {
                e.timestamp = new Date(e.timestamp), this.renderMessage(e)
            })))
        } catch (e) {
            console.error("Error loading chat history:", e)
        }
    }

    saveChatHistory() {
        try {
            localStorage.setItem("cwo-chat-history", JSON.stringify(this.messages))
        } catch (e) {
            console.error("Error saving chat history:", e)
        }
    }

    setWelcomeTime() {
        const e = document.getElementById("cwo-welcome-time");
        e && (e.textContent = this.formatTime(new Date))
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight
    }

    async executeSelectedTool() {
        const t = this.getSelectedTool();
        if (!t) return;
        const values = this.collectToolParamValues(t);
        this.debugSearchBtn.disabled = !0, this.debugSearchBtn.textContent = "Running...", this.debugOutput.textContent = "Running tool...";
        try {
            const res = await t.run(values);
            this.debugOutput.textContent = JSON.stringify(res, null, 2)
        } catch (e) {
            console.error("Tool run error:", e), this.debugOutput.textContent = `Error: ${e.message || e}`
        } finally {
            this.debugSearchBtn.disabled = !1, this.debugSearchBtn.textContent = "Run"
        }
    }

    initToolsUI() {
        this.tools = [
            {
                id: "getStoreData",
                name: "Get Store Data",
                description: "Extract filters, products, and pagination from the current wheels store page.",
                params: [],
                run: async () => await this.runGetStoreData()
            },
            {
                id: "applyStoreFilters",
                name: "Apply Store Filters",
                description: "Navigate to /store/wheels with selected filters, then extract results.",
                params: [
                    { key: 'brand', label: 'Brand', type: 'string', optional: !0 },
                    { key: 'dia', label: 'Diameter', type: 'string', optional: !0 },
                    { key: 'width', label: 'Width', type: 'string', optional: !0 },
                    { key: 'offset', label: 'Offset', type: 'string', optional: !0 },
                    { key: 'bolt', label: 'Bolt', type: 'string', optional: !0 },
                    { key: 'mat', label: 'Material', type: 'string', optional: !0 },
                    { key: 'color', label: 'Finish', type: 'string', optional: !0 },
                    { key: 'reviews', label: 'Min Reviews', type: 'number', optional: !0 },
                    { key: 'page', label: 'Page', type: 'number', optional: !0 }
                ],
                run: async (v) => await this.runApplyStoreFilters(v)
            }
        ];

        // Populate select
        this.toolSelect.innerHTML = "";
        this.tools.forEach(((t, i) => {
            const o = document.createElement("option");
            o.value = t.id, o.textContent = t.name, i || (o.selected = !0), this.toolSelect.appendChild(o)
        }));

        this.toolSelect.addEventListener("change", (() => this.renderToolParams(this.getSelectedTool())));
        this.renderToolParams(this.getSelectedTool());
        this.debugSearchBtn.textContent = "Run";
    }

    getSelectedTool() {
        const id = this.toolSelect.value;
        return this.tools.find((t => t.id === id));
    }

    renderToolParams(tool) {
        this.toolParams.innerHTML = "";
        tool.params.forEach((p => {
            const label = document.createElement("label");
            label.className = "cwo-debug-label";
            label.htmlFor = `tool-param-${p.key}`;
            label.textContent = p.label;
            const input = document.createElement("input");
            input.className = "cwo-debug-input";
            input.id = `tool-param-${p.key}`;
            input.setAttribute("data-key", p.key);
            input.setAttribute("data-type", p.type);
            input.type = p.type === 'number' ? 'number' : 'text';
            this.toolParams.appendChild(label);
            this.toolParams.appendChild(input);
        }))
    }

    collectToolParamValues(tool) {
        const values = {};
        tool.params.forEach((p => {
            const el = document.getElementById(`tool-param-${p.key}`);
            if (!el) return;
            const v = el.value;
            if (v === '' && p.optional) return;
            values[p.key] = p.type === 'number' ? (v ? Number(v) : void 0) : v;
        }));
        return values;
    }

    async runGetStoreData() {
        const tab = await new Promise((resolve => chrome.tabs.query({ active: !0, currentWindow: !0 }, (t => resolve(t && t[0])))));
        if (!tab || null == tab.id) throw new Error("No active tab");
        return await new Promise(((resolve, reject) => {
            chrome.tabs.sendMessage(tab.id, { type: 'CWO_GET_STORE_DATA' }, (res => {
                if (chrome.runtime.lastError) return void reject(new Error(chrome.runtime.lastError.message));
                if (!res) return void reject(new Error('No response from content script'));
                res.success ? resolve(res.data) : reject(new Error(res.error || 'Unknown error'))
            }))
        }))
    }

    async runApplyStoreFilters(values) {
        const tab = await new Promise((resolve => chrome.tabs.query({ active: !0, currentWindow: !0 }, (t => resolve(t && t[0])))));
        if (!tab || null == tab.id) throw new Error("No active tab");
        const baseUrl = new URL(tab.url || 'https://www.customwheeloffset.com/store/wheels');
        baseUrl.pathname = '/store/wheels';
        const keys = ['dia', 'width', 'offset', 'brand', 'color', 'mat', 'reviews', 'bolt', 'page'];
        keys.forEach((k => baseUrl.searchParams.delete(k)));
        for (const k of keys) {
            const v = values[k];
            if (void 0 !== v && null !== v && String(v).trim() !== '') baseUrl.searchParams.set(k, String(v).trim());
        }
        await new Promise(((resolve, reject) => {
            const listener = (updatedTabId, info) => {
                updatedTabId === tab.id && 'complete' === info.status && (chrome.tabs.onUpdated.removeListener(listener), resolve())
            };
            chrome.tabs.onUpdated.addListener(listener);
            chrome.tabs.update(tab.id, { url: baseUrl.toString() }, (() => {
                chrome.runtime.lastError && (chrome.tabs.onUpdated.removeListener(listener), reject(new Error(chrome.runtime.lastError.message)))
            }))
        }));
        return await this.runGetStoreData();
    }
}

document.addEventListener("DOMContentLoaded", (() => {
    new CustomWheelOffsetChatWidget
}));
