# Agent Platform Restructure & Server Integration Scope

## Goals
- Restructure the repository into a workspace layout with the Chrome extension under `packages/extension` and a new Express/Lambda-compatible agent service under `packages/server`.
- Move all orchestration to the Node environment so the extension only discovers agents, captures user input, and proxies requests to the service.
- Keep agent discovery, caching, and toggle UX intact while introducing configurable settings for the remote service.

## Current State
- Extension (now under `packages/extension`) identifies well-known descriptors, caches results, renders a footer with toggles, and provides chat/settings pages.
- Background script stores enabled agents, but now forwards chat prompts to a remote endpoint (`/chat`) instead of calling OpenAI directly.
- Chat/settings pages persist the OpenAI model, optional API key (forwarded to the service), and the agent server URL in `chrome.storage.local`.
- Server scaffold (under `packages/server`) exposes `/healthz` and `/chat`, using the consolidated agent execution layer; includes a serverless handler for AWS Lambda via `@codegenie/serverless-express`.

## Next Steps
1. **Extension Enhancements**
   - Harden server URL validation and error surfaces in the chat UI.
   - Expand background telemetry/logging for server failures and agent responses.
   - Consider batching agent metadata to reduce payload size when forwarding to the service.

2. **Server Build & Deployment**
   - Package Express app with build artifacts (`dist/`) and document local vs. Lambda deployments.
   - Add configuration options (environment variables) for rate limiting, logging, and API key management.
   - Implement real A2A tool invocation logic once the service interface is finalised.

3. **Security & Settings**
   - Keep model/provider credentials server-side; the extension now only stores the agent service URL.
   - Add authentication (e.g., signed requests or API tokens) between the extension and server before public release.

## Validation Checklist
- Extension build (`npm run build` from repo root) succeeds and produces the unpacked bundle in `packages/extension/dist`.
- Server build (`npm run build --workspace sc-agent-server`) emits `dist/` with `server.js` and `handler.js`. Local dev: `npm run dev --workspace sc-agent-server`.
- Manual QA: configure server URL in the settings page, enable agents, trigger chat prompts, observe server logs, and ensure responses reach the footer/chat UI.
