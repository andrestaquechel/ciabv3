# AI Rules

> Durable engineering conventions. Update when a convention is established, not for one-off choices.

## Coding Conventions

- TypeScript throughout `src/`; path alias `@/*` maps to `./src/*`.
- App Router conventions: pages in `src/app/`, API routes in `src/app/api/`.
- Client components marked `"use client"`; server routes use `export const runtime = "nodejs"` where needed.
- Tailwind CSS 4 with CSS variables defined in `src/app/globals.css`.
- Match existing naming: `MiniBoxDocument`, `MiniBoxSectionId`, kebab-case file names.

## Approved Patterns and Libraries

- **PPTX export:** JSZip XML surgery on `templates/mini-box-master.pptx` via `src/lib/pptx/template-export.ts`. Do not rebuild slides from scratch with pptxgenjs unless explicitly changing approach.
- **Preview:** Server builds PPTX → base64 → client `pptx-viewer` render.
- **Persistence:** Browser `localStorage` via store modules (`box-store.ts`, `knowledge-store.ts`, `knowledge-cache.ts`).
- **AI routes:** Mock-first — return `source: "mock"` with usable fallback content when API keys are unset.
- **Document model:** `src/lib/mini-box.ts` is the single source of truth for section shapes and status logic.
- **Defaults:** New Mini Box documents seed from `mini-box-shadow-ai-defaults.ts`.

## Commands

```bash
# Install
npm ci

# Dev
npm run dev

# Build (also used in CI)
npm run build

# Lint
npm run lint
```

## Security Requirements

- Never commit `.env`, tokens, or API key values.
- Reference env var names only in docs and code comments.
- Google OAuth scopes limited to read-only Drive and Slides.
- API routes that access Drive require `session.accessToken`; do not bypass session checks.
- Do not store secrets in context files (`architecture.md`, `current_state.md`, etc.).

## Testing Expectations

- No test framework configured. Manual verification required for PPTX formatting, builder flows, and Drive features.
- Run `npm run build` before pushing to catch type and compile errors.
- PPTX changes: verify preview slides and downloaded file, especially divider slides (3, 6) and GIF slots (2, 4, 7).

## Architectural Boundaries

- **No server database.** Do not add one without a decision record.
- **Template is source of truth for slide layout.** Text replacement preserves shape indices; changing template requires updating `buildReplacements()` and `GIF_SLOTS` in `template-export.ts`.
- **Builder works without auth.** Do not gate builder or PPTX routes behind login.
- **Google features are optional.** Drive/knowledge routes return 401 without session; UI should handle gracefully.
- **Read Next.js 16 docs** in `node_modules/next/dist/docs/` before changing framework APIs — this is not standard Next.js 14/15.

## Prohibited Patterns

- Inventing API endpoints, env vars, or document fields not in `mini-box.ts`.
- Storing user content server-side without an explicit architectural decision.
- Force-pushing to `main`.
- Using `seeing-in-color` GitHub account for pushes to `andrestaquechel/ciabv3`.
- Unrelated refactors bundled with feature fixes.
- Skipping mock fallbacks in AI/Giphy routes.
