# RouteGPT Handoff Documentation

Last updated: 2026-06-10

## 1. Project Brief

RouteGPT is a chat-based Dhaka transport assistant. A user can type a natural route question in Banglish, Bengali, or English, and the app returns practical transport guidance: bus options from scraped route data, deterministic bus fare, student fare, CNG estimate, and Pathao/Uber estimate.

The MVP is intentionally simple. It is not a map app, ticketing app, live ride-hailing integration, or full transport operating system. It is a conversational layer over structured local transport data.

Live demo:

- GitHub Pages: `https://deepsalman.github.io/RouteGPT/`

Primary product docs:

- `docs/PRD.md`
- `docs/STITCH_UI_DESIGN_PRD.md`
- `docs/KANBAN.md`
- `docs/PITCH_AND_STORY.md`
- `docs/HOW_ROUTEGPT_USES_OPENAI.md`

## 2. Core Intuition

Dhaka transport knowledge is mostly informal. People know routes through memory, bus helpers, friends, Facebook posts, scattered websites, and repeated experience. RouteGPT turns that informal knowledge into a structured assistant.

The important architecture idea is:

```text
LLM understands language.
Database provides facts.
Fare code calculates prices.
Frontend presents results.
```

The LLM should not invent routes, fares, stops, or bus facts. It extracts intent from messy user language, then deterministic systems do the factual work.

Example:

```text
User: Gabtoli theke Mirpur 1 bus e jabo
Intent: origin=Gabtoli, destination=Mirpur 1, modes=[bus]
Database: find buses where Gabtoli appears before Mirpur 1
Fare logic: station count * BDT 10, minimum BDT 10
UI: show compact result cards
```

Named bus route queries are also supported:

```text
User: Raida bus er route bolo
Intent: intentType=bus_route, busName=Raida
Database/static data: return the full ordered Raida stop list
```

## 3. User-Facing Scope

Current MVP supports:

- Chat-first route search.
- Banglish, Bengali, and English route requests.
- Greeting and basic conversation handling.
- Bus route lookup by ordered stops.
- Named bus full-route lookup.
- Bus fare and student fare.
- CNG estimate by distance.
- Pathao Bike, Pathao Car, Uber Moto, and Uber Go estimates.
- Vehicle-specific fare requests: "bike e vara koto" returns only bike-class rides (Pathao Bike, Uber Moto), "pathao bike" only that product, "car" only car-class rides; bus and CNG cards are excluded from vehicle-specific requests.
- "Report wrong info" button in transport cards.
- Simple account information modal.
- GitHub Pages static demo mode.

Out of scope for the MVP:

- Live bus tracking.
- Live Pathao/Uber fare APIs.
- Payments or booking.
- Authentication.
- Admin moderation dashboard.
- Multi-city support.
- Complex map visualization.

## 4. System Flow

### Full Backend Flow

```text
React frontend
  -> POST /chat
  -> intent extraction
  -> route repository
  -> fare calculation
  -> distance estimate
  -> response formatter
  -> structured cards + text reply
```

### GitHub Pages Demo Flow

GitHub Pages cannot call the local backend or PostgreSQL, so the frontend has a static demo path:

```text
React frontend
  -> frontend/src/demoResponses.js
  -> frontend/src/data/staticBusRoutes.js
  -> local matching and fare estimation
  -> structured cards + text reply
```

This means GitHub Pages behavior is powered by bundled static route data, while local/API mode uses the backend and database.

## 5. Repository File Map

```text
RouteGPT/
  README.md
  package.json
  .env.example

  docs/
    PRD.md
    STITCH_UI_DESIGN_PRD.md
    KANBAN.md
    PROCESS_STEPS.md
    MANUAL_QA.md
    PITCH_AND_STORY.md
    HOW_ROUTEGPT_USES_OPENAI.md
    HANDOFF.md

  backend/
    package.json
    data/
      bus_data.json
      landmark_aliases.json
    db/
      schema.sql
      examples/
        find-route.sql
    src/
      server.js
      scraper.js
      fares.js
      fares.test.js
      distance.js
      distance.test.js
      chat/
        chatService.js
        chatService.test.js
        responseFormatter.js
      db/
        applySchema.js
        pool.js
        routeRepository.js
        routeRepository.test.js
        seedDatabase.js
      llm/
        intentExtraction.js
        intentExtraction.test.js
        intentPrompt.js
        geminiClient.js
        groqClient.js

  frontend/
    package.json
    index.html
    vite.config.js
    scripts/
      generateStaticBusRoutes.js
    src/
      main.jsx
      App.jsx
      styles.css
      demoResponses.js
      data/
        staticBusRoutes.js
```

