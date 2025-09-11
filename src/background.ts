import { VehicleStorage } from './utils/vehicleStorage';
import { ConfigService } from './services/configService';
import OpenAI from 'openai';
import { TOOL_DEFS } from './tools/tools';
import type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ChatCompletion,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions';

// ================= Chat Background (per SCOPE.md) =================
type ChatRole = 'system' | 'user' | 'assistant' | 'tool';
interface ChatMsg {
  role: ChatRole;
  content: string;
  ts: number;
  tool_call_id?: string;
  tool_calls?: ChatCompletionMessageToolCall[];
}
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

// Tool schema now sourced from a single shared module

async function callOpenAI(messages: ChatCompletionMessageParam[]): Promise<ChatCompletion> {
  const cfg = await ConfigService.getOpenAI();
  if (!cfg) throw new Error('OpenAI API key is not set. Update it in Settings.');
  const { apiKey, model } = cfg;

  const payload: ChatCompletionCreateParams = {
    model: model || 'gpt-4o-mini',
    messages,
    tools: TOOL_DEFS,
    tool_choice: 'auto',
  };

  console.groupCollapsed('[CHAT BG] callOpenAI');
  console.debug('model:', payload.model, 'msgCount:', (messages || []).length);
  const last = messages[messages.length - 1];
  let hasToolCalls = false;
  if (last && last.role === 'assistant') {
    const a = last as Extract<ChatCompletionMessageParam, { role: 'assistant' }>;
    hasToolCalls = Array.isArray(a.tool_calls) && a.tool_calls.length > 0;
  }
  console.debug('lastMsgRole:', last?.role, 'hasToolCalls:', hasToolCalls);
  console.groupEnd();

  currentAbort = new AbortController();

  // Use official OpenAI client (Chat Completions)
  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  const data = await openai.chat.completions.create(payload, { signal: currentAbort.signal });
  return data;
}

