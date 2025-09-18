# Agent Toggle & LangChain Integration Scope

## Objective
Allow users to enable or disable agents discovered on a domain so that a forthcoming LangChain-based assistant can invoke only the approved tools. Toggle state must persist across sessions and synchronize with a background mediator that exposes enabled agents (and their A2A payloads) to LangChain.

## Current Signals
- Content script discovers `llms.txt`, UTCP, and several `/.well-known/*` descriptors, caching results for 24 hours and rendering them in a footer with manual rescan support.
- Results currently display raw previews; no interaction beyond rescanning exists.
- Background service worker is idle; LangChain integration is not yet wired.

## Proposed Additions
1. **Footer Toggle UI**
   - Add one switch per agent descriptor (not per skill) in the existing footer list.
   - Reflect enabled state immediately, including after rescans and cache hits.
   - Default to disabled until the user opts in.

2. **State Management**
   - Persist toggle decisions in `chrome.storage.local` keyed by origin + agent id.
   - Clear cached decisions when forced rescans detect that an agent disappeared.

3. **Background Mediation**
   - Background service worker maintains a lightweight registry of enabled agents and their latest A2A payloads.
   - Expose a message channel (e.g., `chrome.runtime.sendMessage`) or long-lived port for the LangChain runtime to request enabled agents.
   - Ensure updates propagate: content script informs background after toggles or discovery changes.

4. **LangChain Hand-off**
   - Provide a helper that converts enabled A2A entries into LangChain tool descriptors (one tool per agent for now) and returns an initialized A2A client wrapper.

## Testing & Validation
- Unit-test toggle storage helpers and background registry logic.
- Manual QA: enable/disable agents, refresh pages, force rescans, and confirm state persists.
- Simulate LangChain handshake to verify only enabled agents are surfaced.
