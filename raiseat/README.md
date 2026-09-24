# 🍚 raiseat — Smart Malaysian Meal Planner

**"I tell you my route, budget, ingredients, people, and preferences. The system figures out what I can cook, where to buy ingredients, how much it costs, and how many people I can feed."**

raiseat is a Malaysia-first food planning app: recipe recommender, pantry/fridge assistant, budget optimizer, shopping list builder, weekly meal planner, travel food planner, and food-waste reducer in one. It runs entirely in the browser on realistic demo data — no account, no API keys.

## Features

- **Natural-language assistant** — type *"I have chicken, eggs, rice and RM30 for 5 people"* and get ranked, explained recommendations. Understands budgets (RM), people counts, time limits, cuisines (Kelantan, Sabah, Sarawak…), expiring-food requests, and road-trip routes.
- **Transparent recommendations** — every recipe card shows total cost, cost/person, ingredient match %, what you're missing, and *why* it was recommended.
- **Pantry with expiry tracking** — fridge/freezer/pantry/counter locations, "Use these first" alerts, and rescue recipes for expiring ingredients.
- **Cost engine** — per-ingredient breakdown (Highcharts), low–high ranges with confidence levels, serving-count scaling, cook-vs-eat-out savings.
- **Shopping list** — missing ingredients from any recipe or the whole week's meal plan, quantities combined across recipes, grouped by supermarket section, with pack-size suggestions ("buy the 200g packet instead").
- **Weekly meal planner** — manual or one-click generated week that reuses proteins across days (buy 1 kg chicken once, cook it three ways), with weekly cost estimate.
- **Budget dashboard** — monthly budget tracking with Highcharts, plus a 4-strategy optimizer (Cheapest / Best value / Healthier / Fastest) for "RM20, feed 6 people".
- **Travel food planner** — 5 demo routes (KL→Penang, KL→Kota Bharu, PJ→JB, KK→Kundasang, Kuching→Sibu) with stop-by-stop food suggestions, trip cost estimates (fuel/tolls/food), local specialties, and a *Cook While Travelling* mode matching recipes to available equipment.
- **31 original Malaysian recipes** — nasi lemak, nasi kuning, nasi kerabu, ayam percik, nasi dagang, Sarawak laksa, kolo mee, hinava, char kuey teow, rendang, and more, with Malay units (biji, ikat, bungkus).

## Tech stack

Bun · React 19 · TypeScript (strict) · Vite · React Router · Bootstrap 5 · Highcharts. No backend required; Cloudflare Pages-compatible static build.

## Architecture

```
src/
├── pages/          # Route-level screens (lazy-loaded)
├── components/     # Reusable UI (AppShell, RecipeCard, ServingSelector, …)
├── services/       # Business logic, UI-free:
│   ├── recommend.ts    # scoring/ranking engine + budget optimizer
│   ├── cost.ts         # cost estimation with confidence bands
│   ├── shopping.ts     # list building + quantity merging
│   ├── intent.ts       # natural-language → structured intent
│   └── providers.ts    # pluggable external-API abstraction (demo fallback)
├── data/           # Demo seed data (ingredients, recipes, routes, places)
├── state/          # AppContext: pantry/shopping/plan/prefs, localStorage-persisted
├── types/          # Domain model (Ingredient, Recipe, CostEstimate, …)
└── utils/          # Formatting (RM, quantities, expiry)
```

Business logic never touches the DOM — `services/` functions are pure and unit-testable, and the UI can later swap demo data for a real backend without rewrites.

## Development

```sh
bun install
bun dev        # http://localhost:5173
bun run build  # production build → dist/
bun run lint
```

## Environment variables

None are required. `.env.example` documents optional keys for future live providers (pricing, maps, places, currency). Never commit `.env`. When a key is absent the matching provider falls back to demo data, clearly labelled "Demo data / estimated local price" in the UI.

## Adding content

- **Recipe**: append to `src/data/recipes.ts` — ingredient quantities are for `baseServings` and must use each ingredient's canonical unit from `ingredients.ts`. Costs, scaling, matching and shopping integration come free.
- **Ingredient**: append to `src/data/ingredients.ts` with an estimated MYR `pricePerUnit`, `shelfLifeDays`, and optionally a retail `pack` for shopping suggestions.
- **Route**: append to `src/data/travel.ts` with stops (km, price ranges) and specialties.
- **Price provider**: implement `FoodPriceProvider` in `src/services/providers.ts` and wire it in `getPricingProvider()` behind an env key.

## Honest-data principles

- Demo prices are labelled as estimates with confidence levels — never presented as live.
- "Halal-friendly ingredients" is an ingredient-level heuristic, explicitly *not* certification; restaurant halal status is marked "user-reported".
- Dietary filters are user preferences, not verified dietary information.

## Roadmap

Phase 4–5 ideas: real pricing/places providers, i18n (Malay first — `nameMs` fields already exist), offline PWA, price history charts, household portioning by age group, multi-currency.