function toApiMessages(state: ChatState, includeSystem = true): ChatCompletionMessageParam[] {
  const msgs: ChatCompletionMessageParam[] = [];
  if (includeSystem && CWO_SYSTEM_PROMPT && CWO_SYSTEM_PROMPT.trim()) {
    msgs.push({ role: 'system', content: CWO_SYSTEM_PROMPT.trim() } as const);
  }
  let expectingTool = false;
  for (const m of state.messages) {
    if (m.role === 'assistant') {
      const out = { role: 'assistant', content: m.content, tool_calls: m.tool_calls } as const;
      if (Array.isArray(m.tool_calls) && m.tool_calls.length) {
        expectingTool = true;
      } else {
        expectingTool = false;
      }
      msgs.push(out);
    } else if (m.role === 'tool') {
      // Only include tool messages when immediately following an assistant message with tool_calls
      if (!expectingTool) continue;
      if (!m.tool_call_id) continue; // tool messages must include tool_call_id
      msgs.push({ role: 'tool', content: m.content, tool_call_id: m.tool_call_id } as const);
    } else {
      expectingTool = false;
      if (m.role === 'system') msgs.push({ role: 'system', content: m.content } as const);
      else if (m.role === 'user') msgs.push({ role: 'user', content: m.content } as const);
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
  const required = new Set<string>((assistant.tool_calls || []).map((tc) => tc.id));
  // Collect following tool messages and mark fulfilled ids
  const seenTools: string[] = [];
  for (let j = idx + 1; j < state.messages.length; j++) {
    const m = state.messages[j];
    if (m.role !== 'tool') break; // stop at first non-tool message
    if (m.tool_call_id) required.delete(m.tool_call_id);
    if (m.tool_call_id) seenTools.push(m.tool_call_id);
  }

    console.groupCollapsed('[CHAT BG] pendingToolCallIds');
    console.debug('assistantIndex:', idx);
    console.debug('assistantToolCallIds:', (assistant.tool_calls || []).map((tc) => tc.id));
    console.debug('consecutiveToolMessageIds:', seenTools);
    console.debug('missingIds:', Array.from(required));
    console.groupEnd();

  return Array.from(required);
}

function getPendingToolCalls(state: ChatState): Array<{ id: string; name: string; arguments: Record<string, unknown> }> {
  // Find last assistant with tool_calls
  let idx = -1;
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const m = state.messages[i];
    if (m.role === 'assistant' && Array.isArray(m.tool_calls) && m.tool_calls.length) { idx = i; break; }
  }
  if (idx === -1) return [];
  const assistant = state.messages[idx];
  const missing = new Set<string>(pendingToolCallIds(state));
  const out: Array<{ id: string; name: string; arguments: Record<string, unknown> }> = [];
  for (const tc of (assistant.tool_calls || [])) {
    const id = tc.id;
    if (!missing.has(id)) continue;
    const name = tc.function?.name;
    const rawArgs = tc.function?.arguments || '{}';
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(rawArgs) as Record<string, unknown>; }
    catch (e) { console.error('[CHAT BG] Failed parsing pending tool arguments:', rawArgs, e); parsed = {}; }
    out.push({ id, name, arguments: parsed });
  }
  console.groupCollapsed('[CHAT BG] getPendingToolCalls');
  console.debug('pending:', out.map(t => `${t.name}:${t.id}`));
  console.groupEnd();
  return out;
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
    chrome.tabs.sendMessage(tab.id, {
      type: "EXTRACT_VEHICLE_IMAGES"
    });
  } else if (info.menuItemId === "addToVehicle" && info.srcUrl) {
    // Add image directly to vehicle data
    const success = await VehicleStorage.addImageToVehicle(info.srcUrl);
    if (success) {
      console.log("Image added to vehicle successfully:", info.srcUrl);
      const galleryUrl = chrome.runtime.getURL('vehicle-gallery.html') + `?newImage=${encodeURIComponent(info.srcUrl)}`;
      chrome.tabs.create({ url: galleryUrl });
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon.png',
        title: 'Image Added to Vehicle',
        message: `Added image to vehicle successfully. Gallery opened in new tab.`
      });
    } else {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon.png',
        title: 'Error Adding Image',
        message: `No vehicle data exists. Please set a vehicle first.`
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
          if (currentAbort) { currentAbort.abort(); currentAbort = null; }
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
          console.groupCollapsed('[CHAT BG] CHAT_SEND received');
          console.debug('hasUserText:', !!(userText && userText.trim()), 'toolMessagesCount:', Array.isArray(toolMessages) ? toolMessages.length : 0);
          if (Array.isArray(toolMessages)) console.debug('toolMessageIds:', toolMessages.map(t => t.id));
          console.debug('stateMsgCount(before):', state.messages.length);
          console.groupEnd();

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
            console.groupCollapsed('[CHAT BG] CHAT_SEND pending tool_calls');
            console.debug('missingIds:', missing);
            // Dump last 6 messages for quick diagnosis
            const tail = state.messages.slice(-6);
            console.debug('tail:', tail.map(m => ({ role: m.role, hasToolCalls: Array.isArray(m.tool_calls) && m.tool_calls.length > 0, tool_call_id: m.tool_call_id, contentPreview: (m.content||'').slice(0,80) })));
            console.groupEnd();
            state.inFlight = false; await setChatState(state);
            sendResponse({ ok: false, error: { message: `Pending tool_calls require tool results for ids: ${missing.join(', ')}` }, state });
            return;
          }

          let apiMsgs = toApiMessages(state, true);
          // Inject transient system context immediately after base system prompt (not persisted)
          if (systemContext && String(systemContext).trim()) {
            const sysMsg = { role: 'system', content: String(systemContext).trim() } as const;
            if (apiMsgs.length && apiMsgs[0]?.role === 'system') apiMsgs.splice(1, 0, sysMsg); else apiMsgs.unshift(sysMsg);
          }
          const data = await callOpenAI(apiMsgs);
          const msg = data?.choices?.[0]?.message;

          const assistantText: string = msg?.content || '';
          // Persist assistant with tool_calls if present so that subsequent tool messages are valid
          state.messages.push({ role: 'assistant', content: assistantText, ts: Date.now(), tool_calls: Array.isArray(msg?.tool_calls) ? msg.tool_calls : undefined });

          state.inFlight = false; await setChatState(state);

          const toolCalls = (msg?.tool_calls || []).map((tc: ChatCompletionMessageToolCall) => {
            const rawArgs = tc.function?.arguments || '{}';
            let parsed: Record<string, unknown> = {};
            try { parsed = JSON.parse(rawArgs) as Record<string, unknown>; }
            catch (e) { console.error('[CHAT BG] Failed parsing tool arguments:', rawArgs, e); parsed = {}; }
            return { id: tc.id, name: tc.function?.name, arguments: parsed };
          });
          console.groupCollapsed('[CHAT BG] CHAT_SEND OpenAI response');
          console.debug('assistantTextLen:', assistantText.length, 'toolCalls:', toolCalls.map((t) => `${t.name}:${t.id}`));
          console.groupEnd();

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

    case 'CHAT_INIT': {
      (async () => {
        try {
          const state = await getChatState();
          const pending = getPendingToolCalls(state);
          sendResponse({ ok: true, pending, state });
        } catch (e) {
          sendResponse({ ok: false, error: serializeError(e) });
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
