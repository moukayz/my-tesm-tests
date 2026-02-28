---
name: gtest-gmock-bp
description: Best practices for GoogleTest/GoogleMock suites (fast, deterministic, maintainable). Invoke when writing or refactoring gtest/gmock tests.
compatibility: opencode
metadata:
  role: native-developer
  source: .prompts/native-developer.md
---

## When to use me
Use this when adding, refactoring, or reviewing C++ unit/integration tests written with GoogleTest and/or GoogleMock.

## Core principles
- Tests are products: keep them readable, deterministic, and cheap to run.
- Assert behavior, not internals: prefer observable outcomes over implementation details.
- Minimize mocking: mock boundaries (I/O, clocks, network), not pure logic.
- Deterministic time and concurrency: avoid sleeps; use controllable clocks and explicit synchronization.
- Fail with signal: ensure failures are actionable and isolate the minimal cause.

## Practical checklist
- Test structure and naming
  - Use `TEST(SuiteName, BehaviorName)` names that describe behavior and conditions.
  - Prefer one conceptual behavior per test; avoid multi-page “mega tests”.
  - Use fixtures (`TEST_F`) when setup is non-trivial and shared; keep fixtures small and focused.
- Assertions
  - Use `ASSERT_*` when continuing is unsafe (e.g., preconditions for later steps), otherwise `EXPECT_*`.
  - Prefer matcher-based assertions (`EXPECT_THAT`) for complex structures to improve failure messages.
  - Avoid floating-point equality; use `EXPECT_NEAR` or appropriate matchers.
- Parameterization
  - Use parameterized tests (`TEST_P`) for the same behavior across multiple cases; keep input sets small and representative.
  - Keep parameters self-describing (custom struct + `PrintToStringParamName` when needed).
- GoogleMock usage
  - Mock only what you own at a boundary; prefer fakes/stubs for simple collaborators.
  - Use `StrictMock` to catch accidental calls when interactions are the contract; use `NiceMock` sparingly.
  - Prefer expectations that reflect the real contract: minimal necessary `EXPECT_CALL`s with clear matchers and call counts.
  - Avoid over-specifying call order unless order is part of the contract; use `InSequence` only when needed.
  - Reset expectations/state between tests; avoid shared mocks across tests unless fully isolated by the fixture.
- Determinism and isolation
  - Do not rely on the current time, randomness, environment variables, filesystem layout, or network.
  - Use temporary directories and unique filenames for filesystem tests; clean up via RAII.
  - Avoid global mutable state; if unavoidable, provide a scoped guard that resets it in `TearDown`.
- Concurrency and async
  - Avoid sleeps as synchronization; use latches/condition variables/promises/futures.
  - Keep timeouts short and explicit when waiting is unavoidable; fail with context on timeout.
- Speed and maintainability
  - Keep unit tests fast; push expensive integration tests behind clear targets/suites.
  - Prefer hermetic tests with in-memory fakes over real system dependencies.
  - Make failures readable: include key inputs/ids in assertions, not verbose logs.
