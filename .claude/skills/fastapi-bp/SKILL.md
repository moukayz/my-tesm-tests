---
name: fastapi-bp
description: Build robust FastAPI services with typed models, dependency injection, consistent errors, and testable HTTP boundaries.
compatibility: opencode
metadata:
  stack: fastapi
---

## When to use me
Use this when you are building or evolving a FastAPI-based HTTP service.

## Core principles
- Keep transport thin: HTTP endpoints orchestrate; domain/service code owns business rules.
- Treat models as contracts: validate inputs, control outputs, and version changes deliberately.
- Prefer explicit dependency injection for auth, persistence, and configuration.
- Consistent errors, observability, and security are baseline requirements.

## Practical checklist
- API modeling
  - Use typed request/response models for all endpoints.
  - Prefer explicit response models and status codes; avoid returning raw dicts.
  - Handle backward-compatible evolution with additive changes and explicit deprecation paths.
- Dependencies and boundaries
  - Use dependencies for authN/authZ, database sessions, config, and rate limiting.
  - Keep side effects (DB, network) out of model validators; validate pure data in validators.
  - Keep business rules in services; keep routers focused on composition and mapping.
- Errors and security
  - Standardize error shape (code, message, details) and map domain errors via exception handlers.
  - Avoid leaking stack traces or internal messages to clients.
  - Never log secrets/PII; apply redaction rules to logs and traces.
  - Validate and constrain uploads, query sizes, and payload limits per threat model.
- Async and concurrency
  - Be explicit about async vs sync: do not block the event loop with CPU-heavy or blocking I/O.
  - Use timeouts for upstream calls; define safe retry behavior where appropriate.
- Testing
  - Use HTTP-level tests to validate routing, auth, and serialization.
  - Unit test domain logic separately from the web layer.
  - Test success and failure paths: validation, auth, conflicts, not found, and timeouts.
