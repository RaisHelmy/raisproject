## Short Introduction (30 seconds)

I'm Rais, a full stack engineer with 6+ years turning around software that's stuck — a year-late compliance project I delivered in two months, a "nobody understands this codebase anymore" mobile rescue I reverse-engineered and shipped in half the remaining time, a legacy police emergency-dispatch system I kept alive after the vendor walked away. I work across **.NET, Flutter, and enterprise integrations** (SAP, LDAP, GIS) in regulated, high-stakes environments — insurance (Etiqa/BNM), utilities (TNB), and government (PDRM). I'm excited about this role because it's another chance to walk into something hard and make it work.

---

## Full Introduction (3 minutes)

**[HOOK — first 30 seconds, same as above, said with energy, then pause and let it land]**

> "I'm Rais, a full stack engineer with 6+ years turning around software that's stuck — a year-late compliance project I delivered in two months, a mobile rescue that nobody else understood, a legacy police emergency-dispatch system I kept alive after the vendor walked away. I work across .NET, Flutter, and enterprise integrations in regulated, high-stakes environments — insurance, utilities, and government. I'm excited about this role because it's another chance to walk into something hard and make it work."

**[Then expand — remaining ~2.5 minutes]**

"To give you three examples of what that actually looks like —

At **Etiqa Insurance and Takaful Berhad**, I joined an **AMLA watchlist screening project that was already a year behind schedule** — a compliance-critical system BNM was expecting. I got it fixed and delivered within my **first two months**, then spent the following **six months building out the new BNM requirements on top of it**, delivering every one of those on time. That project taught me how to walk into a stalled system, diagnose what's actually broken versus what's just been mismanaged, and rebuild momentum fast.

The second is my time on the **TNB vendor side**, which actually starts at **JuruQuest**, a sibling company of atQuest. I was handed a project that was estimated at **four months and already had SAP integration nobody on the team understood** — no one could explain what was working or why. I reverse-engineered the whole thing from scratch, and used **FlutterFlow** to accelerate the mobile rebuild so I could deliver it in **two months instead of four**. From there I moved into **atQuest**, working on their **ERP SaaS platform**, enhancing modules against live user requirements and pushing through a real **security hardening pass** — closing SQL injection exposure, tightening RBAC, and rebuilding parts of the approval workflow engine.

The third is **PDRM**, through **Vector Intelligence**. I was brought in to reverse-engineer an old **Motorola call-taker system called MCAD** — the telephony and CCTV integration backbone for police patrol dispatch — built on an aging **.NET Framework** codebase. I fixed and enhanced it enough that the emergency system ran reliably again. The harder problem came **after the original maintenance contract ended**: a lot of self-hosted integrations had quietly stopped working or updating, so I had to go back in and rework and patch the pieces that had drifted out of support. That's a different skill from building fresh — it's keeping a mission-critical system alive when the people who built it are gone.

Across all three, the pattern is the same: I get handed something broken, delayed, or unowned, and I make it work — properly, not just patched over.

That's why I'm excited about this conversation — I want to bring that same mix of technical depth and reliability to a team where the problems are real and the bar is set high."

**[Close — invite the next question]**

"Happy to go deeper into any of those — Etiqa, the TNB vendor story, or PDRM — whichever's most relevant to what you're hiring for."

---

### Delivery notes
- The 30-second hook must stand alone — if the interviewer cuts you off after it, the "turnaround specialist" positioning has already landed.
- Structure is **3 rescue stories, not 4 job titles** — Etiqa (compliance turnaround) → JuruQuest→atQuest (reverse-engineering + security hardening) → PDRM (legacy system survival). This trades strict reverse-chronological order for a stronger narrative thread; that's intentional.
- Always lead each story with the **number**: "a year behind" → "two months," "four months" → "two months." Numbers are what interviewers remember and repeat back.
- Practice trimming to 90 seconds by cutting the PDRM story down to one sentence ("kept a legacy police dispatch system alive after the vendor walked away, including repairing integrations that broke after the maintenance contract ended") and dropping the close.

# Interview Q&A — CV Terms Explained

