# Feature Analysis - Itinerary Train Schedule Editor

**Feature ID:** itinerary-train-schedule-editor  
**Status:** Ready for FE design/implementation handoff  
**Date:** 2026-03-19  
**Project:** travel-plan-web-next

## User Problem

Authenticated travellers currently edit a day's train schedule by modifying raw `TrainRoute[]` JSON in the Itinerary tab. This is technical, easy to break, and slow for simple changes like adding a train, fixing a train ID, or updating stations.

## Goal

Replace raw-JSON editing with a structured, user-friendly train schedule editor in the existing Itinerary tab flow, while preserving the current saved data shape and `POST /api/train-update` persistence path.

## Target User Flow

1. User opens the existing train edit affordance for a day in the Itinerary tab.
2. User sees that day's train entries as editable rows instead of raw JSON.
3. User can add, edit, remove, and reorder train entries.
4. User saves once for the whole day.
5. The updated train list persists, the modal/editor closes, and the day refreshes using the existing timetable refresh behavior.

## In Scope

- Replace the raw JSON textarea editor with a structured day-level editor for train entries.
- Support editing the current common fields: `train_id` required, `start` optional, `end` optional.
- Support zero, one, or multiple train entries on a day.
- Support add, remove, and reorder within the day so the displayed train list matches user intent.
- Keep the current save entry point, auth behavior, and API route.
- Keep current post-save behavior where timetable-derived display refreshes from saved data.
- Provide inline validation and actionable error messaging before save.

## Out of Scope

- Any backend contract or storage redesign.
- Editing unrelated itinerary fields or behaviors.
- Automatic train lookup, autocomplete, or timetable search redesign.
- Bulk edit across multiple days.
- Support for arbitrary custom JSON fields beyond the current common train entry shape.

## Edge Cases

- Day has no trains: editor opens in an empty state with a clear add action.
- User removes all rows: saving an empty array is allowed.
- `train_id` is blank on any row: save is blocked with row-level validation.
- Only one of `start` / `end` is filled: save is blocked; station pair must be both filled or both empty.
- Saved train cannot resolve timetable data: save still succeeds; unresolved timetable remains shown the same way it works today.
- API failure or network failure: editor stays open, unsaved input remains, and the user sees an error.
- Legacy malformed train data encountered in the editor: show a recoverable error state rather than silently overwriting it.

## Acceptance Criteria

### AC-1: Structured Editor Opens

Given an authenticated user is viewing the Itinerary tab  
When they activate the train edit affordance for a day  
Then they see a structured train editor for that day instead of raw JSON text

### AC-2: Edit Existing Entries

Given a day already has one or more train entries  
When the user edits train fields and saves valid changes  
Then the updated train list is persisted and shown after the editor closes

### AC-3: Add and Remove Entries

Given a day in the editor  
When the user adds a new train row or removes an existing row and saves  
Then the saved train array matches the edited rows exactly

### AC-4: Reorder Entries

Given a day has multiple train rows  
When the user changes their order and saves  
Then the saved and displayed train list reflects the new order

### AC-5: Validation Before Save

Given the editor contains a row with a blank `train_id` or only one station endpoint filled  
When the user attempts to save  
Then save is prevented and the invalid row shows clear guidance

### AC-6: Empty State Supported

Given a day has no train entries  
When the user opens the editor  
Then they can add a train entry and save successfully  
And they can also leave the day with no train entries

### AC-7: Existing Persistence Path Preserved

Given the user saves valid changes  
When persistence succeeds  
Then the client uses the existing `POST /api/train-update` flow  
And the saved data remains compatible with the current itinerary rendering and timetable refresh logic

### AC-8: Failure Handling

Given the user saves valid changes  
When the API request fails  
Then no silent data loss occurs  
And the editor remains available with the user's pending edits and an error message

## Assumptions and Resolved Defaults

- Keep the existing day-level edit trigger in the Train Schedule column; this refactor changes the editing experience, not where editing starts.
- Preserve the current train array shape and current API contract; FE serializes the structured form back into the same payload expected today.
- Treat the supported editable schema as the current common shape: `train_id` plus optional `start` and `end`.
- Allow manual entry for all fields; no train/station autocomplete is required for this refactor.
- Keep timetable resolution behavior unchanged after save; invalid or unmatched train data is not a blocker to saving if it passes existing data-shape validation.

## Success Signals

- Users can complete common train schedule edits without touching JSON.
- Invalid edits are caught before save more often than today.
- No backend changes are required.
- Existing itinerary train rendering continues to work with saved data.
