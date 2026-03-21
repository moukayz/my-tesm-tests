# Features Summary - travel-plan-web-next

## Current Feature Set

- `itinerary`: authenticated itinerary table with inline plan editing, drag-and-drop reorder, train schedule display, export, and editable overnight stays.
- `itinerary-test`: authenticated sandbox copy of the itinerary with independent persistence.
- `train-schedule-editor`: authenticated day-level editing of a day's train entries from the Itinerary tab; currently implemented as a raw-JSON editor and targeted for UX refactor.
- `train-timetable`: public train timetable lookup across supported rail providers.
- `train-delays`: public German long-distance delay analytics by train and station.

## Notes

- This summary reflects the current shipped/planned product surface at a high level.
- `itinerary-train-schedule-editor` is a UX refactor of an existing feature, not a net-new feature area.
