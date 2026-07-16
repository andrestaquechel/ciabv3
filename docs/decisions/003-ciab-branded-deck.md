# 003 — CIAB branded deck export (Stage 2)

**Status:** In progress (foundation landed; render path not yet wired)
**Date:** 2026-07-16

## Context

Stage 1 shipped the full Main Box content pipeline in Slack (concept options →
sources → outline → full draft + GIFs → reviewable Google Doc). Stage 2 is the
**branded deck** so the output looks exactly like the archive examples
(`CiaB_MM.YY_[Title]`, 30-45 MB Google Slides decks).

The Mini Box builds its deck by XML-surgery against a committed
`templates/mini-box-master.pptx` with hardcoded slide/shape indices. That does
not transfer well to CIAB because:

- The example decks are 30-45 MB — too large to commit per-topic-style and
  awkward in git.
- The Main Box layout is longer and more variable than the fixed 7-slide Mini
  Box (multi-slide blog, 4 weekly email+chat pairs, resources).

## Decision

Use a **token-seeded master deck in Drive + the Google Slides API**, not XML
surgery:

1. Keep one branded **master deck** in Drive, derived from a real example
   (currently a copy of `CiaB_06.26_Mobile Social Engineering`).
   - File: `CiaB_Master_Template_WIP` — id `1DKaholGI_SzS0YBb9U7Om3z8AaM7GowgtpSX1ncuCS8`
     (override via `BOX_STUDIO_CIAB_MASTER_TEMPLATE_ID`).
2. Seed the master's text boxes with `{{TOKENS}}` (see scheme below), preserving
   its exact fonts, colors, and layout.
3. Per box: `drive.files.copy` the master (server-side, no download), then one
   `slides.presentations.batchUpdate` of `replaceAllText` (token → final copy),
   then share + return the link. GIFs are replaced via
   `replaceAllShapesWithImage` keyed on alt-text tokens (phase 2b).

Implemented so far (`src/lib/pptx/ciab-deck-export.ts`):
- `buildCiabDeckTokens(content)` — pure token map (verified).
- `EXPECTED_CIAB_TOKENS` — the contract the master must contain.
- `renderCiabDeckFromMaster(...)` — copy + replaceAllText (inert until wired).

## Token scheme

Scalar text tokens (master must contain each once, in the right slide):

- `{{COVER_TITLE}}`, `{{COVER_SUBTITLE}}`
- `{{WELCOME_BODY}}`
- `{{BLOG_TITLE}}`, `{{BLOG_INTRO}}`
- `{{BLOG_S1_HEADING}}` / `{{BLOG_S1_BODY}}` / `{{BLOG_S1_MOVE}}` … up to `S4`
- `{{BLOG_CONCLUSION_HEADING}}` / `{{BLOG_CONCLUSION_BODY}}` / `{{BLOG_CONCLUSION_MOVE}}`
- Per week `w` in 1-4: `{{Ww_EMAIL_SUBJECT}}`, `{{Ww_EMAIL_GREETING}}`,
  `{{Ww_EMAIL_BODY}}`, `{{Ww_CHAT}}`
- `{{RESOURCES}}`

Blog body is capped at 4 sections + a conclusion to match the example decks and
the Stage 1 prompt design. Unused tokens resolve to empty strings.

## Remaining work (next iteration, best done interactively)

1. **Seed the master deck** with the tokens above (a one-time pass in Slides;
   can be scripted with `replaceAllText` old-copy → token once we can drive the
   Slides API).
2. **Enable the Slides write scope** on the Google OAuth app
   (`https://www.googleapis.com/auth/presentations`) — the app currently holds
   `presentations.readonly`.
3. **GIF injection** via `replaceAllShapesWithImage` (alt-text tokens
   `GIF_WELCOME`, `GIF_BLOG_1`, `GIF_W1_EMAIL`, `GIF_W1_CHAT`, …).
4. **Wire into the flow**: after the outline is approved and the full box is
   generated, call `renderCiabDeckFromMaster` alongside the reviewable Doc and
   post the branded deck link for CSM review.
5. **Verify by rendering** and comparing against the example decks; iterate on
   the master until it matches (the "check the output until it looks like an
   example" loop).

Why not finished now: pixel-fidelity requires seeding the master + Slides write
scope + a visual render/compare loop, none of which can be completed headless.
Stage 1 already delivers a complete, reviewable box today.
