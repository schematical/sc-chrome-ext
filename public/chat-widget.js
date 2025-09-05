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
        this.modeToggleBtn = document.getElementById("cwo-mode-toggle"), this.chatMode = document.getElementById("cwo-chat-mode"), this.debugMode = document.getElementById("cwo-debug-mode"), this.chatMessages = document.getElementById("cwo-chat-messages"), this.chatInput = document.getElementById("cwo-chat-input"), this.sendBtn = document.getElementById("cwo-send-btn"), this.clearBtn = document.getElementById("cwo-clear-btn"), this.debugBrand = document.getElementById("cwo-debug-brand"), this.debugSize = document.getElementById("cwo-debug-size"), this.debugFinish = document.getElementById("cwo-debug-finish"), this.debugMinPrice = document.getElementById("cwo-debug-min-price"), this.debugMaxPrice = document.getElementById("cwo-debug-max-price"), this.debugInStock = document.getElementById("cwo-debug-in-stock"), this.debugSearchBtn = document.getElementById("cwo-debug-search-btn"), this.debugOutput = document.getElementById("cwo-debug-output")
    }

    bindEvents() {
        this.modeToggleBtn && (this.modeToggleBtn.addEventListener("click", (() => {
            const e = "chat" === this.currentMode ? "debug" : "chat";
            this.switchMode(e), this.updateModeToggleLabel()
        })), this.updateModeToggleLabel()), this.sendBtn.addEventListener("click", (() => this.sendMessage())), this.chatInput.addEventListener("keypress", (e => {
            "Enter" !== e.key || e.shiftKey || (e.preventDefault(), this.sendMessage())
        })), this.clearBtn.addEventListener("click", (() => this.clearChatHistory())), this.debugSearchBtn.addEventListener("click", (() => this.executeDebugSearch()))
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

    async executeDebugSearch() {
        this.debugSearchBtn.disabled = !0, this.debugSearchBtn.textContent = "Searching...", this.debugOutput.textContent = "Searching for wheels...";
        try {
            const e = {
                brand: this.debugBrand.value || void 0,
                size: this.debugSize.value || void 0,
                finish: this.debugFinish.value || void 0,
                minPrice: this.debugMinPrice.value ? parseInt(this.debugMinPrice.value) : void 0,
                maxPrice: this.debugMaxPrice.value ? parseInt(this.debugMaxPrice.value) : void 0,
                inStockOnly: this.debugInStock.checked
            };
            Object.keys(e).forEach((t => {
                void 0 === e[t] && delete e[t]
            }));
            const t = await this.searchWheels(e);
            this.debugOutput.textContent = JSON.stringify(t, null, 2)
        } catch (e) {
            console.error("Debug search error:", e), this.debugOutput.textContent = `Error: ${e.message}`
        } finally {
            this.debugSearchBtn.disabled = !1, this.debugSearchBtn.textContent = "Search Wheels"
        }
    }

    async searchWheels(e = {}) {
        return await new Promise((e => setTimeout(e, 2e3))), {
            success: !0,
            totalProducts: 15,
            products: [{
                id: "1",
                brand: "ARKON OFF-ROAD",
                model: "Kennedy Black Milled",
                specifications: "22x12 -51",
                price: "$441.75 /ea",
                stockStatus: "In Stock",
                imageUrl: "https://example.com/image1.jpg",
                productUrl: "https://www.customwheeloffset.com/product/1",
                finish: "Black",
                boltPattern: "8x170",
                centerBore: "125.1mm"
            }, {
                id: "2",
                brand: "Anthem Off-Road",
                model: "Raider Gunmetal Machined",
                specifications: "17x8.5 0",
                price: "$289.99 /ea",
                stockStatus: "In Stock",
                imageUrl: "https://example.com/image2.jpg",
                productUrl: "https://www.customwheeloffset.com/product/2",
                finish: "Gunmetal",
                boltPattern: "6x135",
                centerBore: "87.1mm"
            }],
            appliedFilters: e,
            extractionTime: 1850,
            errors: []
        }
    }
}

document.addEventListener("DOMContentLoaded", (() => {
    new CustomWheelOffsetChatWidget
}));