Short, concise answers for terms on my CV that interviewers commonly probe on.
Each answer is framed the way I'd say it out loud: a plain definition first, then how I actually used it.

---

### Q: What is Clean Architecture?
**A:** A way of structuring an app into layers — Domain, Application, Infrastructure, Presentation — where dependencies only point inward toward the Domain. The business logic doesn't know about the database or the web framework, so I can swap SQL Server for something else without touching business rules. At Etiqa I use it to keep policy/underwriting logic isolated from Oracle/SQL Server and API concerns.

### Q: What is CQRS?
**A:** Command Query Responsibility Segregation — splitting the "write" operations (Commands, e.g. CreatePolicy) from the "read" operations (Queries, e.g. GetPolicyById) into separate models/handlers instead of one bloated service class. It keeps each handler small and single-purpose, and lets reads and writes evolve independently.

### Q: What is MediatR and why use it?
**A:** A .NET library implementing the mediator pattern — controllers send a Command/Query object into MediatR, and MediatR routes it to the matching handler. It decouples the controller from the business logic, and lets me add cross-cutting behavior (logging, validation) as pipeline steps without touching every handler.

### Q: What is DDD (Domain-Driven Design)?
**A:** Designing the code around the business domain — modeling entities, value objects, and aggregates that mirror how the business actually thinks (e.g. a Policy, a Claim), rather than modeling around database tables. It keeps business rules inside the domain objects instead of scattered across services.

### Q: What's the Repository pattern / Unit of Work?
**A:** Repository abstracts data access behind an interface (e.g. `IPolicyRepository`) so business code isn't coupled to EF Core directly — easier to test and swap. Unit of Work wraps multiple repository operations in a single transaction, so either everything commits or nothing does.

### Q: What is EF Core?
**A:** Entity Framework Core — .NET's ORM. It maps C# classes to database tables and generates SQL, so I write LINQ instead of raw SQL for most operations, while still being able to drop to raw SQL/stored procs when performance needs it (common with Oracle in my case).

### Q: What is JWT authentication?
**A:** JSON Web Token — a signed token issued after login containing user claims (id, roles). The client sends it on every request in the Authorization header; the API verifies the signature and reads claims instead of hitting the database each time to check who's logged in. I used this to secure the TNB TOMAS REST API.

### Q: What's LDAP / Active Directory integration?
**A:** LDAP is the protocol used to query a company's directory (usernames, groups, org structure) — Active Directory is Microsoft's implementation of it. I integrate against it so users can log in with their existing corporate credentials (SSO) instead of a separate app password, and so I can pull their group membership to drive role-based access.

### Q: How did you integrate with SAP?
**A:** SAP exposes data (HR records, asset master data) via APIs/RFC or intermediate tables. At TNB ESS I synced employee/payroll data from SAP HR into the ESS platform; at TNB TOMAS I pulled asset master data from SAP ERP to keep the field app's asset list consistent with the source of truth.

### Q: What is Esri ArcGIS and how did you use it?
**A:** ArcGIS is Esri's GIS platform for storing, rendering, and analyzing geospatial data. On the PDRM C4i project I used it to plot live incident locations and unit positions on a map for real-time dispatch — the .NET backend fed location/incident data into ArcGIS layers that dispatch operators viewed on screen.

### Q: What is FlutterFlow vs Flutter?
**A:** Flutter is Google's cross-platform UI framework (one Dart codebase, compiles to iOS/Android/web). FlutterFlow is a visual builder on top of Flutter — it generates real Flutter/Dart code from a drag-and-drop UI, which I then export and extend by hand for custom logic. I used it to rebuild the TNB TOMAS mobile app faster than hand-coding every screen.

### Q: What is a microservices architecture, and did you build one?
**A:** Splitting a system into independently deployable services, each owning its own data and responsibility, communicating over APIs/events instead of in-process calls. My work has been closer to well-layered modular monoliths (Clean Architecture) with some independently deployed services (e.g. AMLA batch job as its own scheduled process) rather than a full microservices mesh — I'd frame it honestly as "modular, service-oriented, not a large microservices fleet."