## 6. Important Files

### Root

| File | Purpose |
| --- | --- |
| `README.md` | Human-facing project idea, problem, and live demo link. |
| `package.json` | Workspace scripts for backend, frontend, build, scrape, schema, seed, and tests. |
| `.env.example` | Documents required environment variables. |

### Docs

| File | Purpose |
| --- | --- |
| `docs/PRD.md` | Product source of truth. |
| `docs/STITCH_UI_DESIGN_PRD.md` | UI design source of truth. |
| `docs/KANBAN.md` | Execution board and QA routes. |
| `docs/HOW_ROUTEGPT_USES_OPENAI.md` | Explains LLM role and guardrails. |
| `docs/MANUAL_QA.md` | Manual QA matrix. |
| `docs/HANDOFF.md` | This project handoff. |

### Backend

| File | Purpose |
| --- | --- |
| `backend/src/server.js` | Express app, `/health`, and `POST /chat`. |
| `backend/src/chat/chatService.js` | Main backend workflow orchestration. |
| `backend/src/chat/responseFormatter.js` | Converts structured route results into chat text. |
| `backend/src/fares.js` | Bus, student, CNG, Pathao, and Uber fare logic. |
| `backend/src/distance.js` | Google distance service plus approximate fallback. |
| `backend/src/llm/intentExtraction.js` | Intent extraction, local guards, fallback parser, JSON normalization. |
| `backend/src/llm/intentPrompt.js` | Strict JSON prompt/schema for LLM intent extraction. |
| `backend/src/llm/conversationReply.js` | LLM-written conversational replies (identity, small talk, general questions) with persona guardrails. |
| `backend/src/llm/geminiClient.js` | Gemini provider client. |
| `backend/src/llm/groqClient.js` | Groq fallback provider client. |
| `backend/src/db/routeRepository.js` | PostgreSQL fuzzy route lookup and named bus route lookup. |
| `backend/src/db/pool.js` | Database pool and default repository factory. |
| `backend/src/db/seedDatabase.js` | Seeds scraped route data and aliases into PostgreSQL. |
| `backend/src/db/applySchema.js` | Applies schema to PostgreSQL. |
| `backend/src/scraper.js` | Scrapes route data from `dhakabusservice.com`. |
| `backend/data/bus_data.json` | Scraped bus route dataset. |
| `backend/data/landmark_aliases.json` | Starter aliases for colloquial stop names. |
| `backend/db/schema.sql` | Database tables, indexes, and `bus_route_stop_pairs` view. |

### Frontend

| File | Purpose |
| --- | --- |
| `frontend/src/App.jsx` | Chat UI, cards, sidebar, account modal, input composer. |
| `frontend/src/styles.css` | Transit-themed design system, chat layout, and responsive styling. |
| `frontend/src/demoResponses.js` | Static demo brain for GitHub Pages. |
| `frontend/src/data/staticBusRoutes.js` | Generated static frontend route dataset. |
| `frontend/scripts/generateStaticBusRoutes.js` | Converts backend bus data into frontend static route data. |
| `frontend/vite.config.js` | Vite config, including Pages base path. |

## 7. Core Data Model

PostgreSQL tables:

- `buses`: one row per bus service.
- `bus_stops`: ordered stops for each bus.
- `bus_counters`: counter data if available.
- `landmarks`: colloquial names mapped to canonical names.
- `route_reports`: user reports for incorrect information.

Important view:

- `bus_route_stop_pairs`: expands each bus into valid origin/destination stop pairs where origin comes before destination.

Direction rule:

```text
origin.stop_order < destination.stop_order
```

This avoids returning reverse-direction routes unless that reverse route exists as ordered data.

Place matching rule:

Users often type only the leading word of a longer stop name ("kuril" for "Kuril Bishwa Road" or "Kuril Chourasta"). Both the SQL lookup and the static demo matcher treat names as equivalent when their first word matches (length >= 5, and never across names containing digits, so "Mirpur 1" cannot match "Mirpur 10").

## 8. Fare Rules

Bus fare:

```text
general fare = max(10, stationCount * 10)
student fare = max(10, ceil(general fare * 0.5))
```

Example:

```text
Gabtoli -> Technical -> Ansar Camp -> Mirpur 1
stationCount = 4
general fare = BDT 40
student fare = BDT 20
```

CNG fare:

```text
base = BDT 50 for first 2 km
extra = BDT 15 per km after 2 km
night surcharge = +25%
```

