# API Contracts (v1)

This document defines the cross-end contract for FE/BE parallel implementation.

Source of truth for machine validation: `blog-website/contracts/openapi.yaml`.

## Conventions
- Base path: `/v1`
- Content-Type: `application/json; charset=utf-8` for all JSON bodies.
- Time format: RFC 3339 timestamps (e.g., `2026-02-12T12:34:56Z`).
- IDs: UUID strings.

## Environment / Configuration Contract (Base URLs)

Repository invariant (from brief): implementation and test source code must not hard-code localhost origins (e.g., `127.0.0.1:3000`, `localhost:3000`). Service endpoints come from environment variables and/or framework/tool configuration.

Configuration surface (keys are stable; exact wiring is framework/tool-specific):

- Web app -> API routing
  - Web code calls relative paths only (e.g., `/v1/posts`).
  - Web runtime config provides an API origin for proxying/rewrites:
    - `API_ORIGIN` (local dev)
    - Deployed environments: platform/framework config (no in-code defaults)
- E2E runner
  - `E2E_BASE_URL` (required): the web app origin the browser navigates to
  - `E2E_API_ORIGIN` (required): the API origin used by test setup/health checks (if any)
- API process
  - `API_BIND` (optional): bind address/port for the API server
  - `DATABASE_URL` (required): must point to the correct DB environment (dev vs e2e)

Behavioral invariants:

- Same-origin is preferred (web proxies `/v1/*` to API) to keep cookie sessions working without credentialed CORS.
- OpenAPI `servers` are illustrative only; clients/tests must not derive runtime origins from `blog-website/contracts/openapi.yaml`.
- Dev and E2E database connections must never point at the same database (see HLD for isolation rules).

## Developer Experience Contract (Launch Commands)

In addition to API request/response contracts, the repo has a stable "launch contract" (DX surface) for local runtime.

- Canonical entrypoints live under `blog-website/scripts/`.
- The stable command names and invariants are defined in `blog-website/docs/hld.md`.
- QA-facing one-shot commands for local stack bring-up are defined in `blog-website/docs/runbook-one-command.md`.

## Authentication & Session

### Mechanism
- Cookie session: API sets `Set-Cookie: bw_session=<opaque>; HttpOnly; SameSite=Lax; Path=/; Secure` (Secure in prod).
- API also returns a CSRF token for the current session.

### CSRF expectations
- For any state-changing endpoint (`POST`, `PATCH`, `DELETE`), the client must send `X-CSRF-Token: <token>`.
- The CSRF token is obtained via `GET /v1/auth/session`.

### Auth-required endpoints
- Any endpoint marked as `Auth: required` returns `401` when no valid session exists.
- Any endpoint that checks ownership returns `403` when authenticated but not allowed.

## Error Model

### Error payload (all non-2xx responses)
```json
{
  "error": {
    "code": "validation_error",
    "message": "Title is required",
    "details": {
      "fieldErrors": {
        "title": ["required"]
      }
    },
    "requestId": "req_01HT..."
  }
}
```

### Standard `error.code` values
- `validation_error` (400)
- `unauthenticated` (401)
- `invalid_credentials` (401)
- `forbidden` (403)
- `not_found` (404)
- `conflict` (409)
- `rate_limited` (429)
- `internal` (500)

### Field validation conventions
- `details.fieldErrors` is a map: `field -> list of string tags`.
- Tags are stable identifiers such as `required`, `too_short`, `too_long`, `invalid_format`.

## Data Types (schemas)

### User
```json
{
  "id": "uuid",
  "username": "string",
  "createdAt": "2026-02-12T12:34:56Z"
}
```

### PostSummary
```json
{
  "id": "uuid",
  "title": "string",
  "author": { "id": "uuid", "username": "string" },
  "createdAt": "2026-02-12T12:34:56Z",
  "updatedAt": "2026-02-12T12:34:56Z"
}
```

### PostDetail
```json
{
  "id": "uuid",
  "title": "string",
  "body": "string",
  "author": { "id": "uuid", "username": "string" },
  "createdAt": "2026-02-12T12:34:56Z",
  "updatedAt": "2026-02-12T12:34:56Z"
}
```

