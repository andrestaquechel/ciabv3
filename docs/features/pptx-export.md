# PPTX Export & Preview

**Status:** active
**Last updated:** 2026-07-10

## Purpose

Generate template-faithful 7-slide Mini Box PowerPoint files from `MiniBoxDocument` data, with live in-browser preview.

## Behavior

- Server reads `templates/mini-box-master.pptx`, replaces text in designated slide shapes, injects GIFs into media slots, and returns the modified PPTX.
- Preview route returns base64; export route returns binary download.
- Client renders preview slides via `pptx-viewer`.

## Modules

| Module | Path | Role |
|--------|------|------|
| Export engine | `src/lib/pptx/template-export.ts` | Build, replace, GIF inject, divider fix |
| Preview API | `src/app/api/pptx/preview/route.ts` | POST → base64 response |
| Export API | `src/app/api/pptx/export/route.ts` | POST → binary download |
| Preview UI | `src/components/builder/PptPreview.tsx` | Debounced fetch + slide render |
| Master template | `templates/mini-box-master.pptx` | 7-slide Shadow AI source |

## Data Model

Input: full `MiniBoxDocument`. No separate export schema.

### Slide mapping (1-indexed)

| Slide | Label | Content replaced |
|-------|-------|------------------|
| 1 | Cover | Topic title (shape 0) |
| 2 | Welcome | Intro (shape 1), contents + closing (shape 2), GIF |
| 3 | One-Pager divider | Title only — formatting fix applied |
| 4 | One-Pager email | Greeting + bodyPart1 (0), callout (1), subjectLine (4), GIF |
| 5 | Email / tips | bodyPart2 + signature (0) |
| 6 | Chats divider | Title only — formatting fix applied |
| 7 | Chat | Message (shape 1), GIF |

### GIF media slots

| Slide | Media path |
|-------|------------|
| 2 | `ppt/media/image6.gif` |
| 4 | `ppt/media/image10.gif` |
| 7 | `ppt/media/image11.gif` |

## Interfaces

- **POST `/api/pptx/preview`** — `{ document }` → `{ pptxBase64, slideCount: 7 }`
- **POST `/api/pptx/export`** — `{ document }` → `application/vnd...presentationml.presentation` attachment
- **Filename:** `Mini-Box-{title}.pptx` via `pptxFilename()`

## Workflows

1. `buildMiniBoxFromTemplate(doc)` loads template zip.
2. `fixDividerSlideTitleFormatting()` patches slides 3 and 6 title XML.
3. `buildReplacements(doc)` maps document fields to slide/shape indices.
4. `replaceShapeText()` swaps `<a:t>` content per shape, preserving formatting XML.
5. GIF buffers fetched from Giphy URLs and written to media paths.
6. Zip regenerated and returned as Buffer.

## Edge Cases

- Divider slides had empty `lstStyle` causing `pptx-viewer` to render titles at body font size. Fixed by explicit 56pt Inter Tight run properties.
- Missing GIF URL → slot left unchanged from template.
- Empty text fields skipped in replacement loop.
- Welcome closing appended to contents shape on slide 2 when set.

## Tests

- **Location:** None.
- **Coverage:** Manual — preview all 7 slides, download and open in PowerPoint/Slides.

## Limitations

- Shape indices are hardcoded to current template; template changes require code updates.
- `pptxgenjs` is a dependency but not the primary export path.
- Text replacement does not support rich formatting within shapes (plain text lines only).
- No server-side storage of generated files.
