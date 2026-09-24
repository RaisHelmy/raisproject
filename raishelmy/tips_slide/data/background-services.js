/* ── Background Services: IHostedService vs Worker ───────────────── */
window.TIP_DATA = {
  id: 'background-services',
  title: 'Background Services: IHostedService vs Worker',
  description: 'IHostedService, BackgroundService, Worker Service — when to use each, and how to avoid silently swallowed exceptions.',
  category: '.NET · 7 slides',
  tags: ['#backgroundservices', '#dotnet', '#aspnetcore', '#workers'],
  date: '2026-04-09',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `An exception was swallowed silently in a background service.

For four days no one knew. The queue kept growing. Users noticed data was stale. Support tickets came in. We looked at infrastructure, database, recent deploys.

It was a null reference in a hosted service. Nobody had wired up an exception handler.

The hard part is not writing background services. It is making sure they fail loudly when something goes wrong.

Slides on IHostedService, BackgroundService, and what to connect to make them production-safe.

#dotnet #aspnetcore #backgroundjobs #csharp`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Background Services.<br><span style="color:var(--red);">Silent failures.</span><br><span style="color:#555;font-weight:300;">Nobody knows it stopped.</span>',
      description: 'Your background job throws an exception. The app stays up. No error. No alert. The queue grows. Users notice in three days. This is the background service story in most teams.',
      tags: ['#backgroundservices', '#dotnet', '#aspnetcore', '#workers']
    },

    /* 02 IHostedService vs BackgroundService */
    {
      type: 'evr-code',
      label: 'topic 1 · ihostedservice vs backgroundservice',
      expect_items: [
        'IHostedService: full control — implement StartAsync/StopAsync yourself for precise lifecycle.',
        'BackgroundService: abstract class wrapping IHostedService — override ExecuteAsync only.',
        'Worker Service project template: standalone background process, ideal for microservices.'
      ],
      reality_items: [
        'Implementing IHostedService directly for every background task — boilerplate overload.',
        'Ignoring CancellationToken in ExecuteAsync — graceful shutdown fails, process hangs.',
        'Running CPU-heavy work on thread pool from background service — starves web requests.'
      ],
      code_good: `<span class="cgr">// ✦ Clean BackgroundService</span>
<span class="cr">public class</span> <span class="cy">OrderExpiryWorker</span> : BackgroundService
{
    <span class="cr">protected override async</span> Task ExecuteAsync(CancellationToken ct)
    {
        <span class="cr">while</span> (!ct.IsCancellationRequested)
        {
            <span class="cr">await</span> _svc.ExpireStaleOrdersAsync(ct);    <span class="cgr">// ✦ passes ct</span>
            <span class="cr">await</span> Task.Delay(TimeSpan.FromMinutes(<span class="cb">5</span>), ct);
        }
    }
}`,
      code_bad: `<span class="cgr">// ✗ Ignores cancellation, no error handling</span>
<span class="cr">public class</span> <span class="cy">OrderExpiryWorker</span> : BackgroundService
{
    <span class="cr">protected override async</span> Task ExecuteAsync(CancellationToken ct)
    {
        <span class="cr">while</span> (<span class="cr">true</span>)                                <span class="cgr">// ← no ct check</span>
        {
            _svc.ExpireStaleOrders();              <span class="cgr">// ← sync, no ct</span>
            <span class="cr">await</span> Task.Delay(<span class="cb">300000</span>);              <span class="cgr">// ← ignores ct</span>
        }
    }
}`
    },

    /* 03 Exception Handling */
    {
      type: 'evr',
      label: 'topic 2 · unhandled exceptions & health',
      expect_items: [
        'Wrap ExecuteAsync in try/catch — log errors and optionally trigger host shutdown.',
        'Use IHostApplicationLifetime.StopApplication() for fatal errors that should kill the host.',
        'Emit health check metrics from your worker — expose via /healthz endpoint.'
      ],
      reality_items: [
        'Unhandled exception in ExecuteAsync kills the background loop silently — app stays up but job never runs again.',
        'No health checks on workers — ops team never knows the job stopped until business impact.',
        'Scope creep: accessing Scoped services directly from Singleton background service causes memory leaks.'
      ],
      code: `<span class="cgr">// ✦ Resilient worker with scope factory</span>
<span class="cr">protected override async</span> Task ExecuteAsync(CancellationToken ct)
{
    <span class="cr">while</span> (!ct.IsCancellationRequested)
    {
        <span class="cr">try</span>
        {
            <span class="cr">using var</span> scope = _scopeFactory.CreateScope(); <span class="cgr">// ✦ scoped services</span>
            <span class="cr">var</span> svc = scope.ServiceProvider.GetRequiredService&lt;IOrderService&gt;();
            <span class="cr">await</span> svc.ProcessAsync(ct);
        }
        <span class="cr">catch</span> (OperationCanceledException) { <span class="cr">break</span>; }
        <span class="cr">catch</span> (Exception ex)
        {
            _logger.LogError(ex, <span class="cg">"Worker failed — will retry"</span>);
        }
        <span class="cr">await</span> Task.Delay(TimeSpan.FromSeconds(<span class="cb">30</span>), ct);
    }
}`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · background service cheatsheet',
      cells: [
        { label: 'IHostedService',     value: 'Full lifecycle control',      sub: 'Use when StartAsync/StopAsync logic is complex' },
        { label: 'BackgroundService',  value: 'Abstract — override ExecuteAsync', sub: 'Use for 90% of background jobs' },
        { label: 'Worker Service',     value: 'Standalone process / .exe',   sub: 'Microservice deployable with Docker, k8s' },
        { label: 'Scoped Services',    value: 'IServiceScopeFactory.Create', sub: 'Never inject Scoped into Singleton directly' },
        { label: 'CancellationToken',  value: 'Pass everywhere, do not ignore', sub: 'Enables graceful shutdown within timeout' },
        { label: 'Health Checks', red: true, value: 'Custom IHealthCheck',   sub: 'Check last run time — alert if worker is stuck' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · silent death',
      quote_title: 'A worker that stopped<br>and <span style="color:var(--red);">nobody noticed</span> is worse than one that crashed loudly.',
      quote_body: 'When ExecuteAsync swallows an exception and the loop exits, your ASP.NET app keeps returning 200 OK. The background processing is dead. Queue grows. Users are silently affected. Observability is not optional.',
      left_label: 'Use channels for high throughput',
      left_body: 'System.Threading.Channels.Channel<T> is the right queue primitive for in-process producer/consumer — not ConcurrentQueue or BlockingCollection.',
      right_label: 'Avoid Thread.Sleep',
      right_body: 'Always use Task.Delay(ms, cancellationToken) — it respects cancellation. Thread.Sleep blocks the thread and cannot be cancelled cleanly.',
      insight: 'Register background workers last in your DI container. They start <strong style="color:#fff;">after your app is fully initialized</strong> — avoids race conditions against database migrations or config loading.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