Ride-hailing:

- Pathao and Uber are estimates from configurable rate tables.
- They are not live app prices.
- Always show them as approximate ranges.

## 9. LLM Strategy

Primary LLM:

- Gemini 2.5 Flash.

Fallback LLM:

- Groq Llama 3.3 70B Versatile.

Important guardrails:

- LLM extracts intent and writes conversational replies; deterministic code does everything else.
- Conversational messages (greetings, identity questions like "what is your name", small talk, general questions) get a natural LLM-written reply from `backend/src/llm/conversationReply.js`, with a canned fallback when no provider is configured or the call fails.
- LLM does not invent bus routes.
- LLM does not invent fare rules.
- The conversation persona prompt forbids stating bus names, routes, stops, fares, or schedules from memory.
- Unknown places are refused, not estimated: when no bus route matches and an origin/destination cannot be verified against stops or landmarks (e.g. "Badda to dmd"), RouteGPT replies that it could not find the place instead of inventing distance-based fares. Applies to both backend mode and the static demo.
- Backend/database are source of truth.
- Invalid JSON triggers retry/fallback.
- Missing or ambiguous locations trigger clarification.

Local non-LLM guards already handle:

- Greetings like `hello` (classification only; the reply text is LLM-written when a provider is configured).
- Identity, thanks, and small-talk Banglish with typo variants (`tomar/tumar nam/naam/name ki`, `kemon acho/aso`, `dhonnobad`), so these never reach the LLM as route queries.
- Basic help messages.
- Simple route syntax such as `A to B` or `A theke B`.
- Named bus route requests such as `Raida bus er route bolo`.

## 10. Environment Variables

See `.env.example`.

Common variables:

```text
PORT=4000
CORS_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://...
GOOGLE_MAPS_API_KEY=...
LLM_PROVIDER=gemini
GEMINI_API_KEY=...
LLM_FALLBACK_PROVIDER=groq
GROQ_API_KEY=...
VITE_API_BASE_URL=http://localhost:4000
VITE_DEMO_MODE=false
```

GitHub Pages uses demo/static mode, so it does not need backend env vars at runtime.

## 11. Common Commands

Do not run dependency installation unless explicitly needed.

```bash
npm test
npm run dev:backend
npm run dev:frontend
npm run build --workspace frontend
npm run scrape:bus
npm run db:schema
npm run db:seed
```

Current local note:

- `npm test` runs the backend suite and the frontend demo-brain suite (51 + 10 tests, all passing on 2026-06-10).
- A local frontend build may fail if `vite` is not installed locally. Do not solve that by blindly running `npm install` unless the project owner approves it.

## 12. GitHub Pages Notes

The live demo is static and frontend-only.

Key implication:

- Backend database improvements must be mirrored in `frontend/src/demoResponses.js` or `frontend/src/data/staticBusRoutes.js` if the same behavior must work on GitHub Pages.

Static bus data generation:

```text
backend/data/bus_data.json
  -> frontend/scripts/generateStaticBusRoutes.js
  -> frontend/src/data/staticBusRoutes.js
```

## 13. Current Known Limitations

- GitHub Pages demo is static; it cannot query PostgreSQL.
- GitHub Pages demo conversation replies are templated; free-form LLM replies only happen in backend mode.
- Real Pathao/Uber fares are not fetched live.
- Google Maps distance requires API configuration in backend mode.
- Stop aliases need continuous improvement.
- Reverse direction works only when data has that direction as an ordered route.
- Transfer routes are not implemented yet.
- Report wrong info is UI-level confirmation; full moderation workflow is post-MVP.

## 14. Suggested Next Steps

1. Verify the seeded PostgreSQL database against the latest `backend/data/bus_data.json`.
2. Run the QA set in `docs/KANBAN.md` against a real local backend, not only static demo mode.
3. Add more aliases for common no-space, misspelled, and Bengali stop names.
4. Improve route ranking for multiple matching buses.
5. Add transfer route suggestions for cases with no direct bus.
6. Store report submissions through a backend endpoint.
7. Add a small admin/review workflow for route corrections.
8. Add distance caching if Google Maps usage becomes expensive.

## 15. Handoff Summary

RouteGPT should be maintained as a retrieval-and-calculation product, not as a free-form chatbot.

When adding features, ask:

- Is the LLM only understanding language?
- Is the route fact coming from trusted data?
- Is the fare deterministic and testable?
- Does GitHub Pages static mode need equivalent behavior?
- Is the UI still simple and chat-first?

If those answers stay clean, the project will remain demo-friendly while becoming smarter over time.