### Q: What's an HLD/LLD?
**A:** High-Level Design documents overall system architecture — components, data flow, integrations (e.g. how ArcGIS, SIP/PBX, and the API backend fit together in C4i). Low-Level Design drills into implementation detail per component — class structure, API contracts, DB schema. I produced both for the PDRM C4i system for stakeholder sign-off before build.

### Q: What is HCI (Hyperconverged Infrastructure) and why VMware ESXi?
**A:** HCI combines compute, storage, and networking into one virtualized platform instead of separate physical servers/SAN/switches — easier to manage and scale for on-prem deployments. I used VMware ESXi as the hypervisor to run the C4i system's VMs with high availability, since PDRM required an on-premise (not cloud) deployment for security reasons.

### Q: What's the difference between SIP/PBX and XMPP/Jitsi/Openfire in your project?
**A:** SIP/PBX handled telephony — actual phone call routing for emergency dispatch. XMPP (via Openfire server) handled real-time messaging/presence between operators, and Jitsi handled video conferencing. Together they formed the "unified communications" layer of the C4i command center alongside the GIS mapping.

### Q: What is the AMLA Watchlist Batch Job you built?
**A:** A scheduled background job (not user-triggered) that pulls external sanctions/watchlist data sources, runs entity-matching against Etiqa's customer/policyholder records, flags high-risk matches for compliance review, and logs an audit trail — built to satisfy BNM anti-money-laundering screening requirements.

### Q: What is Serilog / Application Insights used for?
**A:** Serilog is structured logging for .NET — logs come out as structured data (JSON-like) instead of plain text strings, so they're queryable by field (e.g. filter by PolicyId or UserId). Application Insights is Azure's monitoring service — it ingests those logs plus request/dependency telemetry so I can trace a failed request end-to-end and see performance/error trends.

### Q: What does UAT mean and what's your role in it?
**A:** User Acceptance Testing — the business/end-user validates that a built feature actually meets the requirement before it goes live. In BNM-regulated environments like Etiqa, I prepare test plans and traceability matrices mapping requirements to test cases, so there's a documented, auditable trail proving each requirement was verified before release.

### Q: What's a traceability matrix?
**A:** A table linking each business requirement to the test case(s) that verify it, and the test result. It proves nothing shipped untested and nothing was missed — regulators and auditors ask for it directly in BNM-governed releases.

### Q: Agile vs Waterfall — where have you used each?
**A:** Waterfall for regulated, sign-off-heavy delivery (Etiqa, TNB ESS) where requirements, design, and UAT need formal documentation before release. Agile/sprint-based for faster-moving rebuild work (TNB TOMAS mobile rescue) where requirements evolved as I reverse-engineered the broken system.

### Q: What CI/CD tooling have you used?
**A:** GitLab CI/CD for automated build/test/deploy pipelines, and Azure DevOps for pipeline + work-item tracking. I set up pipelines that run on merge/PR to catch build breaks early rather than at manual deploy time.

### Q: Why Cloudflare Workers/Pages for some projects?
**A:** Serverless edge platform — no servers to manage, deploys globally, scales automatically, and is effectively free at low traffic. I use it for lighter-weight sites/APIs (like my own portfolio and freelance work) where a full VM or container setup would be overkill.

### Q: What's the difference between REST API design done "cleanly" vs not?
**A:** Clean REST design means resource-based URLs (`/policies/{id}` not `/getPolicyById`), correct HTTP verbs and status codes, versioning, and consistent error response shapes — so any client can predict behavior without reading the source. At TNB TOMAS I rebuilt the API from an inconsistent legacy design into this pattern as part of the rescue.

---

# Deep-Dive Technical Q&A — Architecture, Data & Performance

These are the follow-up questions interviewers ask once they've seen "Clean Architecture / CQRS / EF Core" on the CV and want to know if I actually understand what's under the hood.

### Q: How do you implement FluentValidation? Do you run it through a pipeline?
**A:** I write one `AbstractValidator<T>` class per Command/Query — e.g. `CreatePolicyCommandValidator : AbstractValidator<CreatePolicyCommand>` — using `RuleFor(x => x.Field).NotEmpty().MaximumLength(50)` style rules, registered via `services.AddValidatorsFromAssembly(...)`. Rather than calling `validator.Validate()` manually inside every handler, I plug it into the MediatR pipeline as an `IPipelineBehavior<TRequest, TResponse>` — a `ValidationBehavior` that resolves all validators for the incoming request type, runs them before the handler executes, and short-circuits with a `ValidationException` (mapped to a 400 response) if anything fails. That way validation is cross-cutting: every command/query gets validated automatically and no handler can accidentally skip it.

