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
