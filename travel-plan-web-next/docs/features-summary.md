# Features Summary - travel-plan-web-next

## Current Feature Set

- `itinerary`: authenticated itinerary cards/library entry with reopenable saved itineraries, then itinerary workspace editing with inline plan edits, drag-and-drop reorder, train schedule display, export, and editable overnight stays.
- `itinerary-cards-navigation`: planned navigation enhancement that makes the Itinerary tab start from a desktop cards view and adds explicit in-app return actions from itinerary detail/editor back to that cards view.
- `itinerary-creation-and-stay-planning`: planned creation flow for starting a brand-new itinerary, then adding and editing stays progressively from the itinerary workspace; includes duplicate-itinerary as a secondary flow and stay-location autocomplete/custom-location persistence in itinerary stay add/edit flows.
- `itinerary-test`: authenticated sandbox copy of the itinerary with independent persistence.
- `train-schedule-editor`: authenticated day-level editing of a day's train entries from the Itinerary tab; currently implemented as a raw-JSON editor and targeted for UX refactor.
- `train-timetable`: public train timetable lookup across supported rail providers.
- `train-delays`: public German long-distance delay analytics by train and station.

## Notes

- This summary reflects the current shipped/planned product surface at a high level.
- `itinerary-train-schedule-editor` is a UX refactor of an existing feature, not a net-new feature area.