### Q: How do you approach unit testing?
**A:** Because CQRS keeps handlers small and single-purpose, each one is naturally easy to unit test in isolation — xUnit as the test framework, Moq for mocking repositories/dependencies, FluentAssertions for readable asserts, following Arrange-Act-Assert. I test business/domain logic with pure unit tests (no DB, fast, run on every build), and reserve integration tests — using an in-memory or a real test database via Testcontainers — for things that actually need to touch EF Core, like verifying a query maps correctly or a transaction rolls back. I also unit test validators directly since FluentValidation rules are pure logic and easy to assert against.

### Q: How do you use Entity Framework Core — do you work with more than one database?
**A:** Yes. At Etiqa I integrate SQL Server, Oracle, MDM, and PolisyM in the same system, so I don't use a single `DbContext` for everything — each data source gets its own context/connection scoped to its own provider (SQL Server provider vs Oracle provider have different connection strings and sometimes different query capabilities), configured in DI with named connection strings. Cross-source data isn't joined at the SQL level across providers — I fetch from each source independently in the application/infrastructure layer and compose the result there, or go through an integration/reporting layer if it needs to be denormalized for reporting. For simple lookups I let EF Core generate the SQL; for performance-sensitive or complex Oracle queries I'll drop to raw SQL or a stored procedure call through EF's `FromSqlRaw`/`ExecuteSqlRaw`.

### Q: What are the different types of SQL Server index scanning, and how do you use them?
**A:** The execution plan mainly shows three access patterns: a **Table Scan** (no useful index, reads every row — worst case), an **Index Scan** (reads the entire index, better than a table scan but still touches every row in that index), and an **Index Seek** (uses the B-tree to jump directly to the matching rows — what you want for selective queries). On top of that: a **Clustered Index** physically orders the table's data by its key (usually the PK), while a **Non-clustered Index** is a separate structure with pointers back to the clustered key (or a RID if the table is a heap) — so a non-clustered index that doesn't cover all the needed columns triggers a **Key/RID Lookup** per row, which gets expensive at scale. I design **covering indexes** (`INCLUDE` columns) so the query can be satisfied entirely from the index without that extra lookup, and I pay attention to **column order in composite indexes** since SQL Server can only seek efficiently on a left-to-right prefix match of the index key.

### Q: How do you use a SQL profiler?
**A:** I use it to catch what the execution plan alone won't show you — actual runtime behavior. I look at Duration, CPU, Reads/Writes per statement to spot the genuinely expensive queries under real load, filter by application/database to isolate my service's traffic, and specifically watch for repeated near-identical `SELECT` statements, which is the signature of an **N+1 query problem** coming from lazy-loaded EF Core navigation properties. I'll flag here that SQL Server Profiler itself is deprecated by Microsoft in favor of **Extended Events**, which I use for the same purpose with lower overhead — same investigative approach, lighter tool.

### Q: What's the performance benefit of CQRS splitting reads from writes?
**A:** The write side stays focused purely on transactional correctness — normalized schema, constraints, minimal indexes to keep writes fast and avoid lock contention. The read side can be optimized independently — denormalized/read-optimized models, indexes tuned purely for query patterns, even a **separate read replica or reporting database** — without either side compromising the other. Concretely: a heavy reporting query hitting the write database can cause lock waits that slow down transactional writes; splitting the models means I can scale reads (caching, replicas, materialized views) without ever touching how writes are validated and committed.

