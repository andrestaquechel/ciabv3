# Client localStorage for Document Persistence

**Date:** 2026-07-10
**Status:** accepted

## Context

Box Studio needs to store Mini Box documents, UI preferences, and knowledge index caches. The app has no backend database and targets a lightweight authoring workflow used by a small team.

## Decision

Store all user content and configuration in browser `localStorage` via dedicated store modules (`box-store.ts`, `knowledge-store.ts`, `knowledge-cache.ts`). No server-side persistence for box documents.

## Alternatives Considered

| Alternative | Why rejected |
|-------------|--------------|
| Server database (Postgres, etc.) | Adds infra complexity; no multi-user editing requirement yet |
| Google Drive as primary store | Would require write scopes and complicate offline builder use |
| File-based export only (no save) | Poor UX; users expect drafts to persist across sessions |

## Consequences

**Positive:**
- Builder works without auth or network (except preview/AI).
- Zero database cost and ops overhead.
- Simple deployment — stateless server.

**Negative:**
- No cross-device sync or backup.
- Data lost if localStorage is cleared.
- No collaborative editing or audit trail.
