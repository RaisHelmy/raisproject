# RaisTravel — DIY Travel Planner

A production-quality DIY trip planner for Malaysian travellers (with international destinations).
Tell it where you want to go, how much you want to spend, and how you want to travel — it builds
the best DIY trip, with the full cost known before you go.

## Run

```bash
bun install
bun dev        # http://localhost:5173
bun run build  # production build (strict TypeScript + Vite)
bun run lint   # oxlint
```

**Demo mode:** the app works fully without API credentials. All providers are realistic mocks,
clearly labelled "Demo data" / "Estimated" — no price is ever presented as live.

## What it does

- **Three planning modes** — "I know where I want to go", "I have a budget" (destination matching
  with budget-utilisation %), and "Inspire me" (interest-driven suggestions).
- **7-step wizard** — origin, destinations (drag to reorder, inline route optimizer), dates/duration,
  travellers (occupancy-aware room options), travel style + spend sliders, budget (total / per person
  / daily), interests. Sticky trip summary (sidebar on desktop, bottom bar on mobile).
- **Curated route library** — 23 predefined Malaysian + international routes with distances, legs,
  seasons, difficulty and per-person estimates, all customizable.
- **Four generated plans per trip** — Cheapest / Best Value / Comfort / Premium, with one
  recommended based on style + budget fit, and a "why we recommend this" explanation.
- **Complete cost engine** — transport (fuel by vehicle preset incl. EV, tolls, parking, ferries,
  flights, buses/trains), accommodation by room count, food per destination per tier, activities
  (mandatory/recommended/optional), insurance, misc, emergency buffer. Totals per trip / person /
  day.
- **Smart cost optimizer** — when over budget, concrete one-click suggestions (lower tier, switch
  transport mode, shorten trip, drop a stop) with the exact saving each unlocks.
- **Route optimizer** — exhaustive search over stop orderings, reporting km / time / RM saved.
- **Hotel comparison** — Booking.com / Agoda / Expedia mock providers behind an
  `AccommodationProvider` interface, merged into one comparison table with taxes/fees shown and
  the lowest quote highlighted.
- **Flight comparison** — airline options with sort (cheapest/fastest), baggage and per-person fares.
- **Itinerary** — realistic day-by-day timeline (paced gently for families), per-day schematic map,
  costs per item.
- **Highcharts budget visuals** — category donut, daily spend columns, budget-vs-estimate and
  estimated-vs-actual bars.
- **Trip score & travel fatigue** — budget/convenience/experience/travel-time subscores; high
  transport hours trigger pacing advice.
- **Saved trips** — statuses (planning → completed), actual expense tracking with variance,
  group cost-split settlement, extensible checklists. Persisted in localStorage.
- **Price alerts** — local UI now; architecture notes for Cloudflare Workers cron + notifications.
- **Extras** — share links (encoded trip in URL), print/PDF export, display-currency switcher,
  Muslim-friendly preference, travel document checklist with official-source links, provider
  status/admin screen.

## Architecture

```
src/
├── components/          # Reusable UI (badges, charts, maps, timelines, cards, skeletons)
├── pages/               # Route-level screens (lazy-loaded)
├── layouts/             # App shell (nav, footer)
├── features/
│   ├── budget/          # Cost engine + smart savings optimizer
│   └── trip-planner/    # Plan/itinerary generator, route optimizer, scoring
├── services/            # Provider abstractions + mock providers + registry
├── hooks/               # Stores (planner input, saved trips, alerts) via useSyncExternalStore
├── types/               # Domain model (strict TypeScript)
├── utils/               # Formatting, geo/distance estimation
├── data/                # Destinations (33), routes (23), vehicle presets
└── styles/              # Design system layered over Bootstrap 5
```

Key principles:

- **Provider abstraction everywhere.** UI never talks to a specific provider; mocks and real APIs
  are interchangeable. `/providers` shows the registry status.
- **No secrets in the frontend.** Real integrations belong behind a backend/Cloudflare Worker;
  booking is via affiliate/deep links only — the app never books on the user's behalf.
- **Honest pricing.** Every number carries a confidence level (live / estimated / historical) and
  the UI labels it.
- **Business logic lives in `features/`**, not in page components — pages compose and render.

Stack: Bun · React 19 · TypeScript (strict) · Vite · Bootstrap 5 (custom design system) ·
React Router 7 · Highcharts.
