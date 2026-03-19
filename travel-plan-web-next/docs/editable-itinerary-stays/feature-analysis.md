# Feature Analysis — Editable Itinerary Stays

**Feature ID:** editable-itinerary-stays  
**Status:** Ready for tech design handoff  
**Date:** 2026-03-19  
**Project:** travel-plan-web-next

---

## 1. Problem Statement

The current Itinerary tab shows overnight city/stay blocks as merged, colour-coded, read-only cells. Users cannot adjust how many days are allocated to each city stay without manually editing raw data. This makes trip re-planning — lengthening or shortening a city visit — tedious and error-prone.

Additionally, a sandboxed duplicate of the Itinerary tab is needed so the editable-stays behaviour can be developed and validated in production without disturbing the live itinerary data.

---

## 2. Target Users

| User | Access |
|------|--------|
| Authenticated traveller | Both itinerary tabs (original + test) |
| Unauthenticated visitor | Neither tab (unchanged) |

---

## 3. Desired Outcomes

- The traveller can resize a city stay directly in the UI without touching raw JSON.
- The total number of trip days never changes (day conservation invariant).
- A clearly labelled test tab lets the feature be exercised safely while the live itinerary remains stable.

---

## 4. Scope

### In Scope

- **Duplicate "Itinerary (Test)" tab** — visually identical to the existing Itinerary tab but backed by a separate, independent persistence key (Redis key in prod / separate JSON file in dev).
- **Editable stay duration** — each overnight city block (merged cell) exposes an edit control to change the number of nights.
- **Shrink behaviour** — reducing a stay by N days reassigns those N days to the immediately following stay (days are not deleted).
- **Extend behaviour** — increasing a stay by N days borrows those N days from the immediately following stay.
- **Both tabs** carry the editable-stay feature (original Itinerary tab and Itinerary (Test) tab).
- Changes persist immediately on confirmation (same optimistic-update / revert-on-failure pattern as existing inline edits).

### Out of Scope

- Reordering cities (drag city blocks, not just activities).
- Adding or removing cities entirely.
- Editing stays for any tab other than the two itinerary tabs.
- Multi-user / collaborative editing.
- Borrowing days from the **previous** stay (only the following stay is affected).
- Editing stays on the last city block (there is no following stay to absorb or donate days; see edge cases).

---

## 5. User Flows

### 5.1 Tab Navigation

```mermaid
flowchart LR
    A[App loads — authenticated] --> B[Itinerary tab visible]
    A --> C[Itinerary (Test) tab visible]
    A --> D[Train Delays tab]
    A --> E[Timetable tab]
    B -->|independent data| F[(Redis: 'route')]
    C -->|independent data| G[(Redis: 'route-test')]
```

> Tab labels: **"Itinerary"** (original) and **"Itinerary (Test)"** (duplicate). The "(Test)" suffix is the only visual differentiator; all other UX is identical.

---

### 5.2 Edit a Stay — Shrink

```mermaid
sequenceDiagram
    actor User
    participant UI as Itinerary Tab
    participant API as /api/plan-update
    participant Store as Persistence

    User->>UI: Activates edit on overnight cell (City A, 4 nights)
    User->>UI: Enters new value: 2 nights
    UI->>UI: Preview: City A = 2 nights, City B (next) = current + 2
    User->>UI: Confirms
    UI->>API: POST {stayIndex, newNights, tabKey}
    API->>Store: Update overnight array; persist
    Store-->>API: OK
    API-->>UI: Updated route data
    UI->>UI: Re-render both affected merged cells
```

### 5.3 Edit a Stay — Extend

Same flow as Shrink; City A gains nights, City B loses the same count. City B's minimum is enforced (see edge cases).

### 5.4 Cancel / Revert

User dismisses the edit (Escape or click-away without confirming) → no change. API failure → optimistic update reverts, error toast shown.

---

## 6. Edge Cases

| Scenario | Expected Behaviour |
|----------|--------------------|
| User tries to reduce stay to 0 nights | Input is invalid; UI rejects, shows min-1 night constraint. |
| User tries to extend a stay when the next stay is already at 1 night | Input is invalid; UI rejects, shows "next stay has no nights to borrow." |
| Editing the **last** city block | Edit control is disabled/hidden; no following stay exists to absorb/donate. |
| Total days would change | Never permitted; API rejects any payload where (stayA + stayB) ≠ current total of the two stays. |
| API failure | Optimistic update reverts; toast notifies user. |
| Test tab data diverges from original | Expected; each tab's data is independent. Resetting test tab data is out of scope for MVP. |
| Concurrent edits from two browser tabs | Last-write-wins (consistent with existing itinerary edit behaviour). |

---

## 7. Acceptance Criteria

