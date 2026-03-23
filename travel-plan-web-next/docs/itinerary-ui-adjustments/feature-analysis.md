# Feature Analysis - Itinerary UI Adjustments

**Feature ID:** itinerary-ui-adjustments  
**Status:** Ready for FE implementation handoff  
**Date:** 2026-03-23  
**Project:** travel-plan-web-next

## User Problem

On the itinerary detail/table screen, two controls add unnecessary visual weight and duplicate intent: the return action back to itinerary cards is treated like a separate block/button instead of a lightweight navigation affordance, and the Overnight column exposes a standalone `Edit stay` button even though an edit icon is already a more natural entry point.

## Goal

Make these two actions feel lighter and more table-native without changing the underlying flows: returning to cards view should use a simple icon action, and full stay editing in the Overnight column should be triggered only from a pencil icon.

## Scope

### In Scope

- Desktop itinerary detail/table screen only.
- Replace the current separate/block-style `back to itinerary card view` treatment with a simple icon action.
- In the Overnight column, make the pencil icon the only trigger for the current `Edit stay` behavior.
- Remove the existing separate `Edit stay` button from the Overnight column.
- Remove any original pencil-icon behavior that is different from full `Edit stay`.

### Out of Scope

- Any backend, API, persistence, or native changes.
- New stay-edit capabilities, validation rules, or modal/sheet redesign.
- Any broader table layout cleanup beyond these two control changes.
- Mobile-specific behavior or responsive redesign.

## User-Visible Behavior

- The itinerary detail/table screen keeps a visible return affordance to itinerary cards, but it appears as a simple icon action instead of a separate emphasized block/button treatment.
- Activating that icon returns the user to the same itinerary cards view used today.
- In each Overnight cell, the pencil icon now launches the same full `Edit stay` flow that the separate `Edit stay` button launches today.
- The separate `Edit stay` button is no longer shown.
- No alternate or legacy pencil-icon behavior remains in the Overnight cell.

## Functional Requirements

- The screen must expose exactly one visible in-app return affordance to itinerary cards in the adjusted header/navigation area.
- That return affordance must be icon-based and must preserve the current return destination and behavior.
- If a stay currently supports `Edit stay`, its Overnight cell must expose that action through the pencil icon.
- The Overnight cell must not also render a separate `Edit stay` button for the same stay.
- The pencil icon must not continue to invoke any prior behavior that differs from full `Edit stay`.

## Acceptance Criteria

### AC-1: Back to Cards Uses a Simple Icon Action

Given an authenticated user is viewing the itinerary detail/table screen  
When the screen is rendered  
Then the UI shows a simple icon-based action for returning to itinerary cards  
And the UI does not show the previous separate/block-style `back to itinerary card view` control

### AC-2: Back Navigation Behavior Is Unchanged

Given the user is on the itinerary detail/table screen  
When they activate the back icon action  
Then they return to the itinerary cards view  
And the destination and navigation outcome match the current product behavior

### AC-3: Pencil Icon Becomes the Full Stay Edit Trigger

Given the user is viewing a stay row with an Overnight cell that currently supports `Edit stay`  
When they activate the pencil icon in that cell  
Then the app opens the same `Edit stay` flow used by the current separate `Edit stay` button

### AC-4: Separate Edit Stay Button Is Removed

Given the user is viewing the Overnight column for a stay that can be edited  
When the cell is rendered  
Then the separate `Edit stay` button is not shown  
And only the pencil icon remains as the stay-edit entry point in that cell

### AC-5: Legacy Pencil Behavior Is Removed

Given the user is viewing the Overnight column after this change  
When they use the pencil icon  
Then no prior or alternate pencil-icon behavior is triggered  
And the icon always maps to the current full `Edit stay` behavior

## Assumptions Resolved by Default

- `Back to itinerary card view` and `itinerary cards view` refer to the same existing cards screen; this brief uses the shorter cards terminology.
- `Simple icon action` means a lightweight in-app icon affordance, not a secondary labeled block/button treatment.
- This tweak applies only where the current separate back control and Overnight-column `Edit stay` button already exist on the desktop detail/table screen.

## Success Signals

- The table toolbar/header feels lighter because the return action is no longer visually over-emphasized.
- Stay editing in the Overnight column has one clear entry point instead of split icon/button behavior.
- FE and QA can verify the change from this screen alone without needing backend or cross-platform clarification.

## Handoff

Project coordinator should route this directly to FE for a small desktop-only UI cleanup and to QA for focused regression on cards navigation plus Overnight-column stay editing.
