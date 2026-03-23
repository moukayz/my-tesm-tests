# Feature Analysis - Remove MotherDuck Content

**Feature ID:** remove-motherduck-content  
**Status:** Ready for implementation handoff  
**Date:** 2026-03-23  
**Project:** travel-plan-web-next

## Problem

The project no longer uses MotherDuck, but repo-facing documentation and configuration comments still describe it as an active or optional path. That creates false setup paths, outdated troubleshooting guidance, and unnecessary caution in test/runtime notes.

## Goal

Remove obsolete MotherDuck-specific content from the tracked project materials without changing unrelated database/provider behavior or broadening the work into a larger storage migration.

## User Impact

- **User-visible:** No end-user product behavior should change in the app UI.
- **Developer-visible:** Setup, runbook, architecture, and test guidance should stop mentioning MotherDuck as a supported option.
- **Operational:** Developers should be able to read current docs/config comments without inferring a MotherDuck dependency, warmup requirement, or special cloud mode.

## In Scope

- Remove MotherDuck-specific wording from active developer-facing docs and repo guidance.
- Update tracked files that currently present MotherDuck as a supported mode, dependency, risk, or setup path.
- Remove or rewrite Playwright config comments that describe MotherDuck-only warmup, timeout, worker, or serial-test rationale.
- Clean README sections that document MotherDuck env vars, MotherDuck setup instructions, or API descriptions that say queries run via MotherDuck.
- Clean current runbook/architecture docs where MotherDuck is listed as part of the active system.

## Likely Files/Categories To Update

- `travel-plan-web-next/README.md`
- `travel-plan-web-next/playwright.config.ts`
- `travel-plan-web-next/docs/frontend-runbook.md`
- `travel-plan-web-next/docs/high-level-design.md`

## Out of Scope

- Replacing DuckDB, Neon, PostgreSQL, Redis, or any other provider with a different technology.
- Renaming generic scripts/modes solely because they are "cloud" or "local" unless the text explicitly claims MotherDuck support.
- Refactoring runtime logic beyond what is necessary to remove MotherDuck-specific comments, docs, or clearly obsolete config branches.
- Editing local-only, untracked machine files such as a developer's personal `.env.local`.
- Editing third-party files such as `node_modules/**`.
- Editing historical evidence docs (for example old QA reports) unless they are still positioned as current setup/run instructions.
- Removing identifiers or strings that merely resemble `motherduck` text but are unrelated to this obsolete integration.

## Functional Requirements

- Active project documentation must not describe MotherDuck as a supported development, test, or production dependency.
- Repo guidance must not instruct developers to create or use `MOTHERDUCK_*` configuration for normal project workflows.
- Architecture/runbook content must describe the current supported data-source model only.
- Playwright guidance/comments must no longer justify behavior in terms of MotherDuck cold starts if MotherDuck is no longer supported.
- Any retained logic that still references MotherDuck must be explicitly justified as temporary implementation debt; otherwise it should be removed during implementation.

## Acceptance Criteria

### AC-1: README No Longer Advertises MotherDuck

Given a developer reads `travel-plan-web-next/README.md`  
When they review environment setup, dev/test commands, and API descriptions  
Then they do not see MotherDuck presented as an optional or supported mode  
And they are not instructed to set `MOTHERDUCK_*` variables for standard workflows

### AC-2: Runbook Reflects Current Frontend Workflow

Given a developer reads `travel-plan-web-next/docs/frontend-runbook.md`  
When they follow frontend startup guidance  
Then the runbook describes only currently supported data-source combinations  
And it does not mention MotherDuck as part of cloud development

### AC-3: High-Level Design Reflects Current Architecture

Given a developer reads `travel-plan-web-next/docs/high-level-design.md`  
When they review the stack, deployment modes, and known risks  
Then MotherDuck is not described as part of the current architecture  
And any risk/register entry that exists only because of MotherDuck is removed or rewritten

### AC-4: Test Config Commentary Matches Supported Reality

Given a developer reads `travel-plan-web-next/playwright.config.ts`  
When they review readiness, timeout, and parallelism comments  
Then the comments do not reference MotherDuck cold starts or MotherDuck-specific testing constraints  
And the remaining comments explain only currently supported behavior

### AC-5: Cleanup Does Not Expand Into Unrelated Provider Changes

Given the implementation is complete  
When a reviewer compares the diff to this feature scope  
Then the changes are limited to removing obsolete MotherDuck-specific content and any directly dependent config wording/branches  
And the diff does not introduce unrelated database/provider migrations or broad command renames

### AC-6: Reasonable Exclusions Are Preserved

Given the repo still contains unrelated or historical text matches  
When those matches are reviewed  
Then third-party files, local-only files, and historical records not used as current guidance may remain unchanged  
And any retained match has a clear reason for exclusion from this cleanup

## Risks And Assumptions

- Assumption: MotherDuck is fully deprecated for this project and no active workflow still depends on `MOTHERDUCK_*` variables.
- Risk: some config branches may still reference MotherDuck behavior indirectly; implementation should remove them only when they are truly obsolete, not when they protect a still-supported non-MotherDuck scenario.
- Risk: older QA/design docs may contain historical command examples; editing all legacy records could create unnecessary scope creep.

## Done Signal

- A developer can review the main repo-facing docs and Playwright config comments without seeing MotherDuck described as a supported setup path.
- A reviewer can verify that the cleanup is documentation/config focused and does not change unrelated provider strategy.
- Remaining `MotherDuck`/`motherduck` matches, if any, are limited to excluded areas or intentionally retained temporary implementation debt.

## Handoff

Project coordinator should route this as a small cleanup task. The implementation owner should remove obsolete MotherDuck references from active docs/config first, then confirm any remaining matches are intentionally excluded by this brief.
