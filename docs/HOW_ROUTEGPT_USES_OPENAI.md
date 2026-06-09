# How RouteGPT Uses OpenAI

RouteGPT combines OpenAI language models with a structured Dhaka transport database.

The OpenAI model is not responsible for generating transport routes, fares, or transport facts. Instead, it acts as an intelligent language interface that understands how users naturally ask questions.

For example, a commuter may type:

```text
bashundhara theke jatrabari bus e jabo
```

or

```text
mirpur 10 to motijheel
```

The OpenAI model extracts key information from the message:

- Origin location
- Destination location
- Transport preference, if mentioned
- Student fare intent, if mentioned

After extracting these entities, RouteGPT queries its own local transport database. The database contains verified bus routes, stops, route directions, station relationships, and fare calculation rules.

This architecture prevents hallucinations because route information does not come from the language model. The model performs understanding, while the database provides facts.

## Agentic Workflow

RouteGPT follows a simple agentic workflow:

1. User sends a natural-language transport query.
2. OpenAI model interprets the request.
3. The system extracts structured parameters.
4. A route-search agent queries the local transport database.
5. A fare-calculation agent computes:
   - Bus fare
   - Student fare
   - CNG estimate
   - Pathao estimate
   - Uber estimate
6. The response formatter generates a clean conversational answer.
7. Users can submit corrections through the "Report Wrong Info" feature.

This creates a retrieval-and-reasoning workflow where AI handles language understanding while deterministic systems handle transportation facts.

## OpenAI API Usage

OpenAI APIs are used for:

- Natural language understanding
- Bangla, English, and Banglish interpretation
- Entity extraction for origin, destination, and transport mode
- Query classification
- Response generation

Examples of supported user inputs:

- "Gabtoli theke Mirpur 1 bus e jabo"
- "Motijheel to Uttara"
- "Student fare koto?"
- "CNG vs Bus"

The same backend can understand different writing styles without requiring users to learn specific commands.

## AGENTS.md / Custom Agents

RouteGPT can be implemented using a custom transport agent defined in `AGENTS.md`.

Example responsibilities:

### Transport Understanding Agent

- Extract origin and destination
- Detect transport mode
- Normalize stop names

### Route Search Agent

- Find matching routes
- Rank route relevance

### Fare Calculation Agent

- Calculate bus fare
- Apply student discounts
- Estimate ride-hailing costs

### Response Agent

- Convert structured results into natural conversation
- Generate concise commuter-friendly answers

This separation makes the system easier to maintain, test, and scale as new transport modes and routes are added.

## Why OpenAI Matters

OpenAI enables RouteGPT to behave like a transport assistant rather than a search form.

Users can communicate naturally in Bangla, English, or Banglish, while the system converts those messages into structured transport queries. This significantly reduces friction and makes public transport information more accessible to everyday Dhaka commuters.
