# Knowledge Base

**Status:** active
**Last updated:** 2026-07-10

## Purpose

Browse, index, and query archived Living Security content stored in Google Drive folders.

## Behavior

1. User configures a Drive archive folder per box type (Settings or inline on Knowledge page).
2. User browses folders/files via Drive picker (My Drive, Shared with me, Shared drives).
3. **Build archive index** recursively scans folder, exports text from supported file types, caches locally.
4. **Ask questions** sends cached index + question to OpenAI (or keyword mock) and returns an answer with source references.

Requires Google OAuth. Builder does not require auth.

## Modules

| Module | Path | Role |
|--------|------|------|
| Knowledge page | `src/app/knowledge/page.tsx` | Browse, index, Q&A UI |
| Drive picker | `src/components/knowledge/DriveFolderPicker.tsx` | Folder browser with breadcrumbs |
| Settings | `src/app/settings/page.tsx` | Google account, KB folder config |
| Drive client | `src/lib/google-drive.ts` | API calls: browse, index, text export |
| Folder config | `src/lib/knowledge-store.ts` | Per-type folder URLs (localStorage) |
| Index cache | `src/lib/knowledge-cache.ts` | Indexed document text (localStorage) |

## Data Model

- **Folder config:** `{ mini-box: { folderId, folderName, url }, ciab: { ... } }` in `box-studio:knowledge-folders`.
- **Index cache:** `{ folderId, builtAt, documents: [{ id, name, mimeType, text, path }] }` keyed by `box-studio:knowledge-index:{type}:{folderId}`.
- Max 250 indexable files per scan.

## Interfaces

- **GET `/api/drive/folders`** — Browse drives, folder info, previews (requires session).
- **GET `/api/drive/files`** — List folder contents (requires session).
- **GET `/api/knowledge/index`** — List folder for indexing.
- **POST `/api/knowledge/index`** — Build recursive index.
- **POST `/api/knowledge/ask`** — Q&A over client-supplied index payload.

Supported export types: Google Docs, Google Slides, PPTX (metadata), PDF.

## Workflows

1. Sign in with Google on Settings or Knowledge page.
2. Select archive folder via URL paste or Drive picker.
3. Click "Build archive index" → POST to index API → cache written to localStorage.
4. Type question → POST index + question to ask API → display answer.

## Edge Cases

- 401 on Drive routes without valid `session.accessToken`.
- Index rebuild overwrites prior cache for same folder.
- OpenAI unavailable → keyword-matching mock answer.
- Large folders truncated at 250 files.

## Tests

- **Location:** None.
- **Coverage:** Manual — OAuth flow, folder browse, index build, Q&A.

## Limitations

- Index is per-browser localStorage; not shared across devices or users.
- No incremental index updates; full rebuild required.
- Read-only Drive scope; cannot write back to Drive from KB.
- Q&A quality depends on text export fidelity per file type.
