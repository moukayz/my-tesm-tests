# TDD Workflow for travel-plan-web-next

This project strictly follows test-driven development (TDD). Always write tests before implementation.

## Core Rules

1. **Write tests first** — Before writing any feature code, write a failing test that describes the desired behavior
2. **Make it fail** — Verify the test fails before implementing
3. **Implement** — Write the minimal code to make the test pass
4. **Refactor** — Improve code quality while keeping tests green
5. **No untested code** — Every feature must have corresponding tests

## Testing Tools

- **Unit/Component tests**: Jest (`__tests__/components/`, `jest.config.ts`)
- **E2E tests**: Playwright (`__tests__/e2e/`, `playwright.config.ts`)
- **Run tests**: `npm test` (Jest), `npm run test:e2e` (Playwright)

## Workflow

1. Create test file in `__tests__/` matching the component/feature structure
2. Write test case(s) describing the expected behavior
3. Run tests — should fail
4. Implement the feature in `components/` or `app/` to make tests pass
5. Refactor both code and tests if needed
6. Commit with test coverage verified

## Coverage

Maintain high test coverage. Run `npm test -- --coverage` before committing.

## No Exceptions

Apply TDD to all code changes—bugfixes, refactoring, new features, API endpoints.

## Bugfix Test Backfill Rule

After fixing any bug, explicitly check whether the issue exposed missing coverage in unit, integration, or E2E tests. If coverage is missing, add the corresponding test(s) so the same bug is caught automatically in the future.

## After Editing Implementation Code

After editing any implementation file, run **all** test layers and confirm they pass before considering the task done:

1. `npm test` — unit + integration + component tests (Jest)
2. `npm run test:e2e` — end-to-end tests (Playwright)

Do not mark a change complete if any test in any layer is failing.

## Before Planning or Editing

Always read [README.md](./README.md) first to get essential project information (tech stack, structure, architecture, API reference) before doing any planning or editing in this project.

## After Editing

After completing any change, update `README.md` if the change affects features, tech stack, project structure, architecture, API routes, or test counts. Keep the README accurate and in sync with the codebase.
