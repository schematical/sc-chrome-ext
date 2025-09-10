import { VehicleStorage } from './utils/vehicleStorage';
import { ConfigService } from './services/configService';

// ================= Chat Background (per SCOPE.md) =================
type ChatRole = 'system' | 'user' | 'assistant' | 'tool';
interface ChatMsg { role: ChatRole; content: string; ts: number; tool_call_id?: string; tool_calls?: any[] }
interface SerializedError { message: string; stack?: string; code?: string }
interface ChatState { messages: ChatMsg[]; lastError?: SerializedError; inFlight?: boolean }

const CHAT_STATE_KEY = 'chatSession';
let currentAbort: AbortController | null = null;

// System prompt for the chat model
const CWO_SYSTEM_PROMPT = `You are helpful Assistant too your job is to help people purchase from this website, customrealoffsets.com. 
Once they've begun talking about a product, encourage them to use the generate_composite tool to generate an image of that. 
When responding to the Render Composite tool, respond as an image, not as a link. 
If they just type in a brand name, model name or measurments then chances are they want you to call the 'apply_store_filters' tool to get a list of products. 
`;

async function getChatState(): Promise<ChatState> {
  const res = await chrome.storage.local.get(CHAT_STATE_KEY);
  const state: ChatState | undefined = res[CHAT_STATE_KEY];
  if (!state) return { messages: [] };
  return state;
}

async function setChatState(next: ChatState): Promise<void> {
  await chrome.storage.local.set({ [CHAT_STATE_KEY]: next });
}

function buildToolSchema() {
  // Schema only; widget executes these tools.
  type ParamDef = { type: 'string'|'number'; description?: string } | 'string' | 'number';
  const defs: Array<{ name: string; description: string; params?: Record<string, ParamDef> }>= [
    { name: 'get_store_data', description: 'Extract filters, products, and pagination from the current wheels store page.' },
    { name: 'get_current_filters', description: 'Return current query-string filters for the store page.' },
    { name: 'get_user_vehicle_data', description: "Return info about user's stored vehicle including imageCountThatCouldBeRenderedAsComposite." },
    { name: 'apply_store_filters', description: 'Navigate to /store/wheels with selected filters, then extract results.', params: {
        year: 'string', make: 'string', model: { type: 'string', description: 'Wheel Model (not vehicle model)' }, trim: 'string', drive: 'string', brand: 'string', dia: 'string', width: 'string', offset: 'string', bolt: 'string', mat: 'string', color: 'string', price: 'string', min: 'number', max: 'number', weight: 'string', minWeight: 'number', maxWeight: 'number', reviews: 'number', page: 'number', price_min: 'number', price_max: 'number', weight_min: 'number', weight_max: 'number'
      }
    },
    { name: 'generate_composite', description: 'Use stored vehicle polygons and product image to generate a composite image for a vehicle.', params: { imageIndex: 'number', productImage: 'string', productDescription: 'string' } },
  ];
  return defs.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(Object.entries(t.params || {}).map(([k, v]) => {
          if (typeof v === 'string') return [k, { type: v }];
          return [k, { type: v.type, ...(v.description ? { description: v.description } : {}) }];
        })),
        additionalProperties: false,
      },
    },
  }));
}

async function callOpenAI(messages: Array<any>): Promise<any> {
  const cfg = await ConfigService.getOpenAI();
  if (!cfg) throw new Error('OpenAI API key is not set. Update it in Settings.');
  const { apiKey, model } = cfg;
  const body: any = { model: model || 'gpt-4o-mini', messages, tools: buildToolSchema(), tool_choice: 'auto' };
  currentAbort = new AbortController();
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: currentAbort.signal,
  });
  if (!resp.ok) throw new Error(`OpenAI error ${resp.status}: ${await resp.text()}`);
  return await resp.json();
}

