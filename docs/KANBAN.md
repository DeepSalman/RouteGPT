# RouteGPT Kanban Board

This board converts the PRD into hackathon-ready work items. Move cards across columns as work progresses.

## Backlog

### Product

- Define the top 10 demo routes for manual QA.
- Create a list of common Dhaka landmark aliases.
- Decide final response tone for Banglish, Bengali, and English.
- Define the exact copy for "Report wrong info".

### Data

- Identify all bus pages on dhakabusservice.com.
- Compare dhakabusservice.com data with at least one secondary source.
- Prepare manual fallback data for top 15-20 high-demand routes.
- Create sample route fixtures for tests.

### Frontend

- Add route result card design.
- Add loading state for chat response.
- Add empty state for missing origin/destination.
- Add "Report wrong info" interaction.
- Add mobile responsive polish.

### Backend

- Add API health endpoint.
- Add request validation for `POST /chat`.
- Add structured error responses.
- Add logging for failed LLM parsing.
- Add basic rate limiting if time allows.

### Future

- Redis cache for distance results.
- Route map visualization.
- Saved frequent routes.
- User-submitted correction moderation.
- WhatsApp bot integration.

## Ready

### LLM

- Add Gemini 2.5 Flash client.
- Add Groq Llama 3.3 70B fallback client.
- Add intent extraction prompt.
- Add response formatting prompt.
- Add strict JSON parsing and retry path.

## In Progress

No cards currently in progress.

## Review

No cards yet.

## Done

- Project handoff reviewed.
- Bus fare policy selected: BDT 10 per station, BDT 10 minimum.
- Student fare policy selected: 50% waiver, BDT 10 minimum.
- Ride-hailing policy selected: estimated fares from distance and rate table, not live Pathao/Uber fetching.
- LLM recommendation selected: Gemini 2.5 Flash primary, Groq Llama 3.3 70B fallback.
- Node.js backend scaffold initialized.
- React frontend scaffold initialized.
- Root workspace `package.json` added with basic scripts.
- `.env.example` added.
- README added with local setup steps.
- Scraper added for dhakabusservice.com route data.
- Scraper output generated at `backend/data/bus_data.json`.
- Scraper validated with 183 bus records and ordered stops.
- PostgreSQL schema added for `buses`, `bus_stops`, `landmarks`, and `route_reports`.
- Direction-aware route lookup supported by stop order constraints and `bus_route_stop_pairs` view.
- Schema apply command added as `npm run db:schema`.
- Seed script added for scraped bus route data.
- Starter landmark aliases added.
- Manual route verification query added.
- Fare module added for bus, student, CNG, Pathao, and Uber calculations.
- Fare unit tests added with Gabtoli to Mirpur 1 policy coverage.
- Root `npm test` command added.

## MVP Milestone Checklist

### Milestone 1: Data Foundation

- [ ] Scraper produces `bus_data.json`.
- [ ] Database schema exists.
- [ ] Seed script loads bus and stop data.
- [ ] At least 10 demo routes verified manually.

### Milestone 2: Backend API

- [ ] `POST /chat` endpoint exists.
- [ ] LLM extracts origin, destination, and modes.
- [ ] Bus lookup works by stop order.
- [ ] Bus fare and student fare calculate correctly.
- [ ] Distance API integration works.
- [ ] CNG, Pathao, and Uber estimates return correctly.

### Milestone 3: Frontend

- [ ] Chat UI accepts user messages.
- [ ] Chat UI renders assistant response.
- [ ] Transport result cards render bus, CNG, Pathao, and Uber options.
- [ ] Mode filtering is visible in results.
- [ ] Report wrong info button is present.

### Milestone 4: Demo Readiness

- [ ] Banglish route queries work.
- [ ] Bengali route queries work.
- [ ] English route queries work.
- [ ] No-route case is handled clearly.
- [ ] Ambiguous stop case asks clarification.
- [ ] Demo script is written.

## Sprint 1: Hackathon MVP

### Day 1

- Scrape route data.
- Create database schema.
- Seed PostgreSQL.
- Implement fare logic.
- Build LLM intent extraction.

### Day 2

- Implement `POST /chat`.
- Connect distance API.
- Build React chat UI.
- Render transport result cards.
- Run demo-route QA.

## Priority Guide

### P0

- Bus route lookup.
- Bus fare calculation.
- LLM intent extraction.
- Chat endpoint.
- Basic chat UI.

### P1

- CNG estimates.
- Pathao/Uber estimates.
- Report wrong info.
- Banglish response formatting.
- Manual QA routes.

### P2

- Stop disambiguation.
- Route map.
- Redis caching.
- Admin correction workflow.

## Demo Route QA Set

Use these as initial manual tests and adjust based on scraped data availability.

| Query | Expected Focus |
| --- | --- |
| `Gabtoli theke Mirpur 1 bus e jabo` | Bus lookup and station fare |
| `Mirpur 10 to Motijheel` | All modes |
| `Bashundhara theke Jatrabari bus` | Bus mode filter |
| `Gulshan theke Dhanmondi CNG te` | CNG-only estimate |
| `Farmgate to Uttara` | Common route |
| `Mohakhali theke Badda` | Short urban route |
| `Shahbag to Gulistan` | Central Dhaka route |
| `Khilgaon to Motijheel` | Fare estimate |
| `Mirpur theke Dhanmondi` | Ambiguity handling |
| `airport to gabtoli uber` | Ride-hailing estimate |

## Definition of Done

A card is done when:

- Code or documentation is committed-ready.
- The change is tested manually or with automated tests.
- User-facing behavior matches the PRD.
- Known limitations are documented.
- No unrelated changes are included.
