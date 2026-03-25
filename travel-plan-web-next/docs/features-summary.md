# Features Summary - travel-plan-web-next

## Current Feature Set

- `itinerary`: authenticated itinerary cards/library entry with reopenable saved itineraries, then itinerary workspace editing with note editing, drag-and-drop train schedule reorder, train schedule display, export, and editable overnight stays.
- `itinerary-cards-navigation`: *(shipped)* itinerary tab starts from a desktop cards view (`ItineraryCardsView`); selecting a card opens the workspace; explicit in-app back action (`Back to all itineraries`) returns to cards view.
- `itinerary-creation-and-stay-planning`: *(shipped)* create new itineraries via `CreateItineraryModal` (name + startDate); add and edit stays progressively in `ItineraryWorkspace` via `StaySheet`; stay-location autocomplete with resolved coordinates/place metadata; custom-location fallback fully supported.
- `train-schedule-editor`: *(shipped)* structured day-level train row editor (`TrainScheduleEditorModal`) with add, drag-and-drop reorder, row-end delete, inline validation, and single-save persistence via `POST /api/train-update`.
- `itinerary-note-column`: *(shipped)* per-day free-form note column; pencil click opens textarea; blur to save; Markdown rendered; saves to `/api/itineraries/[id]/days/[dayIndex]/note` (itinerary-scoped) or `POST /api/note-update` (legacy).
- `attractions`: *(shipped)* per-day attractions column; search by name via GeoNames; colour-coded tags with image upload/viewer and minimap popover (MapLibre).
- `train-timetable`: public train timetable lookup across DB (German), SNCF (French), and Eurostar railways; railway auto-detected from train ID.
- `train-delays`: public German long-distance delay analytics by train and station with stats grid and trend chart.

## Notes

- This summary reflects the current shipped product surface at a high level.
- The `itinerary-test` sandbox tab has been removed; the main `itinerary` tab now serves as the single itinerary workspace.
- Feature-level design docs live in `docs/<feature-name>/` subdirectories.
