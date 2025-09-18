# Repository Guidelines

## Project Structure & Module Organization
Source lives in `src/` with entry points `main.ts`, `menu.ts`, and `background.ts`; treat each file as a feature-focused module and keep DOM helpers inside the same module unless they are shared, in which case upgrade them into a utility under `src/utils/` (create it if needed). Chrome assets, including `manifest.json` and the popup markup, sit in `public/`; compiled bundles land in `dist/` after builds, and `scss/main.scss` owns styling that is imported through Webpack. Keep generated files out of version control.

## Build, Test, and Development Commands
Run `npm install` once per clone. Use `npm run dev` for an incremental production build with file watching; it outputs to `dist/` so you can load an unpacked extension in Chrome. Ship builds with `npm run build`, which runs Webpack in production mode and will fail on TypeScript errors because of `noEmitOnError`. When experimenting with TypeScript diagnostics, `npx tsc --noEmit` is a quick lint-style check.

## Coding Style & Naming Conventions
TypeScript is compiled in strict mode, so prefer explicit return types on exported functions and avoid `any`. Follow the existing four-space indentation and single-quote strings. Use `camelCase` for variables and functions, `PascalCase` for classes, and keep Chrome message/action constants in SCREAMING_SNAKE_CASE. SCSS modules should mirror their owning TypeScript file name (e.g., `main.ts` ↔ `main.scss`).

## Testing Guidelines
No automated tests exist yet; when adding one, colocate it in a future `tests/` folder using Jest (already hinted by dependencies). Until then, document manual verification steps in pull requests, especially around keyword masking and agent discovery logic. Aim to cover new discovery branches (e.g., LLMS.txt parsing) with unit tests once the framework lands.

## Commit & Pull Request Guidelines
Current history shows only "Initial Commit" messages, so establish a clean imperative style such as `feat: add LLMS discovery to background worker`. Reference GitHub issues when available and attach screenshots or HAR snippets if UI or network behavior changes. Pull requests should summarize the user journey, list manual test URLs, and call out any permissions or manifest edits.

## Agent Discovery Focus
The content script probes `llms.txt`, `/.well-known/agent.json`, `/.well-known/agent-card.json`, `/.well-known/a2a-agents`, and `/utcp`, caches per-domain results for 24 hours, and surfaces findings via an on-page footer that also exposes a manual “Scan again” action. Keep request definitions centralized (currently in `src/main.ts`), add graceful fallbacks for missing files, and reuse cached responses in `chrome.storage.local` to avoid needless network traffic.

## Error Handling:
Never hide errors, throw them, or show them. Make it as easy to debug as possible.
