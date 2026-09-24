import type { Pattern } from "../../types";

// Anti-patterns: each shows the problem, why it happens, a better shape,
// and — honestly — when the simple version is actually fine.

export const antiPatterns: Pattern[] = [
  {
    id: "god-class",
    name: "God Class",
    category: "anti-pattern",
    summary: "One class that knows everything and does everything.",
    problem:
      "A single class (UserManager, AppService, Utils) accumulates unrelated responsibilities until every change touches it, every merge conflicts in it, and nobody can test it.",
    solution: "Split by responsibility. Each class should have one reason to change; extract cohesive clusters of methods and fields into their own types.",
    badExample: {
      language: "typescript",
      title: "The class that ate the codebase",
      code: `class UserManager {
  createUser() { /* ... */ }
  validateEmail() { /* ... */ }
  hashPassword() { /* ... */ }
  sendWelcomeEmail() { /* ... */ }
  generateInvoicePdf() { /* ... */ }
  syncToCrm() { /* ... */ }
  exportUsersToCsv() { /* ... */ }
  calculateChurnMetrics() { /* ... */ }
}`,
    },
    betterExample: {
      language: "typescript",
      title: "Responsibilities split",
      code: `class UserRegistration {
  constructor(private users: UserRepository, private email: EmailSender) {}
  async register(input: RegisterInput) { /* create + welcome email */ }
}

class UserExporter { exportCsv(users: User[]) { /* ... */ } }
class ChurnAnalytics { calculate(period: Period) { /* ... */ } }`,
    },
    whySimpleIsOk:
      "In a tiny script, one class (or none) is fine. God classes are a scale problem — split when the class's change rate and merge conflicts start hurting, not on day one.",
    tags: ["structure"],
  },
  {
    id: "fat-controller",
    name: "Fat Controller / Business Logic in Controller",
    category: "anti-pattern",
    summary: "HTTP handlers that validate, decide, query and email — all inline.",
    problem:
      "Business rules living in controllers can't be reused (CLI, jobs, other endpoints), can't be unit tested without HTTP, and turn every endpoint into a wall of code.",
    solution: "Controllers translate HTTP ↔ application calls, nothing more. Move rules into application/domain services and keep handlers ~10 lines.",
    badExample: {
      language: "csharp",
      title: "Everything in the action",
      code: `[HttpPost]
public async Task<IActionResult> Create(CreateUserDto dto)
{
    if (!dto.Email.Contains('@')) return BadRequest("bad email");
    if (await _db.Users.AnyAsync(u => u.Email == dto.Email))
        return Conflict("taken");
    var user = new User { Email = dto.Email, PasswordHash = Hash(dto.Password) };
    _db.Users.Add(user);
    await _db.SaveChangesAsync();
    await _smtp.SendAsync(BuildWelcomeMail(user));   // and retry logic...
    await _crm.SyncContactAsync(user);               // and error handling...
    return Ok(user);                                  // leaking the entity too
}`,
    },
    betterExample: {
      language: "csharp",
      title: "Thin controller, testable service",
      code: `[HttpPost]
public async Task<IActionResult> Create(CreateUserDto dto, CancellationToken ct)
{
    var result = await _userService.RegisterAsync(dto.Email, dto.Password, ct);
    return result.IsSuccess
        ? CreatedAtAction(nameof(GetById), new { id = result.Value.Id }, result.Value)
        : Conflict(new { error = result.Error });
}`,
    },
    whySimpleIsOk:
      "A 5-endpoint internal tool can keep logic in handlers. The line is reuse and testing: the second caller or the first painful test is the signal to extract.",
    tags: ["http", "structure"],
  },
  {
    id: "generic-repository-abuse",
    name: "Generic Repository Abuse",
    category: "anti-pattern",
    summary: "IRepository<T> with 30 generic methods wrapping an ORM that already does all of it.",
    problem:
      "A generic repository over EF Core/Hibernate hides the ORM's real strengths (Include, projections, change tracking), forces lowest-common-denominator queries, and adds a layer that answers no design question.",
    solution:
      "Either use the ORM directly (it already implements repository + unit of work), or write small, purpose-specific repositories with domain-meaningful methods per aggregate.",
    badExample: {
      language: "csharp",
      title: "The abstraction that abstracts nothing",
      code: `public interface IRepository<T>
{
    IQueryable<T> GetAll();          // leaks IQueryable anyway
    T? GetById(object id);
    void Add(T entity);
    void Update(T entity);
    void Delete(T entity);
    // + 25 overloads for includes, ordering, paging...
}`,
    },
    betterExample: {
      language: "csharp",
      title: "Purpose-built repository",
      code: `public interface IOrderRepository
{
    Task<Order?> GetWithLinesAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<Order>> ListPendingForCustomerAsync(Guid customerId, CancellationToken ct);
    Task AddAsync(Order order, CancellationToken ct);
}`,
    },
    whySimpleIsOk: "If you only need the ORM, use the ORM. A repository earns its place when it hides real complexity or protects a domain boundary.",
    tags: ["data"],
  },
  {
    id: "hardcoded-secrets",
    name: "Hardcoded Secrets",
    category: "anti-pattern",
    summary: "Connection strings, API keys and passwords committed to source control.",
    problem:
      "Secrets in code leak through git history forever, every clone, every CI log. Rotating them requires a deploy. This is the most common route to real-world breaches.",
    solution:
      "Read secrets from the environment or a secret manager. Commit a .env.example with names only. Add .env to .gitignore before the first commit.",
    badExample: {
      language: "typescript",
      title: "Committed to git, forever",
      code: `const db = new Client({
  connectionString: "postgres://admin:Sup3rS3cret!@prod-db.internal:5432/app",
});
const stripe = new Stripe("sk_live_51Hxxxxxxxxxxxxxxxxxxxxxx");`,
    },
    betterExample: {
      language: "typescript",
      title: "Environment-driven with fail-fast",
      code: `function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(\`Missing required env var: \${name}\`);
  return value;
}

const db = new Client({ connectionString: requireEnv("DATABASE_URL") });
const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"));`,
    },
    whySimpleIsOk: "It isn't. This one has no acceptable simple version — even for toy projects, the habit is the point. If a secret was ever committed, rotate it.",
    tags: ["security"],
  },
  {
    id: "global-mutable-state",
    name: "Global Mutable State",
    category: "anti-pattern",
    summary: "Shared mutable variables that anything can change at any time.",
    problem:
      "Globals create invisible coupling: tests interfere with each other, concurrency bugs appear under load, and 'who changed this?' becomes unanswerable.",
    solution: "Pass state explicitly, scope it to a request/instance, or guard it behind a well-defined store with controlled mutation.",
    badExample: {
      language: "typescript",
      code: `export let currentUser: User | null = null;   // mutated from 14 files
export const settings: any = {};              // written during startup... usually`,
    },
    betterExample: {
      language: "typescript",
      code: `// Request-scoped: state travels with the request
app.use((req, res, next) => {
  req.context = { user: null, requestId: crypto.randomUUID() };
  next();
});

// App config: loaded once, frozen, injected
const config = Object.freeze(loadConfig());`,
    },
    whySimpleIsOk: "A module-level constant (frozen config, a logger) is fine. The problem is mutation from multiple places, not the word 'global'.",
    tags: ["structure", "concurrency"],
  },
  {
    id: "premature-microservices",
    name: "Premature Microservices",
    category: "anti-pattern",
    summary: "Splitting into services before the domain boundaries — or the team — justify it.",
    problem:
      "A 3-person startup with 8 services gets all the costs (network failures, distributed transactions, deploy orchestration, tracing) with none of the benefits (independent teams, independent scaling). Wrong service boundaries are far harder to fix across repos than across folders.",
    solution:
      "Start with a monolith — modular if the domain is complex. Extract a service only when a specific, measured pressure (team contention, scaling profile) demands it.",
    badExample: {
      language: "bash",
      title: "Day-one 'architecture'",
      code: `startup/
├── user-service/          # 3 endpoints
├── auth-service/          # calls user-service on every request
├── email-service/         # one function
├── notification-service/  # calls email-service
├── api-gateway/
└── docker-compose.yml     # 40 minutes to start locally`,
    },
    betterExample: {
      language: "bash",
      title: "Same product, one deployable",
      code: `startup/
└── app/
    └── src/
        ├── modules/
        │   ├── users/
        │   ├── auth/
        │   └── notifications/
        └── main.ts        # boots in seconds, deploys in one step`,
    },
    whySimpleIsOk: "The monolith IS the simple version, and for most products it's also the right one. Microservices are an organizational scaling tool, not a quality badge.",
    tags: ["architecture"],
  },
  {
    id: "overengineering",
    name: "Overengineering / Excessive Abstraction",
    category: "anti-pattern",
    summary: "Layers, interfaces and patterns solving problems the project doesn't have.",
    problem:
      "Every interface with one implementation, every layer that only forwards calls, and every 'we might need it' generic makes the code slower to read, change and onboard into — the opposite of what architecture is for.",
    solution:
      "Add structure when a concrete pressure appears (a second implementation, a real testing seam, a team boundary). Deleting a missing abstraction later is easy; deleting a wrong one is hard.",
    badExample: {
      language: "csharp",
      title: "A 'hello world' with ambitions",
      code: `IGreetingStrategyFactoryProvider
  → IGreetingStrategyFactory
    → IGreetingStrategy
      → AbstractGreetingBase
        → EnglishGreeting : AbstractGreetingBase
// 6 files, 140 lines, prints "Hello"`,
    },
    betterExample: {
      language: "csharp",
      code: `Console.WriteLine("Hello");`,
    },
    whySimpleIsOk:
      "YAGNI is the default, not the exception. The best architects are known for the abstractions they didn't add.",
    tags: ["architecture", "structure"],
  },
  {
    id: "copy-paste-business-logic",
    name: "Copy/Paste Business Logic",
    category: "anti-pattern",
    summary: "The same rule duplicated in five places, drifting apart one bugfix at a time.",
    problem:
      "When a pricing rule or validation lives in the web handler, the mobile endpoint, the import job and the admin panel, fixing it means finding every copy — and someone won't.",
    solution: "Business rules get one home (a domain service/entity method) and every caller uses it. Duplication of trivial code is fine; duplication of decisions is not.",
    badExample: {
      language: "typescript",
      code: `// api/orders.ts
const discount = user.tier === "gold" ? 0.1 : 0;
// jobs/invoice.ts
const discount = user.tier === "gold" ? 0.1 : 0;
// admin/orders.ts
const discount = user.tier === "gold" ? 0.15 : 0;  // "fixed" here only`,
    },
    betterExample: {
      language: "typescript",
      code: `// domain/pricing.ts — the one home for the rule
export function tierDiscount(user: User): number {
  return user.tier === "gold" ? 0.15 : 0;
}`,
    },
    whySimpleIsOk:
      "Duplicating two lines of glue code to avoid a bad shared abstraction is often right. The rule of thumb: duplicate mechanics if you must, never duplicate decisions.",
    tags: ["structure", "domain"],
  },
  {
    id: "database-calls-in-ui",
    name: "Database Calls in UI",
    category: "anti-pattern",
    summary: "Views/components querying the database directly.",
    problem:
      "UI code that runs SQL (or ORM queries) couples presentation to schema, makes queries untestable and unswappable, and in web frontends may expose the database entirely.",
    solution: "UI talks to an API or application service; data access stays behind it. In server-rendered apps, controllers/services query — views only render.",
    badExample: {
      language: "csharp",
      title: "Razor view with a query",
      code: `@{
    var db = new AppDbContext();
    var users = db.Users.Where(u => u.IsActive).ToList();  // in the view!
}
@foreach (var u in users) { <li>@u.Email</li> }`,
    },
    betterExample: {
      language: "csharp",
      code: `// Controller
public async Task<IActionResult> Index(CancellationToken ct)
{
    var users = await _userService.ListActiveAsync(ct);
    return View(users);   // view receives data, renders it, nothing else
}`,
    },
    whySimpleIsOk: "Server-side page frameworks (e.g. Razor Pages page models) intentionally put the query next to the page — that's fine; the anti-pattern is queries in the markup/rendering itself.",
    tags: ["structure", "data"],
  },
  {
    id: "massive-service",
    name: "Massive Service",
    category: "anti-pattern",
    summary: "The 'service layer' version of a god class: one service with 40 methods.",
    problem:
      "UserService grows registration, password reset, GDPR export, avatar upload and billing sync. Constructor takes 12 dependencies; every test mocks all of them.",
    solution: "Split services by use case or capability (RegistrationService, PasswordResetService) — or move to one-handler-per-request (vertical slices).",
    badExample: {
      language: "csharp",
      code: `public class UserService(
    IUserRepository users, IEmailSender email, IPdfGenerator pdf,
    ICrmClient crm, IBlobStore blobs, IPaymentGateway payments,
    IAuditLog audit, ICache cache, /* 4 more */)
{
    // 40 public methods, 2600 lines
}`,
    },
    betterExample: {
      language: "csharp",
      code: `public class RegistrationService(IUserRepository users, IEmailSender email)
{
    public Task<Result<User>> RegisterAsync(string email, string password, CancellationToken ct) { /* ... */ }
}
// PasswordResetService, GdprExportService... each small, each testable`,
    },
    whySimpleIsOk: "One service is fine while it's one screen long. Constructor parameter count is a good smoke alarm — past ~5, something wants to split.",
    tags: ["structure"],
  },
];

export const antiPatternById = new Map(antiPatterns.map((p) => [p.id, p]));
