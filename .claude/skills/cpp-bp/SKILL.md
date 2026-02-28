---
name: cpp-bp
description: C++ implementation best practices for safe, maintainable native code. Invoke when writing or refactoring C++ production code.
compatibility: opencode
metadata:
  role: native-developer
  source: .prompts/native-developer.md
---

## When to use me
Use this when implementing or refactoring C++ code and you want consistent guidance on correctness, maintainability, and performance.

## Core principles
- Correctness first: avoid undefined behavior, data races, and lifetime bugs; make invariants explicit.
- Ownership clarity: make ownership and lifetimes obvious in types and APIs; prefer RAII to manual cleanup.
- Simple, composable APIs: prefer small, orthogonal interfaces; keep cross-module boundaries narrow and stable.
- Deterministic behavior: avoid hidden global state, implicit initialization order dependencies, and timing-based logic.
- Measured performance: optimize after measuring; choose data structures and algorithms deliberately.

## Practical checklist
- Build and portability
  - Follow the repository’s standard toolchain, language standard, and warning policy; do not weaken warnings to “make it pass”.
  - Keep headers minimal; include what you use; avoid transitive include dependence.
  - Prefer forward declarations only when they reduce compile-time without hurting clarity.
- Ownership and lifetimes
  - Prefer values and references over raw owning pointers.
  - Use `std::unique_ptr` for exclusive ownership and `std::shared_ptr` only when shared ownership is required and justified.
  - Avoid returning references/pointers to temporaries or internal storage that can be invalidated.
  - Be explicit about nullability: use references when null is not allowed; use pointer or `std::optional` when it is.
- Error handling
  - Define a consistent error model for the module (exceptions vs. status/expected). Do not mix styles within a boundary.
  - Never ignore errors from system/library calls; propagate with context.
  - Keep error messages stable and actionable; do not leak secrets or raw internal state.
- Interfaces and const-correctness
  - Mark inputs as `const` and methods as `const` when they do not mutate observable state.
  - Prefer `string_view`/spans for non-owning views when lifetimes are safe; otherwise take owning types.
  - Avoid “boolean trap” APIs; prefer strong types/enums/options objects.
- Resource management
  - Use RAII wrappers for files, sockets, mutexes, and other handles; avoid manual `close`/`unlock`.
  - Prefer scoped locks (`std::lock_guard`, `std::unique_lock`) and avoid locking across callbacks.
- Concurrency
  - Establish clear ownership rules for shared state and document thread-safety guarantees in public APIs.
  - Prefer message passing or immutable data over fine-grained shared mutable state.
  - Avoid timing-based tests or sleeps for synchronization; use condition variables/latches where needed.
- Performance and memory
  - Avoid unnecessary allocations in hot paths; use move semantics deliberately.
  - Reserve capacity for growing containers when sizes are known.
  - Prefer `emplace` when it improves clarity and avoids extra moves/copies.
- Dependency hygiene
  - Keep module boundaries clean; do not add new third-party dependencies without an explicit design decision.
  - Avoid hidden singletons; if global state is required, centralize it and make initialization order explicit.
