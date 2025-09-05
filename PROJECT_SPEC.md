# Custom Wheel Offset Chrome Extension — Consolidated Spec and Plan

## Scope

- Inject a compact, expandable chat/debug widget into all CustomWheelOffset pages.
- Remove existing third‑party chat widgets to avoid UI conflicts.
- Maintain existing product and vehicle gallery UI injection. Any chat/widget
  changes must NOT regress the compositing UI on product pages or the Set Vehicle
  UI on gallery pages.
- Provide a wheel search “tool” that accepts rich filters and returns structured results.
- Expose the tool to ChatGPT via function-calling schema for automated assistance.
- Ship as a Manifest V3 Chrome extension with a robust build, testing, and security posture.

## Objectives

- Deliver a polished, performant, and accessible widget UI with Chat and Debug modes.
- Support advanced wheel search (brand, size, finish, bolt pattern, price range, stock, sort, limit).
- Maintain clear separation of concerns: content script (injection/removal), widget (UI), service (data), tool (ChatGPT binding).
- Prepare for future integrations: Playwright scraping and ChatGPT API.

## Current Status (Summary)

- Chat widget: Injects on target pages; includes Chat and Debug modes; local history; responsive UI.
- Widget removal: Broad selector coverage, MutationObserver, iframe handling, safe filtering.
- Service: Mocked data flow with strong typing and error handling; ready to swap in real scraping.
- Tool: ChatGPT function schema and runtime parameters implemented.
- Build: Webpack builds cleanly; content script and assets generated in `dist/`.
- Testing assets: `dist/test-cwo.html` and testing guide present.

## Architecture Overview

- Content Script: Injects the widget, removes existing chat widgets, observes dynamic DOM, ensures idempotent behavior.
- Widget UI (web accessible): Standalone HTML/JS injected via content script; two modes (Chat, Debug).
- Service Layer: `CustomWheelOffsetService` encapsulates product extraction and filtering (mocked for now).
- Tool Layer: `searchWheelsTool` wraps service for function calling and parameter validation.
- Build System: Webpack bundles content script and copies widget assets + manifest to `dist/`.

## Chrome Extension Configuration (MV3)

- Content scripts: Run on `https://www.customwheeloffset.com/*` at `document_end`.
- Web accessible resources: `chat-widget.html`, `chat-widget.js`.
- Minimal permissions: Start with `activeTab`; expand only as required (e.g., `storage`).
- CSP: Restrictive for extension pages; no remote code; avoid inline script in MV3 pages.

## Widget UI

Features
- Floating button in bottom‑right; opens compact panel with tabs: Chat | Debug.
- Chat Mode: message list, input, send; local history; smart parsing to trigger searches.
- Debug Mode: select filters (brand/size/finish), price min/max, in‑stock toggle, search; raw JSON output.
- Accessibility: keyboard navigable, focus management, ARIA roles; high contrast.
- Design: modern, responsive; subtle animations; gradient accents.

Key classes
- `.cwo-chat-widget` container; `.cwo-widget-button`; `.cwo-widget-container`.
- `.cwo-chat-mode`, `.cwo-debug-mode`, `.cwo-message`, `.cwo-debug-controls`.

## Service Layer

Responsibilities
- Accept filter options and return structured product results with metadata and errors.
- Support pagination, sorting, and stock filtering.
- Provide helper APIs: `getAvailableFilters`.

Data contracts
- WheelProduct: id, brand, model, specs, price, stock, imageUrl, productUrl, optional details.
- FilterOptions: brand[], size[], finish[], boltPattern[], priceRange{min,max}, inStockOnly, sortBy, sortOrder, searchTerm, limit.
- ExtractionResult: products[], counts, pages, appliedFilters, extractionTime, errors[].

## ChatGPT Function Tool

- Name: `search_wheels~` — exposes the service with schema‑validated parameters.
- Use cases: auto‑invoked by Chat parsing (e.g., "black wheels under $500").
- Returns: structured JSON for easy formatting in the chat UI.

## Testing and Build

- Build: `npm run build` (prod), `npm run build:debug` (dev), lint/test scripts available.
- Test page: `dist/test-cwo.html` with mock chat widgets to validate removal and UI.
- Manual checks: extension load, widget injects, modes function, storage persists, no console errors.

## Security and Privacy

