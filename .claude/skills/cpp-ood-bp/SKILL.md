---
name: cpp-ood-bp
description: Object-oriented modeling/design best practices in C++. Invoke when designing a C++ module’s class model, public APIs, and extensibility points.
compatibility: opencode
metadata:
  role: native-tech-lead
  source: .prompts/native-tech-lead.md
---

## When to use me
Use this when producing a C++ object model (classes, interfaces, value types) for a module and you need guidance on responsibilities, collaboration, and extensibility without over-engineering.

## Core principles
- Model the domain, not the technology: start from behaviors and invariants, then choose types.
- Composition over inheritance: prefer assembling objects with small interfaces to deep hierarchies.
- Stable abstractions: introduce interfaces only at seams (I/O, clock, OS) or when multiple implementations are truly required.
- Maintain invariants: keep objects valid after construction; avoid half-initialized states.
- Make ownership and thread-safety visible: reflect lifetime and concurrency constraints in the API.

## Modeling guidelines
- Identify responsibilities
  - Use SRP: one reason to change per type.
  - Prefer small objects with clear verbs; avoid “manager/god” classes that own everything.
- Choose the right kind of type
  - Value types: immutable or locally mutable, cheap to reason about, equality and copy/move well-defined.
  - Entities: identity + lifecycle + state transitions; encode transitions explicitly.
  - Services: stateless or narrowly stateful orchestrators; keep policies and pure logic testable.
- Keep invariants explicit
  - Validate at boundaries; keep constructors/factories enforcing invariants.
  - Use strong types/enums instead of primitive strings/ints for key concepts.
- API surface and coupling
  - Keep public headers minimal; hide implementation behind source files.
  - Avoid exposing STL containers as stable ABI boundaries unless the repo policy allows it.
  - Prefer narrow interfaces to avoid “include cascades”; depend on abstractions, not concretions.
- Extension points
  - Avoid premature virtual; when needed, prefer pure abstract interfaces with a small method set.
  - Document ownership of returned pointers/references; prefer returning values or smart pointers when ownership transfers.
  - Consider PIMPL when build times or ABI stability require it and the repo supports it.

## Patterns that work well in C++
- Factories for complex construction with invariants.
- Strategy/Policy for behavior variation with clear contracts.
- Adapter for third-party/OS boundaries to keep the core pure.
- RAII guards for scoped resource/state changes.

## Anti-patterns to avoid
- Deep inheritance trees and “base class frameworks” without strong justification.
- Interface explosion: many 1–2 method interfaces that increase indirection without reducing coupling.
- Global singletons and hidden state; implicit initialization order dependencies.
- APIs that hide ownership, nullability, or thread-safety constraints.

## Design deliverables
- A class responsibility table (type → responsibility → key collaborators).
- A sequence diagram for each major flow (happy path + one failure path).
- A stated policy for: ownership/lifetimes, error model, thread-safety, and extension mechanism.
