# RouteGPT Elevator Pitch and Project Story

## Elevator Pitch

RouteGPT is a chat-based transport assistant for Dhaka that tells commuters which bus to take, how much the fare should be, and how bus, CNG, Pathao, and Uber compare for the same trip.

Dhaka has millions of daily bus riders, but no reliable digital tool for local bus routes. Google Maps transit data is incomplete, and most route knowledge lives in people's memory. RouteGPT solves this with a simple ChatGPT-like interface where users can ask in Banglish, Bengali, or English.

Instead of guessing, RouteGPT uses a structured local bus-route database, station-based fare logic, and AI only for understanding the user's language. The result is a practical assistant built for how Dhaka commuters actually travel and text.

## 30-Second Pitch

In Dhaka, finding the right bus is still mostly word of mouth. A commuter might know where they want to go, but not which bus serves that route, what the fare should be, or whether CNG or ride-hailing is worth it.

RouteGPT makes this simple. Users type naturally, like "Gabtoli theke Mirpur 1 bus e jabo," and the app returns bus options, general fare, student fare, CNG estimate, and ride-hailing estimates. It understands Banglish, Bengali, and English, while the actual route and fare facts come from a structured database.

RouteGPT is the missing digital layer for Dhaka's everyday transport.

## One-Line Pitch

RouteGPT is a ChatGPT-like transport assistant that helps Dhaka commuters find buses and compare fares in Banglish, Bengali, or English.

## Problem Story

Every day, millions of people in Dhaka depend on buses. But finding the right bus is surprisingly hard.

A student standing in Gabtoli may need to go to Mirpur 1. They can ask a passerby, call a friend, or guess based on bus names passing by. If they want to compare the bus fare with CNG, Pathao, or Uber, they have to check multiple apps or negotiate without knowing what a fair price should be.

The information exists, but it is scattered. Some of it is on local websites, some of it is inside commuters' heads, and some of it changes over time. For a city as dense and transport-dependent as Dhaka, this creates daily friction.

The result is wasted time, wrong buses, overpaid fares, and stress for ordinary commuters.

## Project Story

RouteGPT started from a simple observation: Dhaka does not need another complicated transport dashboard. It needs a simple answer to a simple question:

```text
How do I get from here to there?
```

So the product is built around chat. No map-first interface. No complex filters. No formal language requirement. A user can write the way they naturally text:

```text
Bashundhara theke Jatrabari bus e jabo
```

RouteGPT understands the request, extracts the origin, destination, and transport mode, then checks a structured local route database. The AI is used for language understanding, but the transport facts come from the database. This keeps the app useful without letting the model hallucinate fake bus routes.

For bus fare, RouteGPT uses a transparent station-based policy: minimum BDT 10, then BDT 10 per station, with 50% student fare and BDT 10 minimum student fare. For CNG and ride-hailing, it gives honest estimates based on distance and rate tables rather than pretending to have live Pathao or Uber prices.

The first version is intentionally focused: scrape route data, seed a local database, calculate fares, and show results in a clean ChatGPT-like interface. Every result includes a "Report wrong info" action, because Dhaka transport data changes and the community needs a way to keep it alive.

Long term, RouteGPT is more than a chat app. It can become a structured, verified Dhaka transport dataset that helps commuters, city planners, researchers, NGOs, and future mobility platforms understand how the city actually moves.

## Demo Story

Imagine a student needs to go from Gabtoli to Mirpur 1.

They open RouteGPT and type:

```text
Gabtoli theke Mirpur 1 bus e jabo
```

RouteGPT replies with matching buses, the route direction, the general fare, and the student fare:

```text
Bus: Achim Paribahan
Route: Gabtoli -> Technical -> Ansar Camp -> Mirpur 1
General fare: BDT 40
Student fare: BDT 20
```

If the user asks without mentioning a mode:

```text
Mirpur 10 to Motijheel
```

RouteGPT compares all available options:

- Bus routes from the local database.
- CNG fare estimate.
- Pathao Bike and Car estimate.
- Uber Moto and Go estimate.

The user gets one clear answer instead of opening multiple apps or relying on guesswork.

## Why This Matters

RouteGPT matters because it solves a real daily problem for a massive user base.

Dhaka commuters do not need perfect transport infrastructure before they can get better information. Even a practical route and fare assistant can reduce confusion, save time, and help people avoid unfair fares.

The product is also built around local behavior. People in Dhaka often do not type formal Bengali or formal English. They type Banglish. RouteGPT respects that from day one.

## Closing Line

RouteGPT turns Dhaka's informal transport knowledge into a simple chat assistant anyone can use.