- MV3 service worker and CSP for extension pages; no remote code execution.
- Principle of least privilege; prompt users for optional permissions at runtime.
- Sanitize any user input rendered in the widget; avoid `innerHTML` with untrusted data.

## Performance

- Debounce/throttle DOM observers and resize handlers.
- Avoid heavy work on main thread in content script; keep bundle size lean.
- Memoize repeated computations in the widget.

## Detailed Status and Files

- Content Script: `src/content-scripts/customWheelOffsetWidget.ts` (injection/removal logic; built to `dist/customWheelOffsetWidget.js`).
- Widget: `public/chat-widget.html`, `public/chat-widget.js` (copied to `dist/`).
- Service: `src/services/customWheelOffsetService.ts` + docs `src/services/README_CustomWheelOffset.md` (source of this section).
- Tool: `src/tools/searchWheelsTool.ts` (schema/validation).
- Manifest: `public/manifest.json` (copied to `dist/`).
- Testing guide: `dist/README_TESTING.md`.

## Technical Plan

Phases
1) UI & UX Polishing (priority now)
2) Data Layer Hardening (prep for real scraping)
3) Playwright Integration (real extraction)
4) ChatGPT Integration (real responses)
5) Performance & Analytics

Milestones & Tasks

Phase 1 — UI & UX Polishing
ru
Phase 2 — Data Layer Hardening
- Normalize FilterOptions and map from UI controls; add schema validation.
- Improve mock data determinism for predictable tests; seedable RNG.
- Unify error shape across service/tool/UI; add error codes.
- Add pagination model and UX for long results.

Phase 3 — Playwright Integration
- Add configurable runner wrapper; headless/local flags.
- Implement navigation + wait strategies; handle pagination.
- Extract product cards with resilient selectors; image URLs, prices, stock.
- Rate limiting and retries; politeness delays; error recovery.
- Feature flag to switch mock/real in service; env‑based toggle.

Phase 4 — ChatGPT Integration
- API client wrapper; function calling plumbing with `search_wheels`.
- Key management (user‑provided), secure storage, revoke/reset.
- Streaming responses in Chat mode; partial result rendering.
- Error and rate limit handling; backoff; UI messaging.

Phase 5 — Performance & Analytics
- Bundle splitting and code‑splitting for content script and widget assets.
- Lazy load Debug tab logic; defer non‑critical code.
- Basic usage metrics (opt‑in) and error logging (redacted).
- Performance budget: widget open <16ms frame budget work.

## Task Breakdown (Actionable)

UI & UX (start here)
- Add CSS variables and themes; refactor widget CSS to use variables.
- Implement focus trap and keyboard shortcuts (open/close with hotkey).
- Add loading spinners, error banners, and toasts.
- Sanitize and linkify chat content safely.
- Improve Debug form: validation, disabled states, spinners, copy JSON.
- Add a small settings menu (persist theme, compact mode).

Service & Tool
- Define shared TypeScript types in a single module; enforce across layers.
- Add Zod/typed validation for tool parameters and UI inputs.
- Introduce feature flag to toggle mock vs real extraction.

Playwright Prep
- Create adapter interface and stub implementation; wire through service.
- Document selectors and extraction strategy per page section.

ChatGPT Prep
- Define function‑calling handler contract and response mapping to UI.
- Stub client with mock streaming to test UI.

Build & Testing
- Add unit tests for parsing/validation and UI state reducers.
- Ensure webpack copies assets; add size reports; set bundle budget CI note.

## Commands

- Build: `npm run build` | Dev: `npm run build:debug`
- Lint: `npm run lint` | Test: `npm test`
- Load extension from `dist/` via `chrome://extensions`.

## Development Workflow

- Make changes to sources under `src/` or assets under `public/`.
- Run `npm run build:debug` to rebuild development bundles and copy assets to `dist/`.
- In Chrome, visit `chrome://extensions`, toggle the extension off/on or click “Reload” to pick up changes.
- Open a `customwheeloffset.com` page and verify the chat widget (Ctrl+Shift+Y toggles it).

## Success Criteria

- Widget renders consistently, accessible, and responsive; no console errors.
- Debug tab executes searches with validated inputs; structured results.
- Function tool returns well‑formed JSON; errors are clear and consistent.
- Playwright (later) reliably extracts real products with pagination.
- ChatGPT (later) provides coherent responses with function calls.
