# RouteGPT Product Requirements Document

## 1. Product Summary

**Product name:** RouteGPT  
**Product type:** Conversational AI transport assistant  
**Target location:** Dhaka, Bangladesh  
**Target users:** Daily commuters, students, office workers, and first-time route seekers in Dhaka  
**Stage:** Hackathon MVP  

RouteGPT helps Dhaka commuters find practical transport options between two locations through a simple chat interface. Users can ask naturally in Banglish, Bengali, or English, and the system returns bus options, CNG fare estimates, and ride-hailing estimates.

The core insight is that Dhaka bus route information exists, but it is scattered, inconsistent, and not accessible through mainstream transit tools. RouteGPT combines a scraped local bus database, deterministic fare logic, and an LLM for language understanding.

## 2. Problem

Dhaka commuters do not have a reliable digital tool that answers:

- Which bus should I take from one area to another?
- How much should the bus fare be?
- What would a CNG cost?
- How do bus, CNG, Pathao, and Uber compare?
- How can I ask this in the way Dhaka people actually text?

Google Maps transit coverage for Dhaka is incomplete, and transport data is fragmented across local websites, word of mouth, and informal knowledge.

## 3. Goals

- Let users ask transport questions in Banglish, Bengali, or English.
- Extract origin, destination, and preferred transport mode from natural language.
- Return bus routes from a structured local database.
- Apply a simple station-based bus fare policy.
- Estimate CNG fare using a transparent formula.
- Estimate Pathao and Uber bike/car fares using distance-based rate tables.
- Keep responses short, clear, and chat-friendly.
- Provide a "Report wrong info" action for route data quality.

## 4. Non-Goals

- Real-time bus tracking.
- Live Pathao or Uber API integration.
- User authentication.
- Payment or ticket booking.
- Full route map visualization.
- Production-grade community moderation.
- Multi-city support.

## 5. User Personas

### Daily Commuter

Travels regularly across Dhaka and wants the cheapest practical option.

### Student

Needs bus routes and student fare estimates. Price sensitivity is high.

### Occasional Traveler

Does not know bus names or stop names and needs a simple answer.

### New Dhaka Resident

May know landmarks but not official stop names.

## 6. Core User Stories

- As a commuter, I want to type "Mirpur to Motijheel" so I can see available transport options.
- As a student, I want to know the student bus fare so I can avoid overpaying.
- As a user, I want to type in Banglish so the app feels natural.
- As a user, I want only bus results when I say "bus e jabo".
- As a user, I want a CNG estimate so I can compare it with bus fare.
- As a user, I want ride-hailing estimates so I can decide whether opening Pathao or Uber is worth it.
- As a user, I want to report wrong route info so the data can improve.

## 7. MVP Features

### 7.1 Chat Input

Users enter a free-form message in Banglish, Bengali, or English.

Examples:

- "Bashundhara theke Jatrabari bus e jabo"
- "Mirpur to Motijheel"
- "Gulshan theke Dhanmondi CNG te"
- "farmgate boss?"

### 7.2 Intent Extraction

The LLM extracts:

```json
{
  "origin": "Gabtoli",
  "destination": "Mirpur 1",
  "modes": ["bus"]
}
```

Rules:

- If the user mentions a mode, return only that mode.
- If no mode is mentioned, return all supported modes.
- Normalize Banglish and Bengali area names into English canonical names.
- Ask a clarification question when origin or destination is missing or ambiguous.

### 7.3 Bus Route Lookup

The backend queries PostgreSQL for buses that include both origin and destination stops in the correct direction.

Direction rule:

```sql
stop_order(origin) < stop_order(destination)
```

Stop matching should support spelling variation using fuzzy matching and landmark aliases.

### 7.4 Bus Fare Policy

Fare is calculated by stop count.

Policy:

- Minimum general fare: BDT 10.
- General fare increases by BDT 10 for each station/stop crossed.
- Student fare is 50% of general fare.
- Minimum student fare: BDT 10.