### Q: Beyond pagination, what strategies would you use to handle a billion-row table?
**A:** Pagination alone doesn't fix the underlying cost — a few things I'd reach for, in rough order of impact:
- **Keyset/cursor pagination instead of OFFSET paging** — `WHERE Id > @lastId ORDER BY Id` avoids SQL Server having to scan and discard millions of skipped rows on every page.
- **Table partitioning** (by date or another natural range) so queries and maintenance operations only touch the relevant partition, and old partitions can be archived/switched out cheaply.
- **Covering & filtered indexes** tuned to the actual query patterns instead of one wide index that scans everything.
- **Denormalized read models / CQRS read side** so hot queries don't have to join across the full normalized schema every time.
- **Columnstore indexes** for analytical/aggregate queries over huge historical ranges — dramatically faster than rowstore for scans.
- **Caching hot data** (Redis) so repeat reads don't hit SQL Server at all.
- **Bulk operations** (`SqlBulkCopy`, batched writes) instead of row-by-row EF Core saves for high-volume inserts.
- **Archiving cold data** out of the primary table entirely rather than making every query filter around it.
The right mix depends on whether the bottleneck is read-heavy reporting, write-heavy ingestion, or both — I'd profile first rather than applying all of these blindly.

### Q: What's the difference between an API's read and write operations?
**A:** Reads (`GET`) fetch data with no side effects — safe and idempotent, freely cacheable and retryable, never change state. Writes (`POST`/`PUT`/`PATCH`/`DELETE`) mutate state — create, update, or delete a resource — so they carry side effects, generally aren't safe to retry blindly (PUT/DELETE are idempotent by spec, POST usually isn't), and need transaction/validation handling. This maps directly onto CQRS: read = Query, write = Command, and I keep them on separate handler paths from the controller down.

### Q: How does the frontend know which endpoint is read vs write?
**A:** By HTTP method convention baked into the API contract and documented in Swagger/OpenAPI — GET is always read, POST/PUT/PATCH/DELETE always write. The frontend doesn't infer intent, the verb declares it; it just calls the documented endpoint with the right method. I keep URL naming resource-based and consistent (`/policies` vs `/policies/{id}`) so the shape of the call itself signals collection-fetch vs single-fetch vs mutation, and response codes reinforce it — 200/206 for reads, 201/204 for successful writes.

