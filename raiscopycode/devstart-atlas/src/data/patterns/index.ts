import type { Pattern } from "../../types";

// Design patterns. Patterns are tools, not requirements — every page says
// when NOT to use the pattern, and that is as important as the example code.

export const patterns: Pattern[] = [
  {
    id: "repository",
    name: "Repository",
    category: "pattern",
    summary: "Abstract data access behind a collection-like interface.",
    problem:
      "Business logic that talks to the database directly is hard to unit test and couples your domain to a specific ORM or SQL dialect.",
    solution:
      "Define an interface that exposes domain-meaningful operations (GetById, Add, ListActive). Implement it with your ORM in the infrastructure layer. Business code depends only on the interface.",
    whenToUse: [
      "You have real business logic worth testing without a database",
      "Clean/Onion/Hexagonal architecture where the domain must not know the ORM",
      "Multiple data sources behind one contract",
    ],
    whenNotToUse: [
      "Simple CRUD apps — EF Core's DbContext or an ORM already IS a repository/unit-of-work",
      "When every repository method would just forward to the ORM one-to-one",
    ],
    example: {
      language: "csharp",
      title: "IUserRepository + EF Core implementation",
      code: `// Application/Interfaces/IUserRepository.cs
public interface IUserRepository
{
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct);
    Task<User?> GetByEmailAsync(string email, CancellationToken ct);
    Task AddAsync(User user, CancellationToken ct);
}

// Infrastructure/Persistence/UserRepository.cs
public class UserRepository(AppDbContext db) : IUserRepository
{
    public Task<User?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<User?> GetByEmailAsync(string email, CancellationToken ct) =>
        db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

    public async Task AddAsync(User user, CancellationToken ct) =>
        await db.Users.AddAsync(user, ct);
}`,
    },
    tradeoffs: [
      "Extra interfaces and classes per aggregate",
      "Naive generic repositories hide the ORM's real capabilities (see the Generic Repository Abuse anti-pattern)",
    ],
    relatedPatterns: ["unit-of-work", "specification", "dependency-injection"],
    tags: ["data", "testing", "clean-architecture"],
  },
  {
    id: "unit-of-work",
    name: "Unit of Work",
    category: "pattern",
    summary: "Group multiple writes into a single atomic commit.",
    problem: "Several repository operations must succeed or fail together, but each saves independently.",
    solution:
      "A Unit of Work tracks changes across repositories and commits them in one transaction. In EF Core, DbContext.SaveChanges already is a unit of work — often you only need a thin interface over it.",
    whenToUse: ["Multi-aggregate writes that must be atomic", "Abstracting the commit point out of business logic"],
    whenNotToUse: ["When your ORM already gives you this and you'd just be wrapping it with no added value"],
    example: {
      language: "csharp",
      title: "Thin IUnitOfWork over EF Core",
      code: `public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct);
}

// AppDbContext implements it for free:
public class AppDbContext : DbContext, IUnitOfWork { /* ... */ }

// Application service:
public async Task Handle(CreateOrderCommand cmd, CancellationToken ct)
{
    var order = Order.Create(cmd.CustomerId, cmd.Lines);
    await orders.AddAsync(order, ct);
    inventory.Reserve(order);
    await unitOfWork.SaveChangesAsync(ct); // one atomic commit
}`,
    },
    tradeoffs: ["Another abstraction layer; only worth it when the commit boundary matters to the design"],
    relatedPatterns: ["repository"],
    tags: ["data", "transactions"],
  },
  {
    id: "factory",
    name: "Factory",
    category: "pattern",
    summary: "Centralize complex object creation behind a method or class.",
    problem: "Object construction requires validation, defaults or branching that callers keep duplicating.",
    solution: "A static factory method or factory class owns the creation rules; constructors stay private or dumb.",
    whenToUse: ["Creation enforces invariants (an Order must have lines)", "The concrete type depends on input"],
    whenNotToUse: ["Simple objects — `new` is fine; a factory for a DTO is noise"],
    example: {
      language: "typescript",
      title: "Static factory enforcing invariants",
      code: `class Order {
  private constructor(
    readonly id: string,
    readonly customerId: string,
    readonly lines: OrderLine[],
  ) {}

  static create(customerId: string, lines: OrderLine[]): Order {
    if (lines.length === 0) throw new Error("An order needs at least one line");
    return new Order(crypto.randomUUID(), customerId, lines);
  }
}`,
    },
    tradeoffs: ["Indirection; readers must find the factory to see construction rules"],
    relatedPatterns: ["abstract-factory"],
    tags: ["creation", "domain"],
  },
  {
    id: "abstract-factory",
    name: "Abstract Factory",
    category: "pattern",
    summary: "A factory interface producing families of related objects.",
    problem: "Code must create families of related objects (e.g. per-database connection + command + dialect) without knowing concrete types.",
    solution: "Define a factory interface with a create-method per product; implement one factory per family; select the family once at composition time.",
    whenToUse: ["Supporting interchangeable product families (multiple DB providers, UI themes)"],
    whenNotToUse: ["Only one family exists and no second is planned — YAGNI"],
    example: {
      language: "typescript",
      title: "Storage provider family",
      code: `interface StorageFactory {
  createBlobStore(): BlobStore;
  createQueue(): Queue;
}

class AzureStorageFactory implements StorageFactory {
  createBlobStore() { return new AzureBlobStore(); }
  createQueue() { return new AzureQueue(); }
}

class LocalStorageFactory implements StorageFactory {
  createBlobStore() { return new DiskBlobStore("./data"); }
  createQueue() { return new InMemoryQueue(); }
}`,
    },
    tradeoffs: ["Many small classes; adding a product type touches every factory"],
    relatedPatterns: ["factory", "dependency-injection"],
    tags: ["creation"],
  },
  {
    id: "strategy",
    name: "Strategy",
    category: "pattern",
    summary: "Swap an algorithm at runtime behind a common interface.",
    problem: "A class branches on a mode flag (if premium… else if trial…) and every new mode grows the branching.",
    solution: "Extract each variant into its own class implementing a shared interface; select the strategy once and delegate.",
    whenToUse: ["Multiple interchangeable algorithms (pricing, shipping, compression)", "Killing large switch statements that keep growing"],
    whenNotToUse: ["Two stable branches — an if is simpler and clearer"],
    example: {
      language: "typescript",
      title: "Pricing strategies",
      code: `interface PricingStrategy {
  price(base: number): number;
}

const strategies: Record<string, PricingStrategy> = {
  standard: { price: (b) => b },
  premium:  { price: (b) => b * 0.9 },
  trial:    { price: () => 0 },
};

function checkout(plan: string, base: number) {
  const strategy = strategies[plan] ?? strategies.standard;
  return strategy.price(base);
}`,
    },
    tradeoffs: ["More classes; the dispatch logic moves rather than disappearing"],
    relatedPatterns: ["factory"],
    tags: ["behavior"],
  },
  {
    id: "observer",
    name: "Observer",
    category: "pattern",
    summary: "Notify many subscribers when something happens, without coupling to them.",
    problem: "When X happens, five other things must react — and the X code shouldn't know about any of them.",
    solution: "Subjects expose subscribe/unsubscribe; observers register callbacks; the subject publishes events to all current subscribers.",
    whenToUse: ["Domain events, UI events, cache invalidation, decoupled side effects"],
    whenNotToUse: ["A single, fixed reaction — a direct call is easier to trace"],
    example: {
      language: "typescript",
      title: "Minimal typed event emitter",
      code: `type Listener<T> = (event: T) => void;

class Emitter<T> {
  private listeners = new Set<Listener<T>>();
  subscribe(fn: Listener<T>) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(event: T) {
    this.listeners.forEach((fn) => fn(event));
  }
}

const userRegistered = new Emitter<{ userId: string }>();
userRegistered.subscribe((e) => sendWelcomeEmail(e.userId));
userRegistered.subscribe((e) => trackSignup(e.userId));`,
    },
    tradeoffs: ["Control flow becomes implicit; debugging 'who reacted' takes more effort"],
    relatedPatterns: ["mediator"],
    tags: ["behavior", "events"],
  },
  {
    id: "adapter",
    name: "Adapter",
    category: "pattern",
    summary: "Wrap an incompatible interface so it fits the one your code expects.",
    problem: "A third-party SDK's interface doesn't match the port your application defines.",
    solution: "Write a small class implementing your interface that translates calls to the SDK.",
    whenToUse: ["Integrating third-party services behind your own interfaces", "Hexagonal architecture adapters"],
    whenNotToUse: ["The external interface is already a good fit — don't wrap for wrapping's sake"],
    example: {
      language: "typescript",
      title: "Email port + provider adapter",
      code: `// Your application's port:
interface EmailSender {
  send(to: string, subject: string, html: string): Promise<void>;
}

// Adapter for a hypothetical provider SDK:
class ProviderEmailAdapter implements EmailSender {
  constructor(private client: ProviderClient) {}
  async send(to: string, subject: string, html: string) {
    await this.client.messages.create({
      recipient: { address: to },
      content: { subjectLine: subject, bodyHtml: html },
    });
  }
}`,
    },
    tradeoffs: ["A thin layer to maintain per provider — usually worth it at integration boundaries"],
    relatedPatterns: ["facade"],
    tags: ["structure", "integration"],
  },
  {
    id: "decorator",
    name: "Decorator",
    category: "pattern",
    summary: "Add behavior around an object by wrapping it in the same interface.",
    problem: "You need caching/logging/retries around a component without modifying it or subclassing.",
    solution: "A wrapper implements the same interface, delegates to the inner instance, and adds behavior before/after.",
    whenToUse: ["Cross-cutting concerns per component (caching a repository, timing a service)"],
    whenNotToUse: ["Framework middleware/interceptors already cover the concern globally"],
    example: {
      language: "typescript",
      title: "Caching decorator over a repository",
      code: `class CachedUserRepository implements UserRepository {
  private cache = new Map<string, User>();
  constructor(private inner: UserRepository) {}

  async getById(id: string): Promise<User | null> {
    const hit = this.cache.get(id);
    if (hit) return hit;
    const user = await this.inner.getById(id);
    if (user) this.cache.set(id, user);
    return user;
  }
}`,
    },
    tradeoffs: ["Stacked decorators can obscure what actually runs; keep the stack shallow"],
    relatedPatterns: ["adapter", "pipeline"],
    tags: ["structure", "cross-cutting"],
  },
  {
    id: "facade",
    name: "Facade",
    category: "pattern",
    summary: "One simple entry point over a complex subsystem.",
    problem: "Callers must orchestrate five subsystem calls in the right order to do one logical thing.",
    solution: "A facade class exposes the one method callers actually want and hides the orchestration.",
    whenToUse: ["Simplifying a subsystem's public surface", "Module public APIs in a modular monolith"],
    whenNotToUse: ["The subsystem is already simple — an extra layer just hides one call behind another"],
    example: {
      language: "typescript",
      title: "Checkout facade",
      code: `class CheckoutFacade {
  constructor(
    private cart: CartService,
    private payment: PaymentService,
    private shipping: ShippingService,
    private notifier: NotificationService,
  ) {}

  async placeOrder(userId: string): Promise<OrderId> {
    const items = await this.cart.getItems(userId);
    const charge = await this.payment.charge(userId, total(items));
    const shipment = await this.shipping.schedule(userId, items);
    await this.notifier.orderConfirmed(userId, charge, shipment);
    return shipment.orderId;
  }
}`,
    },
    tradeoffs: ["Facades can grow into god classes — keep them orchestration-only"],
    relatedPatterns: ["adapter", "mediator"],
    tags: ["structure"],
  },
  {
    id: "mediator",
    name: "Mediator",
    category: "pattern",
    summary: "Route requests to handlers through a central dispatcher instead of direct calls.",
    problem: "Controllers depend on many services; cross-cutting behavior (validation, logging) is duplicated per call site.",
    solution:
      "Requests are objects; each has one handler; a mediator dispatches request → handler and can run a pipeline of behaviors around every call. In .NET this is commonly done with MediatR; the idea is framework-agnostic.",
    whenToUse: ["Vertical slice / CQRS handler-per-request designs", "Uniform cross-cutting pipelines"],
    whenNotToUse: ["Small apps — indirection cost exceeds the benefit; a service call is clearer"],
    example: {
      language: "csharp",
      title: "Request + handler (MediatR-style)",
      code: `public record CreateUserCommand(string Email, string Name) : IRequest<Guid>;

public class CreateUserHandler(IUserRepository users, IUnitOfWork uow)
    : IRequestHandler<CreateUserCommand, Guid>
{
    public async Task<Guid> Handle(CreateUserCommand cmd, CancellationToken ct)
    {
        var user = User.Create(cmd.Email, cmd.Name);
        await users.AddAsync(user, ct);
        await uow.SaveChangesAsync(ct);
        return user.Id;
    }
}

// Controller: return Ok(await mediator.Send(new CreateUserCommand(dto.Email, dto.Name)));`,
    },
    tradeoffs: ["'Go to definition' no longer lands in the implementation; navigation relies on convention"],
    relatedPatterns: ["pipeline", "observer"],
    tags: ["behavior", "cqrs"],
  },
  {
    id: "specification",
    name: "Specification",
    category: "pattern",
    summary: "Encapsulate a query/business rule as a composable object.",
    problem: "The same filtering rule ('active premium customers') is duplicated across queries and if-statements.",
    solution: "A specification object encapsulates the predicate (and optionally ORM expression) once; queries and validations reuse and combine it.",
    whenToUse: ["Reused, named business rules", "DDD domains where rules deserve names"],
    whenNotToUse: ["One-off filters — inline LINQ/SQL is clearer"],
    example: {
      language: "csharp",
      title: "Composable specification",
      code: `public class ActivePremiumCustomers : Specification<Customer>
{
    public ActivePremiumCustomers()
        : base(c => c.IsActive && c.Tier == Tier.Premium) { }
}

// usage
var customers = await repo.ListAsync(new ActivePremiumCustomers(), ct);`,
    },
    tradeoffs: ["Infrastructure to translate specs to SQL; only pays off with real reuse"],
    relatedPatterns: ["repository"],
    tags: ["domain", "queries"],
  },
  {
    id: "dependency-injection",
    name: "Dependency Injection",
    category: "pattern",
    summary: "Give objects their dependencies instead of letting them construct them.",
    problem: "Classes that `new` up their dependencies are impossible to test in isolation and hard-wire the object graph.",
    solution:
      "Dependencies arrive via constructor parameters. A composition root (DI container or plain factory function) wires the graph once at startup.",
    whenToUse: ["Practically always, in some form — even without a container"],
    whenNotToUse: ["Don't inject pure functions or value objects; injection is for collaborators with behavior/state"],
    example: {
      language: "csharp",
      title: "ASP.NET Core composition root",
      code: `// Program.cs
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddDbContext<AppDbContext>(o =>
    o.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// The service just declares what it needs:
public class UserService(IUserRepository users) : IUserService { /* ... */ }`,
    },
    tradeoffs: ["Containers add magic; misregistered lifetimes (singleton capturing scoped) cause subtle bugs"],
    relatedPatterns: ["factory", "options"],
    tags: ["structure", "testing"],
  },
  {
    id: "options",
    name: "Options Pattern",
    category: "pattern",
    summary: "Bind configuration to typed, validated settings classes.",
    problem: "Magic configuration strings read all over the codebase; typos fail at runtime in production.",
    solution: "Define a settings class per concern, bind it from configuration once, validate at startup, inject it where needed.",
    whenToUse: ["Any nontrivial configuration surface"],
    whenNotToUse: ["A single value used in one place"],
    example: {
      language: "csharp",
      title: "Typed, validated options",
      code: `public class JwtOptions
{
    public const string Section = "Jwt";
    [Required] public string Issuer { get; init; } = "";
    [Required, MinLength(32)] public string SigningKey { get; init; } = "";
    public int ExpiryMinutes { get; init; } = 60;
}

// Program.cs
builder.Services.AddOptions<JwtOptions>()
    .BindConfiguration(JwtOptions.Section)
    .ValidateDataAnnotations()
    .ValidateOnStart();

// usage: public class TokenService(IOptions<JwtOptions> jwt) { ... }`,
    },
    tradeoffs: ["A class per config section — cheap insurance"],
    relatedPatterns: ["dependency-injection"],
    tags: ["configuration"],
  },
  {
    id: "result",
    name: "Result Pattern",
    category: "pattern",
    summary: "Return success-or-failure explicitly instead of throwing for expected errors.",
    problem: "Exceptions used for expected outcomes ('email already taken') hide control flow and hurt performance.",
    solution: "Operations return a Result type carrying either a value or a typed error; callers must handle both branches.",
    whenToUse: ["Expected, domain-level failures", "APIs mapping errors to HTTP problem responses"],
    whenNotToUse: ["Truly exceptional conditions (bugs, IO failures) — let those throw"],
    example: {
      language: "typescript",
      title: "Discriminated-union result",
      code: `type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

async function registerUser(email: string): Promise<Result<User, "email_taken">> {
  if (await users.existsByEmail(email)) return { ok: false, error: "email_taken" };
  const user = await users.create(email);
  return { ok: true, value: user };
}

// caller
const result = await registerUser(input.email);
if (!result.ok) return res.status(409).json({ error: result.error });
return res.status(201).json(result.value);`,
    },
    tradeoffs: ["More verbose call sites; mixing result-style and exception-style inconsistently is worse than either"],
    relatedPatterns: ["mediator"],
    tags: ["errors", "domain"],
  },
  {
    id: "pipeline",
    name: "Pipeline / Middleware",
    category: "pattern",
    summary: "Pass a request through an ordered chain of processing steps.",
    problem: "Cross-cutting behavior (logging, auth, validation) must run around every request consistently.",
    solution: "Each step receives the request and a `next` continuation; steps compose into an ordered pipeline. This is how Express/ASP.NET Core middleware and MediatR behaviors work.",
    whenToUse: ["Uniform request processing", "Composable cross-cutting concerns"],
    whenNotToUse: ["One-off logic — putting business rules into middleware hides them"],
    example: {
      language: "typescript",
      title: "Express-style middleware",
      code: `function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on("finish", () => {
    console.log(\`\${req.method} \${req.path} \${res.statusCode} \${Date.now() - start}ms\`);
  });
  next();
}

app.use(requestLogger);
app.use(express.json());
app.use("/api", apiRouter);`,
    },
    tradeoffs: ["Order-sensitive; a misordered pipeline (auth after routing) is a classic bug"],
    relatedPatterns: ["decorator", "mediator"],
    tags: ["cross-cutting", "http"],
  },
  {
    id: "retry",
    name: "Retry",
    category: "pattern",
    summary: "Retry transient failures with backoff and a bounded budget.",
    problem: "Networks blip. Treating every transient failure as fatal makes reliable systems out of reach.",
    solution:
      "Retry idempotent operations a bounded number of times with exponential backoff and jitter. Never retry non-idempotent operations blindly.",
    whenToUse: ["Transient faults: timeouts, 429/503, dropped connections", "Idempotent operations only"],
    whenNotToUse: ["Permanent failures (400, 401, 404)", "Non-idempotent writes without an idempotency key"],
    example: {
      language: "typescript",
      title: "Exponential backoff with jitter",
      code: `async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransient(err) || i === attempts - 1) throw err;
      const backoff = 2 ** i * 250 + Math.random() * 100;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastError;
}`,
    },
    tradeoffs: ["Retries amplify load during outages — combine with circuit breakers and budgets"],
    relatedPatterns: ["circuit-breaker"],
    tags: ["resilience"],
  },
  {
    id: "circuit-breaker",
    name: "Circuit Breaker",
    category: "pattern",
    summary: "Stop calling a failing dependency until it recovers.",
    problem: "A dependency is down; every call waits for a timeout, threads pile up, and the failure cascades.",
    solution:
      "Track failures. After a threshold, 'open' the circuit and fail fast immediately. After a cooldown, allow a probe ('half-open'); success closes the circuit again.",
    whenToUse: ["Calls to remote services that can be down for a while", "Protecting shared resources from cascade failure"],
    whenNotToUse: ["Local, in-process calls", "As a substitute for fixing a chronically failing dependency"],
    example: {
      language: "typescript",
      title: "Minimal circuit breaker",
      code: `class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  constructor(private threshold = 5, private cooldownMs = 30_000) {}

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.failures >= this.threshold) {
      if (Date.now() - this.openedAt < this.cooldownMs) {
        throw new Error("circuit_open");
      }
      this.failures = this.threshold - 1; // half-open: allow one probe
    }
    try {
      const result = await fn();
      this.failures = 0;
      return result;
    } catch (err) {
      if (++this.failures >= this.threshold) this.openedAt = Date.now();
      throw err;
    }
  }
}`,
    },
    tradeoffs: ["Thresholds need tuning; in production prefer a library (Polly, opossum, resilience4j)"],
    relatedPatterns: ["retry"],
    tags: ["resilience"],
  },
];

export const patternById = new Map(patterns.map((p) => [p.id, p]));
