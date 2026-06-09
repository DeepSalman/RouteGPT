# RouteGPT Manual QA

Date: 2026-06-10

## Scope

Step 12 QA was run against the backend chat workflow with mocked LLM, route repository, and distance services. This verifies RouteGPT orchestration, mode filtering, fare/card output, no-route handling, and clarification behavior without calling external APIs.

Full browser QA was not run because frontend dependencies are not installed locally. `npm --workspace frontend run build` fails with `vite` not found.

## Automated Baseline

| Check | Result |
| --- | --- |
| Backend test suite | Passed: 26/26 |
| Package JSON parse check | Passed |
| Frontend build | Blocked: missing local dependencies |

## Demo Route QA Matrix

| # | Query | Focus | Result |
| ---: | --- | --- | --- |
| 1 | `Gabtoli theke Mirpur 1 bus e jabo` | Banglish, bus-only, student fare | Passed: bus card, BDT 40 general, BDT 20 student |
| 2 | `Mirpur 10 to Motijheel` | English, all modes | Passed: bus, CNG, Pathao Bike/Car, Uber Moto/Go |
| 3 | `Bashundhara theke Jatrabari bus` | Bus-only mode | Passed: only bus card, no distance lookup |
| 4 | `Gulshan theke Dhanmondi CNG te` | CNG-only mode | Passed: only CNG card, no bus lookup |
| 5 | `Farmgate to Uttara` | All modes | Passed: bus, CNG, Pathao, Uber cards |
| 6 | `Mohakhali theke Badda` | All modes | Passed: bus, CNG, Pathao, Uber cards |
| 7 | `Shahbag to Gulistan` | All modes | Passed: bus, CNG, Pathao, Uber cards |
| 8 | `Khilgaon to Motijheel` | All modes | Passed: bus, CNG, Pathao, Uber cards |
| 9 | `Mirpur theke Dhanmondi` | Ambiguous stop clarification | Passed: asks which Mirpur stop |
| 10 | `airport to gabtoli uber` | Ride-hailing estimate mode | Passed: Uber Moto and Uber Go only |

## Additional Step 12 Cases

| Query | Focus | Result |
| --- | --- | --- |
| Bengali-script Gulshan to Dhanmondi CNG query | Bengali input, CNG-only | Passed |
| `Mars to Motijheel bus` | No-route result | Passed: says no matching database route found |

## Frontend Result Card Check

Source-level verification passed for:

- Bus result card.
- CNG result card.
- Pathao result card.
- Uber result card.
- Student fare display on bus cards.
- `Report wrong info` button.
- Local confirmation text: `Thanks, we received your report.`

## Known Blockers

- Live browser/mobile QA is blocked until dependencies are installed with `npm install`.
- Real database QA is blocked until PostgreSQL is running and seeded.
- Real LLM and Google distance QA are blocked until valid `.env` keys are configured.
