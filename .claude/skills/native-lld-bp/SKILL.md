---
name: native-lld-bp
description: Produce native (C++) low-level design with clear module boundaries, OO model, lifecycle/ownership rules, concurrency model, and test strategy. Invoke when writing a native LLD.
compatibility: opencode
metadata:
  role: native-tech-lead
  source: .prompts/native-tech-lead.md
---

## When to use me
Use this when you need an implementable native low-level design (LLD) for a C++ module before production code starts.

## Design principles
- Implementable abstraction: keep abstractions minimal and anchored to concrete responsibilities and seams for testing.
- Stable boundaries: narrow, explicit module APIs; dependencies point inward; avoid cyclic dependencies.
- Explicit semantics: document ownership, thread-safety, error model, and performance/latency expectations.
- Deterministic behavior: define startup/shutdown, cancellation, and failure semantics; avoid hidden global state.
- Testability by design: make seams for fakes/mocks; keep core logic independent of I/O and time.

## What a good native LLD contains
- **Overview**
  - Scope, non-goals, assumptions, risks, open questions
  - Compatibility constraints (platforms, compiler standard, ABI constraints if relevant)
- **Module boundaries**
  - Target layout at a conceptual level (libraries/binaries) and dependency direction
  - Public API surface (headers, namespaces) and what is intentionally private
  - Cross-module contracts: schemas/IDs/error codes shared across boundaries
- **Object-oriented model**
  - Key abstractions and responsibilities (classes/interfaces/value types)
  - Collaboration diagrams and sequence diagrams for major flows
  - Where to use inheritance vs composition; rules for extension
- **Lifecycle & ownership**
  - Ownership rules for pointers/references, nullability assumptions, and lifetime diagrams for key flows
  - Resource management expectations (RAII), shutdown ordering, and cleanup semantics
- **Concurrency model**
  - Threading assumptions and thread-affinity rules
  - Synchronization strategy, lock ordering rules, and how to avoid deadlocks
  - Cancellation semantics and timeouts (what happens on stop/abort)
- **Error model**
  - Exception vs status-return policy (align to repo/module conventions)
  - Error taxonomy and mapping rules across boundaries (I/O, validation, business errors)
  - Observability requirements (what to log/measure; what must be redacted)
- **Performance & memory**
  - Latency and throughput goals (where applicable), memory constraints, hot paths
  - Complexity expectations for key operations and how to measure them
- **Test strategy**
  - Tiered plan: lint/format/warnings → unit tests (invariants, behavior) → integration tests (threads/I/O/boundaries)
  - Where gtest/gmock applies, what to fake vs mock, and what must be integration-tested
  - Non-determinism controls (time, randomness, threading)

## Output expectations
- Write the design as a single, implementable Markdown document: `docs/<native-module>-design.md`.
- Include at least one diagram if it materially reduces ambiguity (Mermaid).
