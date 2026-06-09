# RouteGPT

RouteGPT is a chat-based transport assistant for Dhaka.

It helps commuters ask simple route questions in Banglish, Bengali, or English and get practical transport guidance: which bus to take, what the bus fare should be, what the student fare is, and how bus, CNG, Pathao, and Uber compare for the same trip.

Live demo: https://deepsalman.github.io/RouteGPT/

## The Problem

Dhaka runs on public transport, but route information is still difficult to access.

For many commuters, finding the right bus depends on asking strangers, calling friends, guessing from bus names, or relying on scattered local websites. Google Maps transit coverage is incomplete for Dhaka, and ride-hailing apps do not help users understand public bus options or fair bus fares.

This creates daily friction:

- People waste time finding the right route.
- New commuters struggle with informal stop names.
- Students often do not know the correct student fare.
- Users cannot easily compare bus, CNG, Pathao, and Uber in one place.
- Transport knowledge stays fragmented across word of mouth, local websites, and memory.

RouteGPT exists to turn that scattered local knowledge into a simple assistant anyone can use.

## The Idea

The product starts from one everyday question:

```text
How do I get from here to there?
```

Instead of forcing users to search through route lists or learn a strict form, RouteGPT lets them type naturally:

```text
Gabtoli theke Mirpur 1 bus e jabo
```

or:

```text
Gulshan to Dhanmondi CNG
```

RouteGPT understands the request, identifies the origin, destination, and preferred transport mode, then returns a clear answer in a familiar chat interface.

## What RouteGPT Does

RouteGPT helps users:

- Find bus options between two Dhaka locations.
- See general bus fare based on station count.
- See student bus fare with the 50% waiver policy.
- Compare bus, CNG, Pathao Bike, Pathao Car, Uber Moto, and Uber Go estimates.
- Ask in Banglish, Bengali, or English.
- Report wrong route information when data needs correction.

The goal is not to replace every transport app. The goal is to give Dhaka commuters one clear starting point before they travel.

## Why AI Is Used

RouteGPT uses AI to understand how people naturally ask for routes.

The AI is not trusted to invent bus routes, fare rules, or transport facts. Those come from a structured transport database and deterministic fare logic. This keeps the assistant conversational while reducing hallucinated route information.

In simple terms:

- AI understands the question.
- The database provides route facts.
- Fare rules calculate prices.
- The chat interface presents the answer clearly.

## Example

A student asks:

```text
Gabtoli theke Mirpur 1 bus e jabo
```

RouteGPT can respond with:

```text
Bus: Achim Paribahan
Route: Gabtoli -> Technical -> Ansar Camp -> Mirpur 1
General fare: BDT 40
Student fare: BDT 20
```

If the user asks:

```text
Mirpur 10 to Motijheel
```

RouteGPT can compare available options:

- Bus routes.
- CNG estimate.
- Pathao estimate.
- Uber estimate.

The user gets one practical answer instead of checking multiple sources.

## Who It Helps

RouteGPT is built for:

- Daily commuters who want fast route guidance.
- Students who need fair bus fare information.
- Office workers comparing price and convenience.
- First-time route seekers in Dhaka.
- New residents who know landmarks but not official stop names.
- Anyone who prefers asking naturally instead of searching manually.

## MVP Focus

The current MVP focuses on a narrow but useful transport workflow:

- Chat-first interface.
- Dhaka bus route lookup.
- Station-based bus fare.
- Student fare display.
- CNG and ride-hailing estimates.
- Report wrong info action.
- Simple account information window.

The product intentionally avoids advanced features such as ticket booking, payments, live bus tracking, or a complex map dashboard. The first version is meant to be simple, useful, and demo-ready.

## Why It Matters

Dhaka commuters do not need a perfect transport platform before they can benefit from better information.

Even a lightweight assistant can help people avoid wrong buses, reduce fare confusion, compare options faster, and make daily travel a little less stressful.

RouteGPT is a step toward making Dhaka's informal transport knowledge easier to access, verify, and improve over time.

## Project Links

- Live demo: https://deepsalman.github.io/RouteGPT/
- Product requirements: `docs/PRD.md`
- UI design brief: `docs/STITCH_UI_DESIGN_PRD.md`
- Pitch and story: `docs/PITCH_AND_STORY.md`
- Manual QA notes: `docs/MANUAL_QA.md`