### Q: How is your team agile — what does that mean day-to-day?
**A:** In the environments where we actually run agile — the TNB TOMAS rescue at JuruQuest, and atQuest's ERP enhancement work — it's concrete daily/weekly components, not just a label: a 15-minute **daily stand-up** (what I did, what's next, blockers), **sprint planning** at the start of each ~2-week sprint to size and commit backlog items, a **Jira board** tracked To Do → In Progress → Code Review → UAT → Done, a **sprint review/demo** for stakeholders, and a **retro** to adjust process. **Backlog grooming** happens mid-sprint so the next sprint's items are ready to go. The point of all of it is short feedback loops — catching scope or requirement drift within days instead of finding out at the end of a multi-month cycle.

### Q: What's your hands-on experience with Azure or AWS cloud?
**A:** Honestly — I haven't directly provisioned or managed Azure/AWS infrastructure. In the enterprise environments I've worked in (Etiqa, TNB), cloud infra, scaling, and deployment pipelines are owned by a dedicated infra/migration/DevOps team; my day-to-day touchpoint with Azure is application-level — **Azure DevOps** for CI/CD pipelines and work tracking, and **Application Insights** for monitoring/telemetry. I consume those services, I don't provision the underlying resources. Where I do have genuine end-to-end cloud experience is **Cloudflare** — for my own projects I've set up Workers, Pages, R2 storage, and DNS myself from scratch, so I understand serverless/edge deployment models, environment config, and CI-triggered deploys firsthand. I'd expect the underlying concepts — IAM, scaling, networking — to transfer, but I want to be upfront that it's Cloudflare where I've been hands-on, not Azure/AWS infrastructure itself.

### Q: Can you test a static method? Is it "testable"?
**A:** Yes — and for a **pure** static method (no side effects, no hidden dependencies, same input always gives the same output — e.g. a math or string utility), it's actually the *easiest* thing to unit test: call it directly, assert the return value, no mocking needed at all because there's no state or dependency to isolate.

The real problem isn't testing the static method itself — it's when a static method is used *inside another class* as a **hidden dependency**: something like `DateTime.Now`, a static `Logger.Write()`, or a static DB/file-access helper. Frameworks like Moq can only mock interfaces or virtual members — static and non-virtual methods can't be intercepted — so if `OrderService` calls `DateTime.Now` directly, I can't isolate `OrderService` from "real time" in a unit test; the test becomes flaky or dependent on the clock.

My fix is to **wrap the static dependency behind an interface** — a thin adapter like `IDateTimeProvider` with a `Now` property, implemented by calling the real `DateTime.Now` underneath — and inject `IDateTimeProvider` into the class instead of calling the static method directly. Now the class depends on an abstraction I *can* mock, and the wrapper itself is trivial enough that it doesn't need its own test. Same pattern applies to any static call that touches time, randomness, the file system, or external state.

So the short answer in an interview: "Pure static functions are trivially testable on their own. Static calls become a testing problem only when they're a hidden dependency inside a class I need to isolate — and I solve that with a thin interface wrapper, not by avoiding statics altogether."

### Q: What's your experience with caching?
**A:** My hands-on experience is with **built-in, in-process caching** — .NET's `IMemoryCache` — used to hold frequently-read, rarely-changing data (reference/lookup tables, config values) in memory with a **sliding or absolute expiration** so I'm not hitting SQL Server/Oracle for the same lookup on every request. It follows the **cache-aside pattern**: check the cache first, on a miss fetch from the DB and populate the cache, on a hit return straight from memory.

I'll be upfront that I haven't implemented **distributed caching** (Redis or similar) in production. The distinction matters: `IMemoryCache` lives inside a single process/instance — fine for a single server, but if the app scales out to multiple instances, each instance has its own separate cache, so a distributed cache like Redis is needed to share cached state across instances and avoid stale/inconsistent data between them. I understand the concept — shared cache store, cache invalidation on writes, TTL tuning — and it's a natural next step given the enterprise-scale systems I've worked on; I just haven't been the one to wire it up yet.

### Q: How do you use message bus / RabbitMQ-type technology?
**A:** On the **PDRM C4i** project, I used a message-queue pattern to ingest live **GPS location data from patrol vehicles**. The GPS units publish location updates onto a queue continuously and unreliably (units go in and out of signal, update at their own frequency) — instead of the backend polling every device directly or every unit needing a synchronous connection to the server, units publish their position and a consumer on the backend picks up those messages asynchronously and updates the live position on the **Esri ArcGIS** map.

The reason a message bus fits this problem: it **decouples producer from consumer**. The GPS device doesn't need to know or care whether the backend is up, fast, or even listening at that instant — it just publishes. The backend consumer processes messages at its own pace, so a burst of GPS updates (e.g. many units checking in at once) doesn't overwhelm or block anything — the queue absorbs the burst and the consumer drains it. That's the core value of RabbitMQ/message-bus technology generally: reliable, buffered, asynchronous delivery between systems that shouldn't be tightly coupled or forced to talk in real time.

### Q: What's the difference between synchronous and asynchronous, and where do you use each?
**A:** **Synchronous** means the calling code blocks — it waits, doing nothing else, until the operation finishes before moving to the next line. **Asynchronous** means the calling code kicks off the operation and is free to continue (or the thread is released back to the pool) while that operation runs in the background, resuming via `await`/callback once it completes.

I use **async for anything I/O-bound** — database calls, HTTP calls to external systems, file access — because the thread isn't actually doing CPU work while waiting on the network or disk; blocking it there is wasted capacity. Concretely: every EF Core call is `await context.SaveChangesAsync()` / `await query.ToListAsync()`, every ASP.NET Core controller action is `async Task<IActionResult>`, and any outbound HTTP call (e.g. to SAP) goes through `HttpClient` with `await`. The payoff is throughput — an API thread that would otherwise sit blocked waiting on a slow SQL query or a slow external API can instead go serve another incoming request, so the server handles far more concurrent traffic with the same thread pool. The GPS message-bus consumer on PDRM is the same idea at a different layer — messages are processed asynchronously so one slow update never blocks the next one in the queue.

I'd only reach for **synchronous** code where the work is trivial in-memory CPU logic with no I/O — there's nothing to gain from async there, and it just adds overhead and complexity.
