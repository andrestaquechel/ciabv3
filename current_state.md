# Current State

> Active work state. Update after every meaningful milestone and before handoff.

**Last updated:** 2026-07-16

## Current Objective

Fix the CIAB Slack builder hanging at the "Researching sources… building the stakeholder outline…" step, refresh the stale architecture docs, and stand up a local test harness. Repo synced with production `main`.

## Completed Work

- **CIAB hang fixed and deployed** (`76a894d`). The concept→outline step ran ~180–260s of work in a single post-response `after()` task and was killed silently. Split it into two chained 300s invocations (sources ~90s → dispatched outline ~127s), added an Anthropic request timeout + retry, and made all failures post back to the Slack thread.
- **Vitest test harness added.** `vitest.config.mts` + `vitest.setup.ts`, `npm test` / `test:watch` / `test:coverage`, seed tests for `claude-models` and the Slack signature verifier (19 tests passing).
- **architecture.md + current_state.md rewritten** to match the current codebase (Claude not OpenAI, full Slack/CIAB workflow, libSQL, KB, dual products).

## Work In Progress

- Broader unit-test coverage beyond the two seed suites.
- CIAB fix is deployed and awaiting a real end-to-end run in Slack to confirm the split resolves the hang in production.

## Files Changed

- `src/lib/anthropic.ts` — `anthropicFetch` with 240s timeout + one retry on transient 429/5xx.
- `src/lib/slack/ciab-job.ts` — added the `outline` job step.
- `src/lib/slack/ciab-handlers.ts` — split into `generateAndPostCiabSources` (chains an `outline` job) + `generateAndPostCiabOutlineFromSources`; added try/catch that posts errors; new `handleCiabOutline`.
- `src/app/api/webhooks/slack/ciab-research/route.ts` — handle the `outline` step; `after()` catch now posts failures to Slack.
- `vitest.config.mts`, `vitest.setup.ts`, `tsconfig.vitest.json`, `tsconfig.json` (exclude tests + `scripts/**`), `package.json` (test scripts + dev deps), `src/lib/__tests__/`, `src/lib/slack/__tests__/`.
- `architecture.md`, `current_state.md` — refreshed.

## Diagnosis Evidence

- Vercel runtime logs (deployment `dpl_Ekgcz…`): `/ciab-research` returned 202 then total silence — no completion, no error, no timeout entry — confirming the background task died mid-flight.
- The 60s timeout errors in Vercel's error tracker are from the *previous* deployment (`dpl_CtwEg…`), i.e. the pre-fix behavior that `28ef43b` addressed.
- Local harness (`scripts/ciab-local.mts flow`) measured: concepts 78s, sources 55s, outline 127s → sources+outline ≈ 182s in one `after()` callback.

## Test Status

| Command | Result |
|---------|--------|
| `npm test` (vitest) | 19 passed |
| `npx tsc -p tsconfig.json --noEmit` | clean |
| `npm run build` | succeeds (all routes compiled) |
| `npx eslint` (changed files) | clean (repo has pre-existing lint errors elsewhere; lint not in CI) |
| CIAB pipeline harness (`concepts`, `flow`) | runs end-to-end against live Claude |

## Known Bugs and Risks

- The outline job is ~127s — comfortably under the 300s wall but the longest single step; the timeout + Slack error-surfacing are the safety net if it or web search slows.
- `outline-approve` (full box: 3 parallel Claude calls + GIFs + deck/Doc upload) is also heavy and was not split this session; it already surfaces errors and benefits from the new fetch timeout, but watch it under load.
- Repo has pre-existing eslint errors (e.g. `ShellContext.tsx`, `PptPreview.tsx` set-state-in-effect). Not blocking (lint is not in CI).
- `scripts/ciab-local.mts` is committed as dev tooling; it is excluded from the build typecheck.

## Next Action

Run a real `/newbox ciab` end-to-end in Slack against the new deployment to confirm the outline step completes. Then continue expanding unit-test coverage.

## Commands to Continue

```bash
npm run dev                 # web builder
npm test                    # unit tests (watch: npm run test:watch)
npx tsx scripts/ciab-local.mts flow "<topic>"   # drive the CIAB pipeline locally
```

## Relevant Documents

- `architecture.md`
- `docs/features/*.md`, `docs/decisions/*.md`
- `AGENTS.md` (deploy/git conventions)
