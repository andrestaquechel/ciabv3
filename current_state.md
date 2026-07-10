# Current State

> Active work state. Update after every meaningful milestone and before handoff.

**Last updated:** 2026-07-10

## Current Objective

Repository context bootstrapped; no active feature work in progress.

## Completed Work

- Fixed One-Pager and Chats divider slide title font size in preview and export (`411b4df`).
- Created repo-context skill and always-on Cursor rule (`.cursor/skills/repo-context/`, `.cursor/rules/repo-context.mdc`) — not yet committed.
- Bootstrapped repository context files (`architecture.md`, `current_state.md`, `ai_rules.md`, `docs/features/`, `docs/decisions/`).

## Work In Progress

- None.

## Files Changed

- `src/lib/pptx/template-export.ts` — added `fixDividerSlideTitleFormatting()` for slides 3 and 6.
- `templates/mini-box-master.pptx` — patched divider slide title XML with explicit 56pt Inter Tight styling.
- `architecture.md`, `current_state.md`, `ai_rules.md` — created (this bootstrap).
- `docs/features/*.md`, `docs/decisions/*.md` — created (this bootstrap).

## Implementation Details

- Divider slides (3 = One-Pager, 6 = Chats) shipped with empty `<a:lstStyle/>` and minimal run properties. `pptx-viewer` fell back to default body font size instead of inheriting layout's 56pt title style.
- Fix applies explicit `sz="5600"` Inter Tight styling at export time and in the master template.

## Decisions Made

| Decision | Why | Doc |
|----------|-----|-----|
| Bootstrap repo context from code inspection | No context files existed; skill requires repo as source of truth | — |
| Patch template + runtime fix | Ensures both source template and all exports/previews are correct | `docs/decisions/002-template-pptx-export.md` |

## Test Status

| Command | Result |
|---------|--------|
| `npm run build` | not run this session |
| `npm run lint` | not run this session |
| Manual PPTX preview (slides 3, 6) | not verified this session |

## Known Bugs and Risks

- `git push` to `origin/main` fails — CLI authenticated as `seeing-in-color`, not `andrestaquechel`. Branch is 7 commits ahead of remote.
- `.cursor/` skill and rule files are untracked.
- No automated tests; PPTX formatting regressions require manual preview checks.

## Unresolved Questions

- Should `.cursor/` skill and rule files be committed to the repo?
- Should remaining 6 unpushed commits be published after auth fix?

## Next Action

Verify divider slide font fix in builder preview, then push pending commits using `andrestaquechel` GitHub credentials.

## Commands to Continue

```bash
npm run dev
# Open builder, check slides 3 (One-Pager) and 6 (Chats) title size

gh auth login   # sign in as andrestaquechel
git push origin main
```

## Relevant Documents

- `docs/features/pptx-export.md`
- `docs/features/mini-box-builder.md`
- `docs/decisions/002-template-pptx-export.md`
- `architecture.md`
- `ai_rules.md`