Example route:

```text
Gabtoli -> Technical -> Ansar Camp -> Mirpur 1
```

Gabtoli to Mirpur 1 crosses 4 listed stations including origin and destination, so:

- General fare: BDT 40
- Student fare: BDT 20

Implementation note:

```js
const stationCount = destinationStopOrder - originStopOrder + 1;
const generalFare = Math.max(10, stationCount * 10);
const studentFare = Math.max(10, Math.ceil(generalFare * 0.5));
```

### 7.5 CNG Fare Estimate

CNG fare is estimated by distance.

Policy:

- First 2 km: BDT 50 flat minimum.
- Beyond 2 km: BDT 15 per km.
- Night surcharge: +25% after 11:00 PM.

Implementation note:

```js
const baseFare = 50;
const extraKm = Math.max(0, distanceKm - 2);
const fare = baseFare + extraKm * 15;
const finalFare = isNight ? fare * 1.25 : fare;
```

### 7.6 Ride-Hailing Fare Estimates

Pathao and Uber fares are estimates, not live fetched prices.

Reason:

- Pathao does not expose a reliable public fare API.
- Uber has official developer APIs, but fare estimate access requires approved scopes/access.
- Reverse-engineering app traffic is out of scope and not appropriate for the MVP.

MVP approach:

- Use Google Maps Distance Matrix for route distance and duration.
- Apply configurable provider rate tables.
- Show estimated ranges using `~BDT` notation.
- Warn users that actual app fare may vary due to traffic, availability, and surge pricing.

Initial supported estimates:

| Service | Vehicle | Base Fare | Per KM | Minimum |
| --- | --- | ---: | ---: | ---: |
| Pathao | Bike | BDT 20 | BDT 12/km | BDT 35 |
| Pathao | Car | BDT 50 | BDT 22/km | BDT 80 |
| Uber | Moto | BDT 25 | BDT 14/km | BDT 40 |
| Uber | Go | BDT 55 | BDT 24/km | BDT 90 |

### 7.7 Response Formatting

The assistant should respond in the same language style as the user.

Rules:

- Banglish in, Banglish out.
- Bengali in, Bengali out.
- English in, English out.
- Keep responses short.
- Prefer transport result cards in UI.
- Clearly say when no route is found.
- Never invent bus routes.

Example:

```text
Gabtoli theke Mirpur 1:

Bus:
1. Achim Paribahan
   Fare: BDT 40, Student: BDT 20

CNG: ~BDT 90
Pathao Bike: ~BDT 80-110
Uber Go: ~BDT 180-230
```

## 8. Technical Architecture

### 8.1 Stack

| Layer | Technology |
| --- | --- |
| Frontend | React |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| Scraper | Node.js + Cheerio |
| Distance | Google Maps Distance Matrix API |
| LLM | Gemini 2.5 Flash |
| Fallback LLM | Groq Llama 3.3 70B Versatile |
| Future Cache | Redis |

### 8.2 Backend Flow

1. User sends message to `POST /chat`.
2. LLM extracts origin, destination, and modes as JSON.
3. Backend canonicalizes stop names using aliases.
4. PostgreSQL finds buses serving the route in the correct direction.
5. Bus fare is calculated from stop order.
6. Distance API returns distance and duration.
7. CNG and ride-hailing estimates are calculated.
8. LLM formats final response in the user's language style.
9. Frontend renders transport cards.

### 8.3 Core Files

| File | Purpose |
| --- | --- |
| `server.js` | Express API and orchestration |
| `db.js` | PostgreSQL queries and fuzzy stop lookup |
| `prompt.js` | LLM prompts for intent extraction and response formatting |
| `fares.js` | Bus, CNG, Pathao, Uber fare calculation |
| `scraper.js` | Scrapes bus route data from dhakabusservice.com |
| `seed.js` | Loads scraped data into PostgreSQL |

## 9. Data Model

### 9.1 Tables

