# Implementation Plan - Itinerary UI Adjustments

**Feature ID:** itinerary-ui-adjustments  
**Date:** 2026-03-23  
**Refs:** [system-design.md](./system-design.md) · [feature-analysis.md](./feature-analysis.md)

## Slice Plan

| Slice | Goal | FE | BE | Gate |
|---|---|---|---|---|
| S0 | Lock UI contract | confirm icon-only back control + single Overnight edit trigger mapping | none | Tier 0 |
| S1 | Adjust detail/header affordance | replace block back control with icon action using existing callback | none | Tier 0 + Tier 1 |
| S2 | Unify Overnight edit entry | remove separate `Edit stay` button and map pencil icon to existing full-edit sheet | none | Tier 0 + Tier 1 |
| S3 | Regression confidence | update desktop component/E2E coverage for navigation and stay editing | none | Tier 3 |

## Execution Notes

- Keep all changes inside existing FE components; do not touch route handlers, persistence, or shared contracts.
- Treat `onBackToCards` and `onRequestEditStay(stayIndex)` as stable interfaces; only their presenting controls change.
- Preserve current stay-edit sheet contents, validation, save behavior, and post-save refresh semantics.
- Preserve current cards destination and query-param outcome when returning from detail.

## Verification Focus

- Back icon remains keyboard accessible and clearly labeled for assistive tech.
- Exactly one visible full-edit trigger exists per editable Overnight block in desktop detail mode.
- No separate `Edit stay` button or prior pencil-only inline behavior remains on this surface.
- Existing edit-stay flow still opens and saves through the same itinerary-scoped path.

## Rollout / Rollback

- Rollout can ship as a normal FE UI refinement with no migration.
- If regressions appear, revert the FE presentation changes only; API/state contracts remain intact.
