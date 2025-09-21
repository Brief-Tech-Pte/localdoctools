# AGENTS: Local Doc Tools

## Repository Snapshot

- Vue 3 + Quasar 2 SPA, client-only (no backend, no network calls)
- TypeScript everywhere with `<script setup lang="ts">`; strict mode via Quasar build config
- Styling uses SCSS; Quasar theme tokens live in `src/css/quasar.variables.scss`

## Get Started

1. Install dependencies with `npm install` (postinstall runs `quasar prepare`).
2. Launch the dev server: `npm run dev` (alias `quasar dev`).
3. Run a production build: `npm run build`.
4. Lint before submitting changes: `npm run lint`.
5. Format code on demand with `npm run format` (Prettier is also configured for format-on-save in VS Code).
6. Run unit tests with `npm run test` (CI mode) or `npm run test:watch` during development.
7. Generate a coverage report for Codecov with `npm run test:coverage` when requested.
8. Regenerate favicons/app icons with `npm run icons` (requires global `icongenie` and ImageMagick's `magick` binary) whenever the base SVG changes.
9. Check for build issues with `npx vue-tsc --noEmit`

## Coding Standards

- Formatting: 2-space indentation, LF line endings, single quotes, 100-char print width (`.editorconfig`, `.prettierrc.json`).
- ESLint flat config (`eslint.config.js`) combines Quasar + Vue + TypeScript presets. Expect type-aware linting and `@typescript-eslint/consistent-type-imports` enforcement.
- Prefer Composition API with `<script setup>`; use `defineProps`, `defineEmits`, `withDefaults` rather than Options API patterns.
- Keep imports type-safe; mark unused runtime dependencies as `type` imports when possible.
- For new UI, favour Quasar components (`q-` prefixes) and responsive grid utilities over raw HTML.

## Project Structure

- `src/layouts`: App shells (`MainLayout.vue`) wrapping route views.
- `src/pages`: Route-level views for core app pages (home, error, etc.).
- `src/tools`: Feature packages. Each tool keeps its pages/components, business logic, tests, and assets together.
- `src/components`: Reusable UI pieces; follow PascalCase names.
- `src/boot`: Boot files array is currently empty. Only add boot files when absolutely required for cross-cutting concerns.
- Assets live under `src/assets`; public favicons reside in `public/icons`.

## Feature Conventions

- Word -> Markdown (`src/tools/word-to-markdown/components/WordToMarkdownPage.vue`) is the current flagship tool. It dynamically imports browser builds of `mammoth` and `turndown`; follow this pattern for large, browser-only libraries to keep initial bundles lean and to preserve local-only processing.
- Respect privacy/air-gapped design: never introduce backend services, telemetry, or third-party network calls. All document handling must stay in-browser.
- When adding download or clipboard features, use standard browser APIs and release resources (e.g., revoke object URLs) as done in existing code.
- Update navigation (layout drawer + header chips) when adding new routes so tools surface consistently.

## Styling Guidelines

- Global styles go in `src/css/app.scss`; prefer scoped styles within components when possible.
- Theme colours come from `src/css/quasar.variables.scss`; adjust or reference these tokens for consistent branding.
- Use Quasar utility classes (spacing, typography) instead of custom CSS where available.

## Tooling Notes

- Vite checker plugin runs TypeScript + ESLint during builds—keep the config in `quasar.config.ts` in sync with any new lint commands.
- Node version should satisfy the `package.json` engines field (`^20`, `^22`, `^24`, `^26`, or `^28`).
- The project is ESM (`"type": "module"`); write config files and scripts accordingly.
- `.npmrc` relaxes pnpm peer strictness—do not rely on features incompatible with npm CLI.

## Workflow Expectations

- Before opening a PR or handing work back, run `npm run lint` and (if relevant) `npm run build` to catch bundling issues.
- Document noteworthy changes in `README.md` or future changelog files when you add new tools or commands.
- Keep commits scoped and descriptive; although Git hooks are not configured, treat lint failures as blockers.

## When In Doubt

- Mirror existing patterns in `src/tools/word-to-markdown` for new tool flows (local processing, guarded dynamic imports, Quasar-first UI).
- Ask whether a change affects privacy guarantees; if so, consult maintainers before merging.
- If adding third-party libraries, prefer ones with browser-friendly bundles and no transitive network requirements.