### AC-1: Itinerary (Test) Tab Exists and Is Independent

> **Given** the user is authenticated  
> **When** they view the app  
> **Then** two itinerary-style tabs are visible: "Itinerary" and "Itinerary (Test)"  
> **And** edits made in one tab do not affect data displayed in the other tab

### AC-2: Stay Edit Control Is Present

> **Given** the user is on either itinerary tab  
> **When** they view an overnight city block that is NOT the last block  
> **Then** an edit affordance (e.g., pencil icon or double-click) is available on the merged overnight cell

### AC-3: Shrink a Stay — Leftover Days Reassigned to Next Stay

> **Given** City A has 4 nights and City B (next) has 3 nights  
> **When** the user sets City A to 2 nights and confirms  
> **Then** City A shows 2 nights  
> **And** City B shows 5 nights  
> **And** the total trip day count remains unchanged  
> **And** the change is persisted and survives a page reload

### AC-4: Extend a Stay — Days Borrowed from Next Stay

> **Given** City A has 2 nights and City B (next) has 4 nights  
> **When** the user sets City A to 4 nights and confirms  
> **Then** City A shows 4 nights  
> **And** City B shows 2 nights  
> **And** the total trip day count remains unchanged  
> **And** the change is persisted and survives a page reload

### AC-5: Minimum 1 Night Enforced

> **Given** City A has 1 night  
> **When** the user attempts to set City A to 0 nights  
> **Then** the edit is rejected with a visible validation message  
> **And** the overnight data is unchanged

### AC-6: Cannot Borrow Below 1 Night from Next Stay

> **Given** City B (next stay) has 1 night  
> **When** the user attempts to extend City A by any amount  
> **Then** the edit is rejected with a visible message indicating the next stay cannot be reduced further

### AC-7: Last City Block Is Not Editable

> **Given** the last overnight city block in the itinerary  
> **When** the user views it  
> **Then** no edit affordance is present for stay duration

### AC-8: API Failure Reverts Change

> **Given** the user confirms a valid stay edit  
> **When** the API call fails  
> **Then** the UI reverts to the previous stay values  
> **And** an error notification is shown

### AC-9: Authenticated-Only Access

> **Given** the user is not authenticated  
> **When** they load the app  
> **Then** neither itinerary tab is visible (unchanged from existing behaviour)

---

## 8. Non-Functional Requirements

| Requirement | Expectation |
|-------------|-------------|
| Optimistic UI | Edit confirmation renders immediately; reverts on API error |
| Persistence | Both tabs' data survive page reload (same durability as existing itinerary) |
| Day conservation | Server must validate that `newStayA + newStayB == oldStayA + oldStayB` before persisting |
| Accessibility | Edit control is keyboard-accessible; confirmation and cancel via Enter/Escape |

---

## 9. Success Metrics

| Metric | Goal |
|--------|------|
| Stay edit round-trip p95 latency | ≤ 1 s (same target as existing plan-update) |
| Day conservation violations | 0 in production |
| Test tab data isolation | 0 incidents where test-tab writes affect original itinerary |
| Edit revert correctness | 100% — UI always reflects persisted state after failure |

---

## 10. Constraints

| Constraint | Detail |
|------------|--------|
| Platform | Vercel serverless — no persistent in-process state |
| Storage | Upstash Redis (prod, `ROUTE_REDIS_KEY` env var) / local JSON (dev); test tab uses a separate key |
| Auth | Only authenticated users can access or edit either itinerary tab |
| Trip length | Fixed at 16 days; total must not change |
| Data seed | Test tab seeds from the same `route.json` seed file as the original tab |

---

## 11. Open Questions & Assumptions

| # | Question / Assumption | Status |
|---|----------------------|--------|
| Q1 | What is the Redis key name for the test tab? (Assumption: `route-test`; to be confirmed with tech lead.) | Open |
| Q2 | Should the test tab auto-seed from a fresh copy of `route.json` each time it is empty, or only once? | Open |
| Q3 | Is a "Reset test data" button for the test tab in scope? | Assumed **out of scope** for MVP |
| Q4 | Does the edit control open inline (direct input in cell) or via a modal/popover? | Deferred to tech design |
| Q5 | Should non-consecutive stays (skipping City B to borrow from City C) ever be supported? | Assumed **no** for MVP |
| Q6 | Does stay edit affect the date/weekday columns (re-computation of dates per city)? | Assumed **no** — dates remain as-is; only the overnight city grouping changes |
| A1 | Both tabs are auth-gated (no public access) — confirmed from existing pattern. | Assumption confirmed |
| A2 | "Stays" are defined purely by consecutive days sharing the same `overnight` value. | Assumption; to be validated against data model |
