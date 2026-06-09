# RouteGPT

RouteGPT is a conversational AI transport assistant for Dhaka. The MVP helps users ask for routes in Banglish, Bengali, or English and receive bus, CNG, Pathao, and Uber fare guidance.

## Project Structure

```text
RouteGPT/
  backend/
  frontend/
  docs/
  README.md
  .env.example
```

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Start both apps:

```bash
npm run dev
```

Or start them separately:

```bash
npm run dev:backend
npm run dev:frontend
```

## Default Local URLs

- Backend: `http://localhost:4000`
- Backend health check: `http://localhost:4000/health`
- Frontend: `http://localhost:5173`

## Frontend Chat UI

The basic React chat interface lives in:

```text
frontend/src/App.jsx
frontend/src/styles.css
```

It includes:

- RouteGPT top header.
- Left navigation sidebar.
- Empty state with example route prompts.
- Bottom chat input.
- Send button.
- `POST /chat` connection to the backend.
- Assistant reply rendering.
- Basic account information modal shell.

Set a custom backend URL with:

```env
VITE_API_BASE_URL=http://localhost:4000
```

## Backend Chat API

Main endpoint:

```http
POST /chat
Content-Type: application/json
```

Request body:

```json
{
  "message": "Gabtoli theke Mirpur 1 bus e jabo"
}
```

The backend workflow:

1. Validates the request body.
2. Extracts origin, destination, modes, and student fare intent with the LLM layer.
3. Queries PostgreSQL for bus routes only when `bus` is requested.
4. Calculates bus and student fares from stop order.
5. Fetches Google Maps distance only when CNG or ride-hailing estimates are requested.
6. Calculates CNG, Pathao, and Uber estimates.
7. Returns deterministic structured cards for the frontend.

Important: bus routes always come from the local database. The LLM does not generate bus names, route facts, or fares.

Example response shape:

```json
{
  "ok": true,
  "type": "answer",
  "reply": "Gabtoli to Mirpur 1:\n\nBus:\n1. Achim Paribahan...",
  "intent": {
    "origin": "Gabtoli",
    "destination": "Mirpur 1",
    "modes": ["bus"]
  },
  "cards": []
}
```

## Database Schema

Apply the PostgreSQL schema after setting `DATABASE_URL` in `.env`:

```bash
npm run db:schema
```

Schema file:

```text
backend/db/schema.sql
```

The schema creates `buses`, `bus_stops`, `landmarks`, and `route_reports`, plus indexes for stop lookup and a `bus_route_stop_pairs` view for direction-aware route queries.

## Seed Database

Validate the scraped route data before writing to the database:

```bash
npm run db:seed -- --dry-run
```

Seed PostgreSQL after applying the schema:

```bash
npm run db:seed
```

The seed script reads:

```text
backend/data/bus_data.json
backend/data/landmark_aliases.json
```

It upserts bus services, refreshes ordered stops for each bus, and upserts starter landmark aliases. A manual verification query is available at:

```text
backend/db/examples/find-route.sql
```

## Fare Logic

Fare calculations live in:

```text
backend/src/fares.js
```

Run the fare unit tests:

```bash
npm test
```

Implemented policies:

- Bus fare: BDT 10 per station, BDT 10 minimum.
- Student bus fare: 50% of general fare, BDT 10 minimum.
- CNG fare: BDT 50 for first 2 km, then BDT 15/km, with optional 25% night surcharge.
- Ride-hailing estimates: configurable Pathao and Uber rate tables.

## LLM Intent Extraction

Intent extraction lives in:

```text
backend/src/llm/
```

Production flow:

1. Gemini 2.5 Flash parses the user message first.
2. The parser validates strict JSON.
3. If JSON is malformed, the system retries once with a repair prompt.
4. If Gemini fails, Groq `llama-3.3-70b-versatile` is used as fallback.

Expected normalized output:

```json
{
  "origin": "Gabtoli",
  "destination": "Mirpur 1",
  "modes": ["bus"],
  "studentFare": false,
  "needsClarification": false,
  "clarificationQuestion": null
}
```

Run the mocked intent extraction tests:

```bash
npm test
```

## Scrape Bus Route Data

Run the Dhaka Bus Service scraper:

```bash
npm run scrape:bus
```

Default output:

```text
backend/data/bus_data.json
```

The scraper reads the route table from `dhakabusservice.com`, normalizes bus names, Bengali names, ordered stops, operating hours, service type, source URL, and optional fare metadata when available.

To smoke-test detail-page enrichment on a small sample:

```bash
npm run scrape:bus -- --limit=2 --details
```

## Documentation

- Product requirements: `docs/PRD.md`
- Kanban board: `docs/KANBAN.md`
- OpenAI usage: `docs/HOW_ROUTEGPT_USES_OPENAI.md`
- Elevator pitch and project story: `docs/PITCH_AND_STORY.md`
- UI design PRD: `docs/STITCH_UI_DESIGN_PRD.md`
- Process steps: `docs/PROCESS_STEPS.md`
