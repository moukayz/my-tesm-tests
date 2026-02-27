---
name: fastify-bp
description: Build reliable Fastify services with plugin boundaries, schema validation, structured logs, and testable HTTP contracts.
compatibility: opencode
metadata:
  stack: fastify
---

## When to use me
Use this when you are building or evolving a Fastify-based HTTP service.

## Core principles
- Keep a strict boundary between transport (HTTP) and domain logic.
- Validate at the edge with schemas; never trust request data.
- Prefer explicit, consistent error responses and status codes.
- Make observability and reliability defaults: structured logs, request IDs, timeouts, and safe retries.

## Practical checklist
- Architecture
  - Use plugins to enforce boundaries (routes, auth, persistence, feature modules).
  - Keep route handlers thin: parse/validate → authZ/policy → call domain/service → map result/errors.
  - Centralize cross-cutting concerns with hooks (request IDs, auth, rate limiting, tracing).
- Schemas and validation
  - Define request/response schemas for every endpoint.
  - Reject unknown/invalid input early and return a consistent validation error format.
  - Ensure response serialization matches the declared schema.
- Errors and security
  - Use a centralized error handler to map domain errors to HTTP errors consistently.
  - Avoid leaking internal messages; include stable error codes and safe human messages.
  - Never log secrets/PII; apply redaction rules to logs.
  - Apply rate limiting and input size limits appropriate to threat model.
- Performance and reliability
  - Set explicit timeouts for upstream calls and long operations.
  - Use connection pooling for databases and external services.
  - Ensure graceful shutdown and health/readiness endpoints.
- Testing
  - Use Fastify’s injection pattern for HTTP-level integration tests.
  - Unit test domain rules separately from HTTP concerns.
  - Test success and failure paths: validation, auth, conflicts, not found, and timeouts.