## Endpoints

### Auth

#### POST `/v1/auth/register`
- Auth: not required
- Body:
```json
{ "username": "string", "password": "string" }
```
- Success: `201 Created`
  - Sets session cookie
  - Body:
```json
{ "user": { "id": "uuid", "username": "string", "createdAt": "..." } }
```
- Errors:
  - `400 validation_error`
  - `409 conflict` (username already taken)

#### POST `/v1/auth/login`
- Auth: not required
- Body:
```json
{ "username": "string", "password": "string" }
```
- Success: `200 OK`
  - Sets session cookie
  - Body: `{ "user": <User> }`
- Errors:
  - `400 validation_error`
  - `401 invalid_credentials`
  - `429 rate_limited`

#### POST `/v1/auth/logout`
- Auth: required
- Headers: `X-CSRF-Token`
- Success: `204 No Content`
  - Clears session cookie
- Errors:
  - `401 unauthenticated`
  - `403 forbidden` (missing/invalid CSRF)

#### GET `/v1/auth/session`
- Auth: optional
- Success: `200 OK`
```json
{
  "authenticated": true,
  "user": { "id": "uuid", "username": "string", "createdAt": "..." },
  "csrfToken": "string"
}
```
If not authenticated:
```json
{ "authenticated": false }
```

### Users

#### GET `/v1/users/me`
- Auth: required
- Success: `200 OK`
```json
{ "user": { "id": "uuid", "username": "string", "createdAt": "..." } }
```
- Errors: `401 unauthenticated`

### Posts (Public Read)

#### GET `/v1/posts`
- Auth: not required
- Query params:
  - `limit` (optional, integer 1..50, default 20)
  - `cursor` (optional, opaque string)
- Success: `200 OK`
```json
{
  "items": [<PostSummary>],
  "nextCursor": "opaque-or-null"
}
```

#### GET `/v1/posts/{postId}`
- Auth: not required
- Success: `200 OK`
```json
{ "post": <PostDetail> }
```
- Errors: `404 not_found`

### Posts (Authenticated CRUD)

#### POST `/v1/posts`
- Auth: required
- Headers: `X-CSRF-Token`
- Body:
```json
{ "title": "string", "body": "string" }
```
- Success: `201 Created`
```json
{ "post": <PostDetail> }
```
- Errors:
  - `400 validation_error`
  - `401 unauthenticated`
  - `403 forbidden` (missing/invalid CSRF)

#### PATCH `/v1/posts/{postId}`
- Auth: required (must be owner)
- Headers: `X-CSRF-Token`
- Body (partial update; at least one field required):
```json
{ "title": "string?", "body": "string?" }
```
- Success: `200 OK`
```json
{ "post": <PostDetail> }
```
- Errors:
  - `400 validation_error`
  - `401 unauthenticated`
  - `403 forbidden` (not owner OR missing/invalid CSRF)
  - `404 not_found`

#### DELETE `/v1/posts/{postId}`
- Auth: required (must be owner)
- Headers: `X-CSRF-Token`
- Success: `204 No Content`
- Errors:
  - `401 unauthenticated`
  - `403 forbidden` (not owner OR missing/invalid CSRF)
  - `404 not_found`

## Contract Testing Notes
- Backend should have integration tests that assert:
  - unauthenticated requests get `401`.
  - non-owner mutation attempts get `403`.
  - validation failures return `400` with `details.fieldErrors`.
  - pagination returns stable `nextCursor` behavior.
- Frontend should have mocked-contract tests (MSW) that validate UI behavior for each status code.

## Test Coverage Review (No New Tooling)
The current milestone requires reviewing existing unit, integration, and E2E tests to ensure the following journeys are covered, and adding missing cases using existing frameworks only:

- Register
- Login
- Logout
- View posts (list + detail)
- Create post
- Edit post
- Delete post

Contract alignment rules:

- New test cases must use the existing contract and error model in this document.
- No new coverage tooling or reporters should be introduced solely for coverage reporting.
