/**
 * RAIS HELMY — Tips Registry
 * Central metadata for all tip slides.
 * Used by the tips listing page (/tips) for search, dropdown, and SEO.
 *
 * Each entry: { id, title, description, category, tags[], date, slug }
 * sorted newest first (used for "10 recent" dropdown).
 */
window.TIPS_REGISTRY = [
  {
    id:          'dotnet-best-practices',
    slug:        'dotnet-best-practices',
    title:       '.NET Best Practices — Expectation vs Reality',
    description: 'Clean Architecture, CQRS, rich domain models, and proper error handling. What the books say vs what teams actually ship.',
    category:    '.NET',
    tags:        ['#dotnet','#cleanarchitecture','#cqrs','#softwareengineering'],
    date:        '2026-04-01',
    slides:      8
  },
  {
    id:          'async-await-gotchas',
    slug:        'async-await-gotchas',
    title:       'Async/Await Gotchas in .NET',
    description: 'ConfigureAwait, deadlocks, fire-and-forget, ValueTask — the async mistakes that kill production apps.',
    category:    '.NET',
    tags:        ['#async','#dotnet','#performance','#csharp'],
    date:        '2026-04-02',
    slides:      7
  },
  {
    id:          'dependency-injection-lifetimes',
    slug:        'dependency-injection-lifetimes',
    title:       'DI Lifetimes: Singleton, Scoped, Transient',
    description: 'The most misunderstood part of ASP.NET dependency injection. Captive dependencies, scope validation, and when lifetimes bite you.',
    category:    '.NET',
    tags:        ['#di','#dotnet','#aspnetcore','#architecture'],
    date:        '2026-04-03',
    slides:      7
  },
  {
    id:          'ef-core-performance',
    slug:        'ef-core-performance',
    title:       'Entity Framework Core Performance Anti-Patterns',
    description: 'N+1 queries, missing AsNoTracking, loading entire tables — the EF Core mistakes that destroy query performance.',
    category:    '.NET',
    tags:        ['#entityframework','#dotnet','#database','#performance'],
    date:        '2026-04-04',
    slides:      7
  },
  {
    id:          'middleware-pipeline-order',
    slug:        'middleware-pipeline-order',
    title:       'ASP.NET Middleware: Order Matters',
    description: 'The request pipeline is not a random list. Wrong middleware order causes auth bypasses, CORS failures, and broken error handling.',
    category:    'ASP.NET',
    tags:        ['#middleware','#aspnetcore','#dotnet','#security'],
    date:        '2026-04-05',
    slides:      7
  },
  {
    id:          'configuration-secrets',
    slug:        'configuration-secrets',
    title:       'Configuration & Secrets Management in .NET',
    description: 'Options pattern, Secret Manager, Azure Key Vault, and environment-specific config. Stop hardcoding secrets.',
    category:    '.NET',
    tags:        ['#configuration','#secrets','#dotnet','#security'],
    date:        '2026-04-06',
    slides:      7
  },
  {
    id:          'unit-testing-strategies',
    slug:        'unit-testing-strategies',
    title:       'Unit Testing .NET: What Actually Works',
    description: 'Arrange/Act/Assert, Moq, FluentAssertions, test doubles — building a test suite that actually catches bugs.',
    category:    'Testing',
    tags:        ['#testing','#dotnet','#unittesting','#tdd'],
    date:        '2026-04-07',
    slides:      7
  },
  {
    id:          'api-versioning',
    slug:        'api-versioning',
    title:       'REST API Versioning Done Right',
    description: 'URL, header, and media-type versioning in ASP.NET Core. Breaking changes without breaking clients.',
    category:    'API',
    tags:        ['#api','#versioning','#aspnetcore','#restapi'],
    date:        '2026-04-08',
    slides:      7
  },
  {
    id:          'background-services',
    slug:        'background-services',
    title:       'Background Services: IHostedService vs Worker',
    description: 'Long-running tasks, scheduled jobs, and message consumers in .NET. IHostedService, BackgroundService, and Worker Service compared.',
    category:    '.NET',
    tags:        ['#backgroundservices','#dotnet','#aspnetcore','#workers'],
    date:        '2026-04-09',
    slides:      7
  },
  {
    id:          'caching-strategies',
    slug:        'caching-strategies',
    title:       'Caching in .NET: What to Use When',
    description: 'IMemoryCache vs IDistributedCache, cache-aside pattern, cache invalidation, and stampede prevention.',
    category:    '.NET',
    tags:        ['#caching','#dotnet','#performance','#redis'],
    date:        '2026-04-10',
    slides:      7
  },
  {
    id:          'exception-handling-middleware',
    slug:        'exception-handling-middleware',
    title:       'Global Exception Handling & ProblemDetails',
    description: 'RFC 7807 ProblemDetails, global middleware, custom domain exceptions, and structured error responses.',
    category:    'ASP.NET',
    tags:        ['#exceptions','#errorhandling','#aspnetcore','#dotnet'],
    date:        '2026-04-11',
    slides:      7
  },
  {
    id:          'jwt-authentication',
    slug:        'jwt-authentication',
    title:       'JWT Authentication in ASP.NET Core',
    description: 'Claims-based auth, refresh tokens, token validation, and the security pitfalls most teams miss.',
    category:    'Security',
    tags:        ['#jwt','#authentication','#aspnetcore','#security'],
    date:        '2026-04-12',
    slides:      7
  },
  {
    id:          'performance-profiling',
    slug:        'performance-profiling',
    title:       'Profiling & Benchmarking .NET Apps',
    description: 'BenchmarkDotNet, dotnet-trace, heap analysis, and finding real bottlenecks before they hit production.',
    category:    '.NET',
    tags:        ['#performance','#profiling','#dotnet','#benchmarking'],
    date:        '2026-04-13',
    slides:      7
  },
  {
    id:          'minimal-apis',
    slug:        'minimal-apis',
    title:       'Minimal APIs: When to Ditch Controllers',
    description: 'Minimal API vs MVC controllers — route groups, typed results, filters, and when the ceremony costs more than it gives.',
    category:    'ASP.NET',
    tags:        ['#minimalapi','#aspnetcore','#dotnet','#webapi'],
    date:        '2026-04-14',
    slides:      7
  },
  {
    id:          'nullable-reference-types',
    slug:        'nullable-reference-types',
    title:       'Nullable Reference Types Done Right',
    description: 'Enabling NRT, null coalescing patterns, guard clauses, and eliminating the billion-dollar mistake in your codebase.',
    category:    'C#',
    tags:        ['#nullable','#csharp','#dotnet','#codesafety'],
    date:        '2026-04-15',
    slides:      7
  },
  {
    id:          'records-and-value-objects',
    slug:        'records-and-value-objects',
    title:       'Records vs Value Objects vs Classes',
    description: 'When immutability helps, with-expressions, structural equality, and combining C# records with DDD value objects.',
    category:    'C#',
    tags:        ['#records','#csharp','#ddd','#immutability'],
    date:        '2026-04-16',
    slides:      7
  },
  {
    id:          'grpc-vs-rest',
    slug:        'grpc-vs-rest',
    title:       'gRPC vs REST: The Real Tradeoffs',
    description: 'When gRPC wins, when REST wins, Protocol Buffers, streaming, and service-to-service communication patterns.',
    category:    'Architecture',
    tags:        ['#grpc','#rest','#api','#architecture'],
    date:        '2026-04-17',
    slides:      7
  },
  {
    id:          'docker-dotnet-best-practices',
    slug:        'docker-dotnet-best-practices',
    title:       'Docker Best Practices for .NET',
    description: 'Multi-stage builds, non-root user, layer caching, slim base images, and health checks for containerized .NET apps.',
    category:    'DevOps',
    tags:        ['#docker','#dotnet','#devops','#containers'],
    date:        '2026-04-18',
    slides:      7
  },
  {
    id:          'rate-limiting-aspnet',
    slug:        'rate-limiting-aspnet',
    title:       'Rate Limiting in ASP.NET Core',
    description: 'Fixed window, sliding window, token bucket, and concurrency limits. Protecting your API from abuse.',
    category:    'ASP.NET',
    tags:        ['#ratelimiting','#aspnetcore','#dotnet','#security'],
    date:        '2026-04-19',
    slides:      7
  },
  {
    id:          'source-generators',
    slug:        'source-generators',
    title:       'Source Generators: Power & Pitfalls',
    description: 'Incremental source generators, logging source gen, JSON serialization, and when compile-time generation beats reflection.',
    category:    'C#',
    tags:        ['#sourcegenerators','#csharp','#dotnet','#roslyn'],
    date:        '2026-04-20',
    slides:      7
  },
  {
    id:          'pagination-patterns',
    slug:        'pagination-patterns',
    title:       'Pagination Patterns: Cursor vs Offset',
    description: 'Why offset pagination breaks at scale, cursor/keyset pagination, and building stable pagination APIs in EF Core.',
    category:    'API',
    tags:        ['#pagination','#api','#database','#dotnet'],
    date:        '2026-04-21',
    slides:      7
  },

  /* ─ React ─ */
  {
    id:          'react-performance-pitfalls',
    slug:        'react-performance-pitfalls',
    title:       'React Performance: 7 Pitfalls to Stop Now',
    description: 'memo, useMemo, useCallback, unnecessary re-renders, large bundles — the React mistakes that silently tank your app.',
    category:    'React',
    tags:        ['#react','#performance','#frontend','#javascript'],
    date:        '2026-04-22',
    slides:      7
  },
  {
    id:          'react-patterns-2025',
    slug:        'react-patterns-2025',
    title:       'React Patterns That Actually Scale',
    description: 'Compound components, render props vs hooks, custom hook patterns, and state management decisions that age well.',
    category:    'React',
    tags:        ['#react','#patterns','#frontend','#hooks'],
    date:        '2026-04-23',
    slides:      7
  },

  /* ─ AI / LLM ─ */
  {
    id:          'ai-prompting-for-devs',
    slug:        'ai-prompting-for-devs',
    title:       'Prompting for Developers: Get 10x More From LLMs',
    description: 'Chain-of-thought, role prompting, few-shot examples, and structured output — developer-specific LLM techniques that actually work.',
    category:    'AI',
    tags:        ['#ai','#llm','#prompting','#chatgpt'],
    date:        '2026-04-24',
    slides:      7
  },
  {
    id:          'ai-in-production',
    slug:        'ai-in-production',
    title:       'AI in Production: What No One Tells You',
    description: 'Hallucinations, latency, cost explosion, RAG pitfalls, and the operational realities of shipping LLM features to real users.',
    category:    'AI',
    tags:        ['#ai','#llm','#rag','#production'],
    date:        '2026-04-25',
    slides:      7
  },

  /* ─ Vibe Coding ─ */
  {
    id:          'vibe-coding-done-right',
    slug:        'vibe-coding-done-right',
    title:       'Vibe Coding: Ship Fast Without The Regrets',
    description: 'AI-assisted development is powerful — but momentum without judgment creates unmaintainable messes. Here\'s the balance.',
    category:    'Vibe Coding',
    tags:        ['#vibecoding','#ai','#cursor','#copilot'],
    date:        '2026-04-26',
    slides:      7
  },

  /* ─ Project Management ─ */
  {
    id:          'agile-myths',
    slug:        'agile-myths',
    title:       'Agile Myths That Are Killing Your Team',
    description: 'Daily standups, sprint velocity, story points, and the Agile rituals that became bureaucracy in disguise.',
    category:    'Project Management',
    tags:        ['#agile','#scrum','#projectmanagement','#leadership'],
    date:        '2026-04-27',
    slides:      7
  },
  {
    id:          'estimating-software',
    slug:        'estimating-software',
    title:       'Software Estimation: Stop Lying to Yourself',
    description: 'Why estimates are always wrong, planning poker fallacies, cone of uncertainty, and how to set expectations that stick.',
    category:    'Project Management',
    tags:        ['#estimation','#planning','#projectmanagement','#agile'],
    date:        '2026-04-28',
    slides:      7
  },

  /* ─ Business ─ */
  {
    id:          'managing-tech-debt',
    slug:        'managing-tech-debt',
    title:       'Tech Debt: When to Pay, When to Walk Away',
    description: 'Not all tech debt is equal. Strategic debt vs reckless debt, refactoring ROI, and how to sell prioritisation to stakeholders.',
    category:    'Business',
    tags:        ['#techdebt','#refactoring','#engineering','#business'],
    date:        '2026-04-29',
    slides:      7
  },
  {
    id:          'engineer-to-lead',
    slug:        'engineer-to-lead',
    title:       'Engineer to Tech Lead: What Nobody Tells You',
    description: 'The mindset shift, influence without authority, saying no clearly, 1-on-1s that matter, and avoiding the common traps.',
    category:    'Business',
    tags:        ['#leadership','#techlead','#career','#softskills'],
    date:        '2026-04-30',
    slides:      7
  },

  /* ─ Best Practices ─ */
  {
    id:          'best-practices-rais',
    slug:        'best-practices-rais',
    title:       'My Engineering Playbook: .NET, React & Clean Code',
    description: 'A comprehensive walkthrough — assessing before coding, .NET Clean Architecture, React patterns, enterprise integration (SAP, Oracle, LDAP), project rescue, and BNM compliance. Interview-ready.',
    category:    'Best Practices',
    tags:        ['#dotnet', '#react', '#cleancode', '#architecture', '#interview'],
    date:        '2026-05-03',
    slides:      20
  },
  {
    id:          'code-review-culture',
    slug:        'code-review-culture',
    title:       'Code Reviews: The Culture Most Teams Get Wrong',
    description: 'What to review, what to skip, how to give and receive feedback without politics, and building a review culture that ships faster.',
    category:    'Best Practices',
    tags:        ['#codereview','#culture','#engineering','#teamwork'],
    date:        '2026-05-01',
    slides:      7
  },
  {
    id:          'healthy-codebase',
    slug:        'healthy-codebase',
    title:       'Signs of a Healthy Codebase (and the Red Flags)',
    description: 'Naming conventions, test coverage, coupling metrics, documentation culture, and the green flags that signal maintainable software.',
    category:    'Best Practices',
    tags:        ['#bestpractices','#codequality','#engineering','#architecture'],
    date:        '2026-05-02',
    slides:      7
  }
];

/* Sort newest first */
TIPS_REGISTRY.sort(function(a,b){ return b.date.localeCompare(a.date); });
