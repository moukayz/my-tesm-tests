# Implementation Plan

## Contract-First Workflow
1. Update `packages/contracts/openapi.yaml`.
2. Regenerate types into `packages/contracts/generated/`.
3. Implement API and UI against generated types.

## Vertical Slices

### Slice E2E: Test Stability (2026-02)
- Contracts: codify streaming terminal event invariants and E2E model fixture expectations (see `docs/testing/e2e-test-stability-2026-02.md`).
- BE: Ensure every SSE stream ends with exactly one terminal event (`done` or `error`) and then closes; mocks must emit `done` on success.
- FE: Ensure UI transitions assistant message `data-status` to `complete` on `done`, and to `error` on `event: error`; add EOF fallback to avoid stuck `streaming` if the stream closes cleanly without `done`.
- Test data: Align `apps/e2e/fixtures/models.e2e.json` to contain at least 2 models matching Playwright expectations.

### Slice 0: Env/Config Consolidation
- FE/BE: Inventory all env keys in use and map to a minimal shared set.
- FE/BE: Define and document file locations and precedence order.
- BE: Add startup validation for required keys and clear config/env errors.
- FE/BE: Update dev/e2e scripts to load env in the documented order.
- Tests: Tier 1 config loader tests (missing keys, conflicts, override precedence).

### Slice 1: Stateless Streaming Contract + API
- BE: Update contract to remove sessions/chats and add `POST /chat/completions:stream`.
- BE: Implement stateless streaming endpoint that accepts full message context.
- FE: Update SSE client to send full branch context per request.
- Tests: Tier 0 (lint/typecheck), Tier 1 streaming parser tests, Tier 2 streaming API tests (mock OpenAI).

### Slice 2: Model Catalog
- BE: Config loader, model list endpoint `GET /models`.
- FE: Model selector wired to API.
- Tests: Config parser unit tests, API contract tests.

### Slice 3: Local History Storage
- FE: Sidebar with local chat list, chat creation, history display.
- FE: Persist chats/branches/messages in browser storage (IndexedDB/localStorage).
- Tests: Tier 1 storage adapter tests, Tier 2 integration for list/detail rendering.

### Slice 4: Streaming Responses UI
- BE: OpenAI SDK integration with env `base_url` and `api_key`.
- FE: Streaming renderer with thinking section and final answer split.
- Tests: Tier 1 streaming parser tests, Tier 2 streaming UI integration with mocked API.

### Slice 5: Edit and Resubmit (Branching)
- FE: Branch creation in local store, edit UI, branch selection and navigation.
- Tests: Branching unit tests, E2E edit/resubmit flow.

## Test Gates
- Before finishing each slice: Tier 0 + Tier 1 pass.
- Before integrating slices: Tier 2 pass.
- Before release: Tier 3 E2E critical paths.

## Open Questions and Defaults
- Model selection scope: default per conversation; allow per-message override.
- Local history storage: prefer IndexedDB with localStorage fallback.
- Model config format: YAML at `config/models.yaml`.
- Client-side retention: default 30 days of inactivity before local cleanup.

## Migration Risks and Mitigations
- Dev/e2e scripts diverge on precedence order; consolidate a single env loader and reuse it.
- Hidden duplicate keys mask overrides; fail fast with `CONFIG_CONFLICT` and list `conflict_keys`.
- Missing `OPENAI_API_KEY` or endpoint URLs cause runtime failures; validate at startup and surface `ENV_MISSING`.
- Port auto-selection changes can break dependent services; standardize how the selected port is exported to other scripts.
