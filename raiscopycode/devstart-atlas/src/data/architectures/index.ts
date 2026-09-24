import type { Architecture } from "../../types";

// Architecture cookbook. A recurring theme, on purpose:
// more architecture does not automatically mean better architecture.

export const architectures: Architecture[] = [
  {
    id: "simple",
    name: "Simple Architecture",
    summary: "One project, a few folders, minimal ceremony. The right choice more often than people admit.",
    whatIsIt:
      "A single project with a handful of folders (routes, services, db). No layers-for-the-sake-of-layers, no interfaces with one implementation. Code is organized by what it does, and that's it.",
    whyUse: [
      "Fastest possible start and iteration speed",
      "Every developer understands it in five minutes",
      "Refactoring to a bigger architecture later is straightforward when the code is small",
    ],
    whenToUse: [
      "Prototypes and MVPs",
      "Small tools, internal apps, single-purpose services",
      "Teams of 1–2 people",
      "Projects with an expected lifetime under a year",
    ],
    whenNotToUse: [
      "Complex business domains with many rules",
      "Large teams working in the same codebase",
      "Systems expected to live and grow for many years",
    ],
    folderStructure: `src/
├── routes/          # HTTP endpoints
├── services/        # business logic
├── db/              # database access
├── utils/
└── index.ts         # entry point`,
    folders: ["src/routes", "src/services", "src/db", "src/utils"],
    dependencyDirection: "routes → services → db. Keep HTTP concerns in routes and SQL in db; services hold the logic in between.",
    advantages: ["Minimal boilerplate", "Fast onboarding", "Easy to change everything at once"],
    disadvantages: ["Structure erodes as the app grows", "Business logic can leak into routes if undisciplined"],
    commonMistakes: [
      "Adding repositories, mediators and CQRS to a 5-endpoint app",
      "Skipping the services folder and writing logic directly in route handlers",
    ],
    relatedPatterns: ["dependency-injection"],
    comparison: { complexity: 1, boilerplate: 1, scalability: 3, bestFor: "Small projects, prototypes" },
  },
  {
    id: "layered",
    name: "Layered Architecture",
    summary: "Horizontal layers: presentation, business, data access. The classic business-app structure.",
    whatIsIt:
      "Code is split into horizontal layers — presentation (controllers), business logic (services), and data access (repositories) — where each layer only calls the one below it.",
    whyUse: [
      "Familiar to almost every developer",
      "Clear home for each kind of code",
      "Testable business layer when data access is behind interfaces",
    ],
    whenToUse: ["Typical business applications (CRUD + rules)", "Teams of 2–10", "Apps expected to live 1–5 years"],
    whenNotToUse: [
      "Very small apps (overhead without payoff)",
      "Domains so complex that features cut across all layers constantly — consider vertical slices",
    ],
    folderStructure: `src/
├── Controllers/     # presentation layer
├── Services/        # business logic layer
├── Repositories/    # data access layer
├── Models/          # entities and DTOs
└── Data/            # DbContext / connection setup`,
    folders: ["src/Controllers", "src/Services", "src/Repositories", "src/Models", "src/Data"],
    dependencyDirection: "Controllers → Services → Repositories → Database. Dependencies point strictly downward; lower layers never know about upper ones.",
    advantages: ["Well understood", "Separation of concerns", "Easy to test the middle layer"],
    disadvantages: [
      "A single feature change touches every layer",
      "Layers tend to become pass-through boilerplate for simple CRUD",
    ],
    commonMistakes: [
      "Anemic services that just forward calls to repositories",
      "Letting entities leak into API responses instead of using DTOs",
    ],
    relatedPatterns: ["repository", "dependency-injection", "unit-of-work"],
    comparison: { complexity: 2, boilerplate: 3, scalability: 3, bestFor: "Business apps" },
  },
  {
    id: "clean",
    name: "Clean Architecture",
    summary: "Domain at the center, dependencies point inward, infrastructure at the edge.",
    whatIsIt:
      "Concentric rings: Domain (entities, business rules) at the core, Application (use cases, interfaces) around it, and Infrastructure + Presentation at the edge. All dependencies point inward — the domain knows nothing about databases, frameworks or HTTP.",
    whyUse: [
      "Business rules are isolated and testable without a database or web server",
      "Infrastructure (ORM, message bus, email provider) is swappable",
      "Scales well for long-lived systems with real domain logic",
    ],
    whenToUse: [
      "Long-lived systems (5+ years)",
      "Complex business domains",
      "Teams that need enforced boundaries",
    ],
    whenNotToUse: [
      "CRUD apps with little domain logic — you'll write mountains of mapping code for nothing",
      "Prototypes and small tools",
    ],
    folderStructure: `src/
├── Domain/              # entities, value objects, domain events
│   └── Entities/
├── Application/         # use cases, interfaces, DTOs
│   ├── Interfaces/
│   └── Services/
├── Infrastructure/      # EF Core, external services, implementations
│   └── Persistence/
└── Api/                 # controllers, DI wiring, middleware
    └── Controllers/`,
    folders: [
      "src/Domain/Entities",
      "src/Application/Interfaces",
      "src/Application/Services",
      "src/Infrastructure/Persistence",
      "src/Api/Controllers",
      "tests/UnitTests",
      "tests/IntegrationTests",
    ],
    dependencyDirection:
      "Api → Application → Domain, and Infrastructure → Application → Domain. Domain depends on nothing. Application defines interfaces (e.g. IUserRepository); Infrastructure implements them; Api wires them together with DI.",
    example:
      "A CreateUser request flows: Controller → Application service (validates, applies rules) → IUserRepository (interface in Application) → EF Core repository (Infrastructure) → PostgreSQL.",
    advantages: ["Highly testable core", "Swappable infrastructure", "Enforced boundaries survive team growth"],
    disadvantages: ["Significant boilerplate (DTOs, interfaces, mapping)", "Overkill for simple apps", "Steeper onboarding"],
    commonMistakes: [
      "Applying it to a 10-endpoint CRUD API",
      "Putting business logic in controllers anyway, defeating the point",
      "Referencing Infrastructure from Application 'just this once'",
    ],
    relatedPatterns: ["repository", "dependency-injection", "unit-of-work", "result", "mediator"],
    comparison: { complexity: 4, boilerplate: 4, scalability: 4, bestFor: "Long-lived systems" },
  },
  {
    id: "onion",
    name: "Onion Architecture",
    summary: "Clean Architecture's close sibling: domain core, service rings, infrastructure crust.",
    whatIsIt:
      "Layers arranged as concentric rings around a domain model core: Domain Model → Domain Services → Application Services → outer ring (UI, infrastructure, tests). Like Clean Architecture, all coupling points toward the center.",
    whyUse: ["Same benefits as Clean Architecture with slightly different vocabulary", "Strong domain isolation"],
    whenToUse: ["Domain-heavy long-lived systems", "Teams already fluent in the onion vocabulary"],
    whenNotToUse: ["Simple CRUD apps", "Short-lived projects"],
    folderStructure: `src/
├── Core/
│   ├── Domain/            # entities, value objects
│   └── DomainServices/    # cross-entity domain logic
├── Application/           # application services, interfaces
├── Infrastructure/        # persistence, external services
└── Web/                   # API / UI`,
    folders: ["src/Core/Domain", "src/Core/DomainServices", "src/Application", "src/Infrastructure", "src/Web"],
    dependencyDirection: "All dependencies point inward to Core. Infrastructure and Web are the outermost ring and are replaceable.",
    advantages: ["Testable domain core", "Clear separation"],
    disadvantages: ["Same boilerplate cost as Clean Architecture", "Terminology varies between teams"],
    commonMistakes: ["Debating Onion vs Clean instead of shipping — they are ~90% the same idea"],
    relatedPatterns: ["repository", "dependency-injection"],
    comparison: { complexity: 4, boilerplate: 4, scalability: 4, bestFor: "Domain-heavy systems" },
  },
  {
    id: "hexagonal",
    name: "Hexagonal (Ports & Adapters)",
    summary: "The app core exposes ports; adapters plug the outside world into them.",
    whatIsIt:
      "The application core defines 'ports' (interfaces) for everything it needs (driven ports: database, email) and everything that drives it (driving ports: HTTP, CLI, queue consumers). 'Adapters' implement those ports. The core never knows which adapter is talking to it.",
    whyUse: [
      "Multiple entry points (HTTP + queue + CLI) share the same core logic",
      "Infrastructure is trivially swappable and mockable",
    ],
    whenToUse: ["Services with several transports or integrations", "Systems where you expect infrastructure churn"],
    whenNotToUse: ["Single-transport CRUD apps", "Very small services"],
    folderStructure: `src/
├── core/
│   ├── domain/           # entities, logic
│   └── ports/            # interfaces (in + out)
├── adapters/
│   ├── in/
│   │   ├── http/         # REST controllers
│   │   └── queue/        # message consumers
│   └── out/
│       ├── persistence/  # database adapter
│       └── email/        # email adapter
└── config/               # wiring / DI`,
    folders: [
      "src/core/domain",
      "src/core/ports",
      "src/adapters/in/http",
      "src/adapters/out/persistence",
      "src/config",
    ],
    dependencyDirection: "Adapters depend on the core (via ports). The core depends on nothing external.",
    advantages: ["Excellent testability", "True transport independence"],
    disadvantages: ["Interface overhead", "Can feel abstract for newcomers"],
    commonMistakes: ["Creating ports for things that will never have a second implementation"],
    relatedPatterns: ["adapter", "dependency-injection", "repository"],
    comparison: { complexity: 4, boilerplate: 4, scalability: 4, bestFor: "Multi-transport services" },
  },
  {
    id: "vertical-slice",
    name: "Vertical Slice Architecture",
    summary: "Organize by feature, not by layer. Each slice owns its request, handler and data access.",
    whatIsIt:
      "Instead of horizontal layers, code is grouped by feature: each slice (e.g. CreateUser, GetOrders) contains its endpoint, validation, handler and query in one place. Slices minimize coupling between features rather than between layers.",
    whyUse: [
      "A feature change touches one folder, not four layers",
      "Each slice can be as simple or as sophisticated as it needs",
      "Pairs naturally with mediator-style handlers",
    ],
    whenToUse: ["Feature-heavy APIs", "Teams that ship features in parallel", "Apps where CRUD and complex features coexist"],
    whenNotToUse: ["Heavy shared domain logic across features (you'll fight duplication)", "Tiny apps"],
    folderStructure: `src/
├── Features/
│   ├── Users/
│   │   ├── CreateUser.cs      # request + validator + handler + endpoint
│   │   ├── GetUser.cs
│   │   └── DeleteUser.cs
│   └── Orders/
│       ├── CreateOrder.cs
│       └── GetOrders.cs
├── Common/                    # shared behaviors, base types
└── Infrastructure/            # DbContext, DI`,
    folders: ["src/Features/Users", "src/Features/Orders", "src/Common", "src/Infrastructure"],
    dependencyDirection: "Slices depend on Common/Infrastructure, never on each other. Cross-slice reuse gets promoted into Common deliberately.",
    advantages: ["High cohesion per feature", "Low ceremony for simple features", "Easy parallel work"],
    disadvantages: ["Duplication between slices if unmanaged", "Shared domain rules need a deliberate home"],
    commonMistakes: ["Extracting shared abstractions too early — let duplication prove itself first"],
    relatedPatterns: ["mediator", "pipeline"],
    comparison: { complexity: 3, boilerplate: 3, scalability: 4, bestFor: "Feature-heavy APIs" },
  },
  {
    id: "modular-monolith",
    name: "Modular Monolith",
    summary: "One deployable, strictly separated modules. Microservice boundaries without the network.",
    whatIsIt:
      "A single deployed application internally divided into modules (Users, Billing, Catalog…), each with its own public API, internal implementation, and often its own database schema. Modules communicate through explicit contracts, never by reaching into each other's internals.",
    whyUse: [
      "Team-scale boundaries without distributed-systems pain",
      "A proven stepping stone: modules can be extracted to services later if genuinely needed",
      "One deployment, one transaction scope, easy local dev",
    ],
    whenToUse: ["Large applications with multiple business areas", "Teams of 10+", "Systems that might someday need microservices"],
    whenNotToUse: ["Small apps (module ceremony is wasted)", "Truly independent products that never interact"],
    folderStructure: `src/
├── Modules/
│   ├── Users/
│   │   ├── Users.Api/          # public contracts
│   │   ├── Users.Core/         # domain + logic
│   │   └── Users.Infrastructure/
│   └── Billing/
│       ├── Billing.Api/
│       ├── Billing.Core/
│       └── Billing.Infrastructure/
├── Shared/                     # cross-cutting kernel (kept tiny)
└── Host/                       # composition root, HTTP host`,
    folders: [
      "src/Modules/Users/Users.Api",
      "src/Modules/Users/Users.Core",
      "src/Modules/Users/Users.Infrastructure",
      "src/Shared",
      "src/Host",
    ],
    dependencyDirection: "Host → module APIs. Modules depend only on other modules' public API projects, never their Core/Infrastructure.",
    advantages: ["Strong boundaries, simple ops", "Refactor-friendly", "Extraction path to services"],
    disadvantages: ["Requires discipline (nothing physically stops cross-module reach-ins)", "Up-front module design effort"],
    commonMistakes: ["A 'Shared' module that grows into a god module", "Modules sharing database tables"],
    relatedPatterns: ["facade", "mediator", "dependency-injection"],
    comparison: { complexity: 4, boilerplate: 3, scalability: 4, bestFor: "Large applications" },
  },
  {
    id: "microservices",
    name: "Microservices",
    summary: "Independently deployable services per business capability. Powerful — and expensive.",
    whatIsIt:
      "The system is split into separately deployed services, each owning its data and communicating over the network (HTTP, gRPC, messaging). Enables independent scaling, deployment and team autonomy — at the cost of distributed-systems complexity.",
    whyUse: [
      "Independent deployment and scaling per service",
      "Team autonomy at large organization scale",
      "Fault isolation between capabilities",
    ],
    whenToUse: [
      "Many teams that genuinely need independent release cadence",
      "Wildly different scaling profiles per capability",
      "Organizational scale where a monolith's coordination cost exceeds distribution cost",
    ],
    whenNotToUse: [
      "Startups and small teams — premature microservices is one of the most common architecture mistakes",
      "Any system where you can't yet draw stable service boundaries",
    ],
    folderStructure: `platform/
├── services/
│   ├── users-service/       # own repo or folder, own DB
│   ├── billing-service/
│   └── catalog-service/
├── gateway/                 # API gateway / BFF
├── contracts/               # shared API schemas (OpenAPI/proto)
└── infra/                   # IaC, k8s manifests, pipelines`,
    folders: ["services/users-service", "services/billing-service", "gateway", "contracts", "infra"],
    dependencyDirection: "Services never share databases. Communication via versioned contracts (REST/gRPC/events) only.",
    advantages: ["Independent scaling and deploys", "Tech freedom per service", "Fault isolation"],
    disadvantages: [
      "Distributed transactions, eventual consistency, network failures",
      "Heavy ops investment (observability, service discovery, CI/CD per service)",
      "Local development complexity",
    ],
    commonMistakes: [
      "Starting with microservices before understanding the domain — start with a modular monolith",
      "A 'distributed monolith': services that must deploy together",
      "Sharing a database between services",
    ],
    relatedPatterns: ["circuit-breaker", "retry", "facade"],
    comparison: { complexity: 5, boilerplate: 5, scalability: 5, bestFor: "Distributed systems, large orgs" },
  },
  {
    id: "ddd",
    name: "Domain-Driven Design",
    summary: "Model the business domain explicitly: bounded contexts, aggregates, ubiquitous language.",
    whatIsIt:
      "Less a folder layout than a design discipline: the code models the business domain using the language domain experts use. Strategic DDD splits the system into bounded contexts; tactical DDD structures each context with aggregates, entities, value objects, domain events and repositories.",
    whyUse: [
      "Complex business rules stay coherent as the system grows",
      "Shared language between developers and domain experts reduces mistranslation bugs",
    ],
    whenToUse: ["Genuinely complex business domains (insurance, logistics, finance)", "Long-lived systems with domain experts available"],
    whenNotToUse: ["CRUD apps — DDD ceremony without domain complexity is pure overhead", "Prototypes"],
    folderStructure: `src/
├── Domain/
│   ├── Users/               # aggregate
│   │   ├── User.cs          # aggregate root
│   │   ├── Email.cs         # value object
│   │   └── UserRegistered.cs # domain event
│   └── Orders/
├── Application/             # use cases orchestrating aggregates
├── Infrastructure/
└── Api/`,
    folders: ["src/Domain/Users", "src/Domain/Orders", "src/Application", "src/Infrastructure", "src/Api"],
    dependencyDirection: "Same inward direction as Clean Architecture; the difference is the richness of the Domain layer.",
    advantages: ["Handles true complexity", "Durable shared understanding"],
    disadvantages: ["High skill and time investment", "Easy to cargo-cult badly"],
    commonMistakes: ["Anemic domain models (entities as bags of getters, logic in services)", "Applying tactical patterns without strategic design"],
    relatedPatterns: ["repository", "specification", "factory", "result"],
    comparison: { complexity: 5, boilerplate: 4, scalability: 4, bestFor: "Complex domains" },
  },
  {
    id: "cqrs",
    name: "CQRS",
    summary: "Separate models for writing (commands) and reading (queries).",
    whatIsIt:
      "Command Query Responsibility Segregation: writes go through command handlers that enforce business rules; reads use separate, often denormalized query paths optimized for display. Can be as light as 'two folders' or as heavy as separate read/write databases with event sourcing.",
    whyUse: [
      "Read and write workloads have very different shapes",
      "Complex write rules but high-volume simple reads",
      "Pairs well with vertical slices and mediator handlers",
    ],
    whenToUse: ["Read-heavy systems with complex writes", "When query DTOs and domain models keep fighting each other"],
    whenNotToUse: ["Simple CRUD — CQRS + event sourcing on a todo app is the canonical overengineering story"],
    folderStructure: `src/
├── Commands/
│   ├── CreateOrder/
│   │   ├── CreateOrderCommand.cs
│   │   └── CreateOrderHandler.cs
├── Queries/
│   ├── GetOrders/
│   │   ├── GetOrdersQuery.cs
│   │   └── GetOrdersHandler.cs
├── Domain/
└── Infrastructure/`,
    folders: ["src/Commands", "src/Queries", "src/Domain", "src/Infrastructure"],
    dependencyDirection: "Commands mutate through the domain model; queries may bypass it and read directly (e.g. Dapper/raw SQL) for speed.",
    advantages: ["Each side optimized independently", "Clear intent per operation"],
    disadvantages: ["Two models to maintain", "Event-sourced variants add eventual consistency"],
    commonMistakes: ["Assuming CQRS requires event sourcing or separate databases — it doesn't"],
    relatedPatterns: ["mediator", "pipeline", "repository"],
    comparison: { complexity: 4, boilerplate: 4, scalability: 5, bestFor: "Read-heavy, complex-write systems" },
  },
  {
    id: "feature-based",
    name: "Feature-Based (Frontend)",
    summary: "Frontend code grouped by feature with a shared foundation — the sane default for React apps.",
    whatIsIt:
      "A frontend structure where each feature (auth, dashboard, settings) owns its components, hooks, api calls and state, on top of a small shared layer (ui kit, api client, utilities).",
    whyUse: ["Features stay cohesive and deletable", "Avoids the giant flat components/ folder", "Scales with team size"],
    whenToUse: ["Any React/Vue app beyond a handful of screens"],
    whenNotToUse: ["Tiny apps with 3–4 components"],
    folderStructure: `src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── api.ts
│   └── dashboard/
│       ├── components/
│       └── hooks/
├── components/        # shared UI kit
├── lib/               # api client, utils
├── routes/
└── App.tsx`,
    folders: ["src/features/auth", "src/features/dashboard", "src/components", "src/lib", "src/routes"],
    dependencyDirection: "Features depend on shared components/lib; features never import from each other directly.",
    advantages: ["Deletable features", "Clear ownership", "Less merge conflict surface"],
    disadvantages: ["Judgment calls on what is 'shared'"],
    commonMistakes: ["Promoting one-off components to shared too early"],
    relatedPatterns: [],
    comparison: { complexity: 2, boilerplate: 2, scalability: 4, bestFor: "Frontend apps" },
  },
];

export const architectureById = new Map(architectures.map((a) => [a.id, a]));

// Rendered as the interactive comparison scale.
export const comparisonScale = ["", "Low", "Medium", "Medium-High", "High", "Very High"] as const;
