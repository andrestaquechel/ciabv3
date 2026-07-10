# Mini Box Builder

**Status:** active
**Last updated:** 2026-07-10

## Purpose

Author 7-slide Living Security Mini Box decks: topic ideation, section editing with AI and GIFs, live preview, review checklist, and PPTX download.

## Behavior

1. User creates or opens a box at `/builder/[id]`.
2. New Mini Box documents seed with Shadow AI example content.
3. User progresses through sections: Topic/Title → Welcome → One-Pager Pt1 → One-Pager Pt2 → Chat → Review.
4. Section status (`empty` / `draft` / `ready`) is derived from content completeness; GIFs required for `ready` on welcome, onePagerP1, and chat.
5. Live PPTX preview (optional sync to active section) renders server-built deck via `pptx-viewer`.
6. Review panel shows checklist; Publish downloads `.pptx`.

## Modules

| Module | Path | Role |
|--------|------|------|
| Orchestrator | `src/components/builder/MiniBoxBuilder.tsx` | Layout, section routing, publish |
| Top bar | `src/components/builder/BuilderTopBar.tsx` | Box switcher, rename, sync-preview toggle |
| Section nav | `src/components/builder/SectionNav.tsx` | Section list, status badges, publish CTA |
| Ideate | `src/components/builder/IdeatePanel.tsx` | Topic brainstorming, AI suggestions |
| Editor | `src/components/builder/SectionEditor.tsx` | Field editing, AI rewrite, GIF picker |
| Review | `src/components/builder/ReviewPanel.tsx` | Pre-publish checklist |
| Preview | `src/components/builder/PptPreview.tsx` | Slide navigation, debounced preview |
| GIF picker | `src/components/builder/GifPicker.tsx` | Giphy search UI |
| Document model | `src/lib/mini-box.ts` | Types, status logic, section order |
| Defaults | `src/lib/mini-box-shadow-ai-defaults.ts` | Shadow AI starter content |
| Persistence | `src/lib/box-store.ts` | localStorage CRUD |

## Data Model

`MiniBoxDocument` in `src/lib/mini-box.ts`:

- Top-level: `id`, `type` (`mini-box` | `ciab`), `title`, `topic`, `articles[]`, `status`, `signature`, timestamps.
- Sections: `title` (topicTitle), `welcome` (intro, contents, closing, gif), `onePager` (greeting, subjectLine, bodyPart1, callout, bodyPart2, gif), `chat` (message, gif), `review`.
- Legacy sections (`ideate`, `inputs`) retained for migration; `normalizeSectionId()` maps old ids on load.

## Interfaces

- **UI:** `/builder/[id]` — split editor + preview layout.
- **API:** `/api/ai/generate`, `/api/ai/research`, `/api/giphy`, `/api/pptx/preview`, `/api/pptx/export`.
- **Storage:** `localStorage` key `box-studio:boxes`.

## Workflows

1. **Create box** — `createMiniBox()` in box-store → navigate to `/builder/{id}`.
2. **Edit section** — SectionEditor patches document → auto-saves to localStorage.
3. **AI assist** — POST to `/api/ai/generate` with section type and current text; applies returned fields.
4. **Preview** — Debounced POST to `/api/pptx/preview` with full document; renders slide N.
5. **Publish** — POST to `/api/pptx/export` → browser download.

## Edge Cases

- Legacy section ids (`ideate`, `inputs`, `onePager`) normalized to current nav ids on load.
- CIAB type can be created but has no distinct builder workflow yet.
- Sync preview maps `onePagerP1` → slide 4, `onePagerP2` → slide 5, `chat`/`review` → slide 7.
- Empty API keys → mock AI and Giphy responses; builder remains functional.

## Tests

- **Location:** None.
- **Coverage:** Manual — section editing, status badges, preview sync, download.

## Limitations

- No cross-browser or cross-device sync (localStorage only).
- No version history or undo beyond browser refresh.
- CIAB full workflow not implemented.
- Analytics nav item disabled in sidebar.
