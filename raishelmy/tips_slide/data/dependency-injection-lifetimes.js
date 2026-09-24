/* ── DI Lifetimes ─────────────────────────────────────────────── */
window.TIP_DATA = {
  id: 'dependency-injection-lifetimes',
  title: 'DI Lifetimes: Singleton, Scoped, Transient',
  description: 'The most misunderstood part of ASP.NET dependency injection. Captive dependencies, scope validation, and when lifetimes bite you.',
  category: '.NET · 7 slides',
  tags: ['#di', '#dotnet', '#aspnetcore', '#architecture'],
  date: '2026-04-03',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `If I had a ringgit for every time I have seen a Scoped service injected into a Singleton.

It works. Until it does not. The scoped service holds state from a previous request. You get intermittent, unreproducible bugs — the kind that only show up in production, only for certain users, only under load.

Singleton, Scoped, Transient. Three lifetimes that seem obvious until you hit a captive dependency bug at 11pm.

Made this into a slide deck for onboarding. The scope validation section is the most immediately useful bit.

#dotnet #aspnetcore #dependencyinjection #csharp`,

  slides: [
    { type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'DI Lifetimes.<br><span style="color:var(--red);">The captive dependency.</span><br><span style="color:#555;font-weight:300;">The scope horror.</span>',
      description: 'Singleton, Scoped, Transient — three words that cause more production bugs than almost anything else in ASP.NET Core.',
      tags: ['#di', '#dotnet', '#aspnetcore', '#architecture'] },

    { type: 'evr-code',
      label: 'topic 1 · captive dependencies',
      expect_items: [
        'A Singleton never holds a Scoped dependency — Scoped lives per-request, Singleton lives forever.',
        'Inject IServiceScopeFactory into Singletons to resolve Scoped services safely on demand.',
        'ASP.NET Core validates scope in Development mode — pay attention to those startup errors.'
      ],
      reality_items: [
        'DbContext injected into a Singleton service — one DbContext shared across all requests, race conditions.',
        '"It works in dev" because scope validation is disabled in production by default.',
        'Memory leaks: Scoped objects never disposed because Singleton holds the reference indefinitely.'
      ],
      code_good: `<span class="cgr">// ✦ Singleton that needs scoped services</span>
<span class="cr">public class</span> <span class="cy">MySingleton</span>
{
    <span class="cr">private readonly</span> IServiceScopeFactory _factory;
    <span class="cr">public</span> MySingleton(IServiceScopeFactory factory)
        =&gt; _factory = factory;

    <span class="cr">public async</span> Task DoWorkAsync()
    {
        <span class="cr">using var</span> scope = _factory.CreateScope();
        <span class="cr">var</span> db = scope.ServiceProvider
            .GetRequiredService&lt;AppDbContext&gt;();
        <span class="cr">await</span> db.Orders.ToListAsync(); <span class="cgr">// safe ✦</span>
    }
}`,
      code_bad: `<span class="cgr">// ✗ Captive dependency — Scoped in Singleton</span>
<span class="cr">public class</span> <span class="cy">MySingleton</span>
{
    <span class="cr">private readonly</span> AppDbContext _db; <span class="cgr">// 💀</span>
    <span class="cr">public</span> MySingleton(AppDbContext db)
        =&gt; _db = db;  <span class="cgr">// captured at app start</span>
                       <span class="cgr">// SAME instance on every request</span>
                       <span class="cgr">// concurrent modifications = corruption</span>
}` },

    { type: 'evr',
      label: 'topic 2 · transient vs scoped',
      expect_items: [
        'Transient: new instance every injection. Use for lightweight, stateless services.',
        'Scoped: one instance per HTTP request. Ideal for DbContext, unit-of-work.',
        'Singleton: one instance app-wide. Only for truly stateless or thread-safe services.'
      ],
      reality_items: [
        'Registering DbContext as Transient — EF Core change tracking broken, multiple instances per request.',
        'Registering everything as Singleton "for performance" — shared mutable state causes race conditions.',
        'HttpClient as Transient — socket exhaustion (10k+ CLOSE_WAIT connections in prod).'
      ],
      code: `<span class="cgr">// ✦ Correct registrations</span>
services.AddScoped&lt;AppDbContext&gt;();       <span class="cgr">// per-request</span>
services.AddScoped&lt;IOrderRepository, OrderRepository&gt;();
services.AddTransient&lt;IEmailSender, SmtpEmailSender&gt;(); <span class="cgr">// stateless</span>
services.AddSingleton&lt;IMemoryCache, MemoryCache&gt;();     <span class="cgr">// thread-safe</span>
services.AddHttpClient&lt;IGitHubClient, GitHubClient&gt;();  <span class="cgr">// pooled ✦

// ✗ Common mistakes
</span>services.AddSingleton&lt;AppDbContext&gt;();   <span class="cgr">// 💀 shared DbContext</span>
services.AddTransient&lt;HttpClient&gt;();     <span class="cgr">// 💀 socket exhaustion</span>
services.AddTransient&lt;AppDbContext&gt;();   <span class="cgr">// 💀 multiple contexts/req` },

    { type: 'framework',
      label: 'practical guide · lifetime decision matrix',
      cells: [
        { label: 'Singleton', value: 'Stateless or thread-safe', sub: 'IMemoryCache, ILogger, Configuration' },
        { label: 'Scoped', value: 'Per-request unit of work', sub: 'DbContext, Repositories, UoW' },
        { label: 'Transient', value: 'Lightweight, no state', sub: 'EmailSender, Validators, Mappers' },
        { label: 'Captive Dep Rule', value: 'Never inject shorter-lived into longer-lived', sub: 'Singleton > Scoped = broken' },
        { label: 'HttpClient', value: 'Always use IHttpClientFactory', sub: 'Avoid manual new HttpClient()' },
        { label: 'The Golden Rule', value: 'When in doubt, use Scoped', red: true, sub: 'Safe default for request-bound services' }
      ] },

    { type: 'nuance',
      label: 'the real lesson · validate your registrations',
      quote_title: 'Scope validation:<br>turn it on in <span style="color:var(--red);">production too.</span>',
      quote_body: 'services.BuildServiceProvider(validateScopes: true) in production catches captive dependencies at startup — not at 3am when a customer hits a race condition.',
      left_label: 'Enable scope validation',
      left_body: 'Set ValidateScopes and ValidateOnBuild in production. A startup crash is better than a silent data corruption bug under load.',
      right_label: 'Use IServiceScope in tests',
      right_body: 'In integration tests, always create a scope per test. Shared Scoped services between tests cause flaky tests and false positives.',
      insight: 'The DI container is the <strong style="color:#fff;">blueprint of your application\'s dependencies</strong>. Treat registration like architecture — review it, validate it, and document unusual lifetime choices.' },

    { type: 'cta' }
  ]
};
