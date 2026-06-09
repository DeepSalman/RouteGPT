# RouteGPT Precise Process Steps

This document defines the exact working process for building RouteGPT from the current PRD and Kanban plan.

## Step 1: Confirm Scope

Goal: lock the MVP before writing code.

Actions:

1. Use `docs/PRD.md` as the product source of truth.
2. Use `docs/STITCH_UI_DESIGN_PRD.md` as the UI source of truth.
3. Use `docs/KANBAN.md` as the execution board.
4. Do not add extra features outside the MVP unless explicitly requested.

Done when:

- MVP scope is clear.
- Required features are known.
- Out-of-scope features are not being built.

## Step 2: Initialize Project Structure

Goal: create a clean full-stack app structure.

Actions:

1. Create backend folder.
2. Create frontend folder.
3. Add root README.
4. Add `.env.example`.
5. Add basic package scripts.

Expected structure:

```text
RouteGPT/
  backend/
  frontend/
  docs/
  README.md
  .env.example
```

Done when:

- Backend and frontend folders exist.
- Project can be installed locally.
- Environment variables are documented.

## Step 3: Build Database Schema

Goal: prepare PostgreSQL tables for bus route data.

Actions:

1. Create `buses` table.
2. Create `bus_stops` table.
3. Create `landmarks` table.
4. Create `route_reports` table.
5. Add useful indexes for stop lookup.

Done when:

- Schema can be created from a script.
- Tables match the PRD.
- Stop order can support direction-aware route lookup.

## Step 4: Build Scraper

Goal: fetch bus route data from `dhakabusservice.com`.

Actions:

1. Fetch bus pages.
2. Parse bus name.
3. Parse route stops.
4. Parse Bengali stop names if available.
5. Parse seating type, fare range, and operating hours if available.
6. Save normalized output to `bus_data.json`.

Done when:

- Scraper produces valid JSON.
- Each bus has a name and ordered stops.
- Scraped data can be used by the seed script.

## Step 5: Seed Database

Goal: load scraped route data into PostgreSQL.

Actions:

1. Read `bus_data.json`.
2. Insert buses.
3. Insert ordered bus stops.
4. Insert starter landmark aliases.
5. Avoid duplicate inserts where possible.

Done when:

- Database contains bus services and stop order.
- A manual SQL query can find buses between two stops.

## Step 6: Implement Fare Logic

Goal: make fares deterministic and testable.

Actions:

1. Implement bus fare by station count.
2. Implement student fare with 50% waiver and BDT 10 minimum.
3. Implement CNG fare by distance.
4. Implement Pathao Bike and Car estimates.
5. Implement Uber Moto and Go estimates.
6. Keep ride-hailing rates configurable.

Bus fare rule:

```text
General fare = max(10, station count * 10)
Student fare = max(10, 50% of general fare)
```

Done when:

- Gabtoli to Mirpur 1 returns BDT 40 general and BDT 20 student.
- Fare functions can be tested without calling the LLM.

## Step 7: Implement LLM Intent Extraction

Goal: understand user route requests.

Actions:

1. Add Gemini 2.5 Flash client.
2. Add Groq fallback client.
3. Create intent extraction prompt.
4. Return strict JSON with origin, destination, and modes.
5. Add retry or fallback when JSON parsing fails.

Expected output:

```json
{
  "origin": "Gabtoli",
  "destination": "Mirpur 1",
  "modes": ["bus"]
}
```

Done when:

- Banglish, Bengali, and English examples parse correctly.
- Missing or ambiguous locations trigger clarification.

## Step 8: Implement Backend Chat API

Goal: create the main RouteGPT backend workflow.

Actions:

1. Add `POST /chat`.
2. Validate request body.
3. Extract intent with LLM.
4. Query bus routes from PostgreSQL.
5. Calculate bus fares.
6. Fetch distance when needed.
7. Calculate CNG, Pathao, and Uber estimates.
8. Format response.
9. Return structured data for frontend cards.

Done when:

- `POST /chat` can answer a route query end to end.
- Mode filtering works.
- No bus route is invented by the LLM.

## Step 9: Build Basic Frontend

Goal: create the simple ChatGPT-like interface.

Actions:

1. Build top header with `RouteGPT`.
2. Build chat message area.
3. Build empty state.
4. Build bottom input bar.
5. Add send button.
6. Connect chat input to backend.
7. Render assistant replies.

Done when:

- User can type a route query.
- User can send the message.
- Backend response appears in chat.

## Step 10: Build Result Cards

Goal: make transport results readable.

Actions:

1. Add bus result card.
2. Add CNG result card.
3. Add Pathao result card.
4. Add Uber result card.
5. Add student fare display for bus.
6. Add `Report wrong info` button.

Done when:

- Results match the UI design PRD.
- Cards are compact and readable on mobile.

## Step 11: Build Account Window

Goal: add only basic user account information.

Actions:

1. Add profile/account button.
2. Open account modal or side panel.
3. Show name, email, student status, and preferred language.
4. Add edit mode.
5. Add save and cancel actions.

Done when:

- Account window opens and closes.
- User can edit basic local profile data.
- No extra account features are added.

## Step 12: Manual QA

Goal: verify demo readiness.

Actions:

1. Test 10 demo routes from `docs/KANBAN.md`.
2. Test Banglish input.
3. Test Bengali input.
4. Test English input.
5. Test bus-only mode.
6. Test CNG-only mode.
7. Test ride-hailing estimate mode.
8. Test no-route result.
9. Test ambiguous stop clarification.
10. Test report wrong info button.

Done when:

- Main demo paths work.
- Known limitations are documented.

## Step 13: Polish

Goal: make the MVP feel stable and presentable.

Actions:

1. Improve loading states.
2. Improve error messages.
3. Check mobile layout.
4. Check desktop layout.
5. Remove noisy debug logs.
6. Update README with run instructions.

Done when:

- App is demo-ready.
- Setup steps are clear.
- UI matches the Stitch design PRD.

## Step 14: Git Workflow

Goal: keep changes clean and reviewable.

Actions:

1. Check `git status`.
2. Review changed files.
3. Stage only project-related changes.
4. Commit with a clear message.
5. Push only when requested.

Done when:

- Local work is cleanly organized.
- GitHub push happens only after explicit approval.

## Build Order Summary

1. Documentation lock.
2. Project scaffold.
3. Database schema.
4. Scraper.
5. Seed script.
6. Fare logic.
7. LLM intent extraction.
8. Backend chat API.
9. Frontend chat UI.
10. Result cards.
11. Account window.
12. Manual QA.
13. Polish.
14. Git commit and push when requested.