#### `buses`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | serial | Primary key |
| `name` | text | Bus service name |
| `seating_type` | text | Local service, seating, semi-seating |
| `operator` | text | Optional |
| `start_time` | text | Optional |
| `end_time` | text | Optional |
| `source_url` | text | Scraped page URL |

#### `bus_stops`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | serial | Primary key |
| `bus_id` | int | Foreign key to buses |
| `stop_name` | text | Canonical English stop name |
| `stop_name_bn` | text | Bengali stop name, if available |
| `stop_order` | int | Route order |

#### `landmarks`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | serial | Primary key |
| `colloquial_name` | text | User-entered name |
| `canonical_name` | text | Matching stop or area |
| `zone_id` | text | Optional grouping |

#### `route_reports`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | serial | Primary key |
| `route_result_id` | text | Optional result reference |
| `message` | text | User report |
| `created_at` | timestamp | Report time |

## 10. LLM Policy

### Primary Model

Use `gemini-2.5-flash`.

Reasons:

- Free tier available.
- Strong multilingual support.
- Good enough for Banglish/Bengali/English parsing.
- Suitable speed for chat UX.
- Supports structured extraction workflows.

### Fallback Model

Use `llama-3.3-70b-versatile` on Groq if Gemini fails or rate limits.

### Guardrails

- LLM must not fabricate bus names, fares, or stops.
- LLM parses and formats language only.
- Database and fare functions are the source of truth.
- Intent extraction must return valid JSON only.
- If uncertain, ask a clarification question.

## 11. UI Requirements

### Chat Screen

- Mobile-first layout.
- Text input at bottom.
- Message history.
- Loading state while processing.
- Transport result cards.

### Result Cards

Each result should show:

- Mode icon/name.
- Provider or bus name.
- Fare estimate.
- Student fare where applicable.
- Route stops summary.
- "Report wrong info" button.

### Empty States

- Missing origin: ask user for starting point.
- Missing destination: ask user for destination.
- No bus found: show CNG and ride-hailing estimates if distance is available.
- Distance unavailable: show bus results only.

## 12. Success Metrics

### Hackathon Demo Metrics

- Successfully answer 10 manually selected Dhaka route queries.
- Correctly parse Banglish route requests.
- Correctly filter by mode.
- Correctly calculate stop-based bus fare.
- Return response under 5 seconds for cached/local data paths.

### Product Metrics

- Query success rate.
- Percentage of queries needing clarification.
- Reported wrong-info rate per route.
- Repeat usage for saved/frequent routes.

## 13. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Scraped route data is stale | High | Add report button and weekly re-scrape |
| Stop names vary heavily | High | Landmark aliases and fuzzy matching |
| LLM misreads Banglish | Medium | Dhaka-specific prompt examples |
| Distance API quota exceeded | Medium | Cache origin-destination distance |
| Ride-hailing estimates differ from apps | Medium | Label as estimates and show range |
| Scraping source changes HTML | Medium | Keep scraper small and testable |

## 14. MVP Acceptance Criteria

- User can ask a route question in Banglish, Bengali, or English.
- Backend extracts origin and destination.
- Bus routes are returned only from database data.
- Bus fare follows the BDT 10 per station policy.
- Student fare is shown with 50% waiver and BDT 10 minimum.
- CNG estimate is shown when distance is available.
- Pathao and Uber bike/car estimates are shown when distance is available.
- If the user specifies bus, only bus results are shown.
- If the system is uncertain, it asks a clarification question.
- Every transport result has a report action.

## 15. Post-MVP Roadmap

### Phase 1: Data Quality

- Community correction workflow.
- Admin review for reported route issues.
- Weekly automated re-scraping.
- Manual top-route verification.

### Phase 2: Better Routing

- Stop disambiguation.
- Landmark-to-stop suggestions.
- Route map visualization.
- Transfer route suggestions.

### Phase 3: Platform

- Android app.
- WhatsApp bot.
- Saved routes.
- API access for civic research and planning.
