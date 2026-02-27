---
name: product-brief-bp
description: Write a user-centric feature brief with clear scope, flows, acceptance criteria, metrics, and tracked open questions.
compatibility: opencode
metadata:
  role: product-manager
  source: .prompts/product-manager.md
---

## When to use me
Use this when you need requirements clarity and a single brief that enables tech leads to produce designs and contracts without guessing.

## Principles
- Keep flows user-centric and outcome-driven.
- Make scope explicit: in-scope, out-of-scope, and what “done” means.
- Acceptance criteria must be unambiguous and testable; avoid vague language.
- Track open questions, assumptions, risks, and unknowns explicitly.
- Do not make architectural, contract, or implementation decisions; delegate those to the appropriate technical roles.

## What a good feature brief contains
- **Context**
  - Problem statement, target users, and desired outcomes
  - Background, constraints (deadline, compliance, platforms), and dependencies
- **Scope**
  - In-scope and out-of-scope
  - Non-goals and explicitly deferred ideas
- **User journeys**
  - Primary flows and key edge cases (add a diagram if it improves clarity)
- **Requirements**
  - Functional requirements phrased as behaviors, not solutions
  - Non-functional requirements (performance, reliability, privacy, accessibility as applicable)
- **Acceptance criteria**
  - Given/When/Then scenarios that are directly verifiable by tests or manual QA
  - Clear definitions for error handling, empty states, and permission/auth cases when relevant
- **Success metrics**
  - Product metrics (activation, retention, conversion, satisfaction)
  - Technical metrics (latency, error rate, availability, cost)
- **Execution notes**
  - A minimal role-based task breakdown (only the roles required for the scope)
