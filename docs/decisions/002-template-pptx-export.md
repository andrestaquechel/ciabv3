# Template-Based PPTX Export

**Date:** 2026-07-10
**Status:** accepted

## Context

Mini Box output must match a branded 7-slide PowerPoint template with precise layout, fonts, and GIF placement. An earlier approach used Google Slides API for live sync.

## Decision

Use `templates/mini-box-master.pptx` as the single source of truth. Export via JSZip XML text replacement in `src/lib/pptx/template-export.ts`. Users download `.pptx` and manually upload to Google Drive → Open with Google Slides.

Preview uses the same build pipeline (`/api/pptx/preview`) rendered client-side with `pptx-viewer`.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Google Slides API write/sync | OAuth complexity, API limits, harder to match template fidelity |
| Programmatic slide generation (pptxgenjs) | Cannot reproduce branded template layout without rebuilding all styling |
| PDF export | Not editable in Slides; doesn't match team workflow |

## Consequences

**Positive:**
- Pixel-faithful output matching master template.
- Preview and export share one code path.
- No Google auth required for core builder workflow.

**Negative:**
- Template changes require updating hardcoded slide/shape indices in `buildReplacements()` and `GIF_SLOTS`.
- Text replacement is plain-text only; no rich formatting edits.
- Divider slide formatting required explicit XML patching (`fixDividerSlideTitleFormatting`) because `pptx-viewer` does not inherit layout styles when slide `lstStyle` is empty.
