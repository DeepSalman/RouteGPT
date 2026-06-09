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
- UI design PRD: `docs/STITCH_UI_DESIGN_PRD.md`
- Process steps: `docs/PROCESS_STEPS.md`