function toApiMessages(state: ChatState, includeSystem = true): any[] {
  const msgs: any[] = [];
  if (includeSystem && CWO_SYSTEM_PROMPT && CWO_SYSTEM_PROMPT.trim()) {
    msgs.push({ role: 'system', content: CWO_SYSTEM_PROMPT.trim() });
  }
  let expectingTool = false;
  for (const m of state.messages) {
    if (m.role === 'assistant') {
      const out: any = { role: 'assistant', content: m.content };
      if (Array.isArray(m.tool_calls) && m.tool_calls.length) {
        out.tool_calls = m.tool_calls;
        expectingTool = true;
      } else {
        expectingTool = false;
      }
      msgs.push(out);
    } else if (m.role === 'tool') {
      // Only include tool messages when immediately following an assistant message with tool_calls
      if (!expectingTool) continue;
      msgs.push({ role: 'tool', content: m.content, tool_call_id: m.tool_call_id });
    } else {
      expectingTool = false;
      msgs.push({ role: m.role, content: m.content });
    }
  }
  return msgs;
}

function pendingToolCallIds(state: ChatState): string[] {
  // Find the last assistant message with tool_calls
  let idx = -1;
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const m = state.messages[i];
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) { idx = i; break; }
  }
  if (idx === -1) return [];
  const assistant = state.messages[idx];
  const required = new Set<string>((assistant.tool_calls || []).map((tc: any) => tc.id));
  // Collect following tool messages and mark fulfilled ids
  for (let j = idx + 1; j < state.messages.length; j++) {
    const m = state.messages[j];
    if (m.role !== 'tool') break; // stop at first non-tool message
    if (m.tool_call_id) required.delete(m.tool_call_id);
  }
  return Array.from(required);
}

function serializeError(e: any): SerializedError {
  return { message: e?.message || String(e), stack: e?.stack, code: e?.code };
}

// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "setVehicle",
    title: "Set Vehicle",
    contexts: ["page", "image"],
    documentUrlPatterns: ["https://www.customwheeloffset.com/wheel-offset-gallery/*"]
  });
  
  chrome.contextMenus.create({
    id: "addToVehicle",
    title: "Add to vehicle",
    contexts: ["image"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "setVehicle" && tab?.id) {
    // Send message to content script to extract vehicle images
    try {
      chrome.tabs.sendMessage(tab.id, {
        type: "EXTRACT_VEHICLE_IMAGES"
      });
    } catch (error) {
      console.error("Error sending message to content script:", error);
    }
  } else if (info.menuItemId === "addToVehicle" && info.srcUrl) {
    // Add image directly to vehicle data
    try {
      const success = await VehicleStorage.addImageToVehicle(info.srcUrl);
      
      if (success) {
        console.log("Image added to vehicle successfully:", info.srcUrl);
        
        // Open vehicle gallery in new tab with the newly added image highlighted
        const galleryUrl = chrome.runtime.getURL('vehicle-gallery.html') + `?newImage=${encodeURIComponent(info.srcUrl)}`;
        chrome.tabs.create({ url: galleryUrl });
        
        // Show success notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon.png',
          title: 'Image Added to Vehicle',
          message: `Added image to vehicle successfully. Gallery opened in new tab.`
        });
      } else {
        // Show error notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon.png',
          title: 'Error Adding Image',
          message: `No vehicle data exists. Please set a vehicle first.`
        });
      }
    } catch (error) {
      console.error("Error adding image to vehicle:", error);
      
      // Show error notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon.png',
        title: 'Error Adding Image',
        message: `Failed to add image to vehicle`
      });
    }
  }
});

// Handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    // ========= Chat protocol =========
    case 'CHAT_STATE_GET': {
      (async () => {
        try {
          const state = await getChatState();
          sendResponse({ ok: true, state });
        } catch (e) {
          sendResponse({ ok: false, error: serializeError(e) });
        }
      })();
      return true;
    }

    case 'CHAT_CANCEL': {
      (async () => {
        try {
          if (currentAbort) { try { currentAbort.abort(); } catch {} currentAbort = null; }
          const state = await getChatState();
          state.inFlight = false;
          await setChatState(state);
          sendResponse({ ok: true });
        } catch (e) {
          sendResponse({ ok: false, error: serializeError(e) });
        }
      })();
      return true;
    }

    case 'CHAT_SEND': {
      (async () => {
        try {
          const { userText, toolMessages, systemContext } = request as { userText?: string, toolMessages?: Array<{ id: string, content: string }>, systemContext?: string };
          const state = await getChatState();

          if (typeof userText === 'string' && userText.trim()) {
            state.messages.push({ role: 'user', content: userText.trim(), ts: Date.now() });
          }
          if (Array.isArray(toolMessages) && toolMessages.length) {
            for (const tm of toolMessages) {
              state.messages.push({ role: 'tool', content: String(tm.content ?? ''), ts: Date.now(), tool_call_id: tm.id });
            }
          }

          state.inFlight = true; state.lastError = undefined; await setChatState(state);

          // Validate no pending tool calls before calling the model again
          const missing = pendingToolCallIds(state);
          if (missing.length) {
            state.inFlight = false; await setChatState(state);
            sendResponse({ ok: false, error: { message: `Pending tool_calls require tool results for ids: ${missing.join(', ')}` }, state });
            return;
          }

          let apiMsgs = toApiMessages(state, true);
          // Inject transient system context immediately after base system prompt (not persisted)
          if (systemContext && String(systemContext).trim()) {
            const sysMsg = { role: 'system', content: String(systemContext).trim() };
            if (apiMsgs.length && apiMsgs[0]?.role === 'system') apiMsgs.splice(1, 0, sysMsg); else apiMsgs.unshift(sysMsg);
          }
          const data = await callOpenAI(apiMsgs);
          const msg = data?.choices?.[0]?.message;

          const assistantText: string = msg?.content || '';
          // Persist assistant with tool_calls if present so that subsequent tool messages are valid
          state.messages.push({ role: 'assistant', content: assistantText, ts: Date.now(), tool_calls: Array.isArray(msg?.tool_calls) ? msg.tool_calls : undefined });

          state.inFlight = false; await setChatState(state);

          const toolCalls = (msg?.tool_calls || []).map((tc: any) => ({
            id: tc.id,
            name: tc.function?.name,
            arguments: (() => { try { return JSON.parse(tc.function?.arguments || '{}'); } catch { return {}; } })(),
          }));

          sendResponse({ ok: true, assistant: assistantText, toolCalls, state });
        } catch (e) {
          const state = await getChatState();
          state.inFlight = false; state.lastError = serializeError(e);
          await setChatState(state);
          sendResponse({ ok: false, error: serializeError(e), state });
        }
      })();
      return true;
    }

    case 'CHAT_CLEAR': {
      (async () => {
        try {
          const empty: ChatState = { messages: [], inFlight: false };
          await setChatState(empty);
          sendResponse({ ok: true, state: empty });
        } catch (e) {
          sendResponse({ ok: false, error: serializeError(e) });
        }
      })();
      return true;
    }

    case "VEHICLE_IMAGES_EXTRACTED":
      (async () => {
        try {
          // Store vehicle data using the VehicleStorage utility
          const success = await VehicleStorage.setVehicleData(request.data, request.vehicleInfo);
          
          if (success) {
            console.log("Vehicle images stored successfully:", request.data);
            
            // Show success notification
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'images/icon.png',
              title: 'Vehicle Set Successfully',
              message: `Extracted ${request.data.length} images from ${request.vehicleInfo.title || 'vehicle'}`
            });
            
            sendResponse({ success: true });
          } else {
            throw new Error("Failed to store vehicle data");
          }
        } catch (error) {
          console.error("Error storing vehicle images:", error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          sendResponse({ success: false, error: errorMessage });
        }
      })();
      return true; // Keep message channel open for async response
      
    case "GET_VEHICLE_DATA":
      (async () => {
        try {
          const vehicleData = await VehicleStorage.getVehicleData();
          sendResponse({ success: true, data: vehicleData });
        } catch (error) {
          console.error("Error retrieving vehicle data:", error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          sendResponse({ success: false, error: errorMessage });
        }
      })();
      return true;
      
    default:
      break;
  }
});
