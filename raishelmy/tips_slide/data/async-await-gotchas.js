/* ── Async/Await Gotchas in .NET ─────────────────────────────── */
window.TIP_DATA = {
  id: 'async-await-gotchas',
  title: 'Async/Await Gotchas in .NET',
  description: 'ConfigureAwait, deadlocks, fire-and-forget, ValueTask — the async mistakes that kill production apps.',
  category: '.NET · 7 slides',
  tags: ['#async', '#dotnet', '#performance', '#csharp'],
  date: '2026-04-02',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Had a controller action that occasionally froze under load. No exception. No timeout. Just nothing.

Classic .Result deadlock. Async context, sync call, blocked thread. I have seen this in three separate codebases this year alone.

The thing about async/await is it looks simple. Until it does not.

ConfigureAwait(false), fire-and-forget bombs, ValueTask misuse, the CancellationToken nobody passes — stuff that works fine locally and quietly kills production.

Slides I made for the team. Sharing here too.

#dotnet #csharp #async #softwareengineering`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Async/Await.<br><span style="color:var(--red);">The mistakes.</span><br><span style="color:#555;font-weight:300;">The consequences.</span>',
      description: 'Everyone uses async/await. Almost nobody uses it correctly. ConfigureAwait(false), deadlocks, fire-and-forget bombs, and ValueTask misuse are killing production systems daily.',
      tags: ['#async', '#dotnet', '#performance', '#csharp']
    },

    /* 02 ConfigureAwait */
    {
      type: 'evr-code',
      label: 'topic 1 · configureawait(false)',
      expect_items: [
        'Adding <code style="font-family:\'DM Mono\',monospace;font-size:8px;background:#e9fde9;padding:1px 4px;border-radius:2px;">.ConfigureAwait(false)</code> in library code — never captures SynchronizationContext.',
        'ASP.NET Core has no sync context, but library code should still use it for portability.',
        'Results in faster execution — avoids needless thread marshalling.'
      ],
      reality_items: [
        'Library code awaits without ConfigureAwait — deadlocks in legacy .NET Framework callers.',
        'Teams cargo-cult ConfigureAwait into every line including controller actions.',
        '"It works in dev" — then deadlocks under concurrent WinForms/WPF load in prod.'
      ],
      code_good: `<span class="cgr">// ✦ Library method — always ConfigureAwait(false)</span>
<span class="cr">public async</span> Task&lt;Order&gt; GetOrderAsync(<span class="cb">int</span> id)
{
    <span class="cr">var</span> row = <span class="cr">await</span> _db.Orders
        .FindAsync(id)
        .<span class="cy">ConfigureAwait</span>(<span class="cr">false</span>);   <span class="cgr">// ← safe in lib code</span>
    <span class="cr">return</span> Map(row);
}`,
      code_bad: `<span class="cgr">// ✗ Library awaiting without ConfigureAwait</span>
<span class="cr">public async</span> Task&lt;Order&gt; GetOrderAsync(<span class="cb">int</span> id)
{
    <span class="cr">var</span> row = <span class="cr">await</span> _db.Orders
        .FindAsync(id);   <span class="cgr">// no ConfigureAwait</span>
    <span class="cr">return</span> Map(row);      <span class="cgr">// may deadlock in WinForms</span>
}`
    },

    /* 03 Deadlocks */
    {
      type: 'evr',
      label: 'topic 2 · .result / .wait() deadlocks',
      expect_items: [
        'Never block on async code with .Result or .Wait() — use async all the way down.',
        'If you must sync-over-async (legacy interfaces), use a dedicated thread pool task runner.',
        'Async void only acceptable in event handlers, never in application logic.'
      ],
      reality_items: [
        'someAsyncMethod().Result called from sync methods — instant deadlock under legacy sync context.',
        '"It\'s fine, we just added .GetAwaiter().GetResult()" — still deadlocks.',
        'Fire-and-forget async void methods swallowing exceptions silently in background.'
      ],
      code: `<span class="cgr">// ✗ Classic deadlock recipe</span>
<span class="cr">public</span> Order GetOrder(<span class="cb">int</span> id)
{
    <span class="cr">return</span> GetOrderAsync(id).Result;   <span class="cgr">// 💀 deadlock</span>
}

<span class="cgr">// ✦ Option 1: go async all the way</span>
<span class="cr">public async</span> Task&lt;Order&gt; GetOrder(<span class="cb">int</span> id)
    =&gt; <span class="cr">await</span> GetOrderAsync(id);

<span class="cgr">// ✦ Option 2: if legacy sync interface forces it</span>
<span class="cr">public</span> Order GetOrder(<span class="cb">int</span> id)
    =&gt; Task.Run(() =&gt; GetOrderAsync(id)).GetAwaiter().GetResult();
    <span class="cgr">// runs on pool thread — no sync context to deadlock`
    },

    /* 04 ValueTask */
    {
      type: 'evr-code',
      label: 'topic 3 · valuetask vs task',
      expect_items: [
        'ValueTask avoids allocation when the result is often synchronously available.',
        'Ideal for high-throughput read paths: cache hits, already-computed values.',
        'Never await a ValueTask more than once — it\'s not a regular Task.'
      ],
      reality_items: [
        'Using Task everywhere — even hot paths that return synchronously 99% of the time.',
        'Or using ValueTask everywhere — added complexity with no benefit for I/O-bound ops.',
        'Awaiting or storing ValueTask twice — undefined behaviour and data corruption.'
      ],
      code_good: `<span class="cgr">// ✦ ValueTask shines in hot paths</span>
<span class="cr">public</span> ValueTask&lt;<span class="cb">string</span>&gt; GetCached(<span class="cb">string</span> key)
{
    <span class="cr">if</span> (_cache.TryGetValue(key, <span class="cr">out var</span> v))
        <span class="cr">return new</span> ValueTask&lt;<span class="cb">string</span>&gt;(v); <span class="cgr">// sync, zero alloc</span>
    <span class="cr">return new</span> ValueTask&lt;<span class="cb">string</span>&gt;(FetchFromDbAsync(key));
}`,
      code_bad: `<span class="cgr">// ✗ ValueTask awaited twice — undefined behaviour</span>
<span class="cr">var</span> vt = GetCached(<span class="cg">"key"</span>);
<span class="cr">var</span> r1 = <span class="cr">await</span> vt;
<span class="cr">var</span> r2 = <span class="cr">await</span> vt;  <span class="cgr">// 💀 second await = undefined

// ✗ Task for sync-heavy hot path
</span><span class="cr">public async</span> Task&lt;<span class="cb">string</span>&gt; GetCached(<span class="cb">string</span> key)
{
    <span class="cr">if</span> (_cache.TryGetValue(key, <span class="cr">out var</span> v)) <span class="cr">return</span> v;
    <span class="cr">return await</span> FetchFromDbAsync(key); <span class="cgr">// extra alloc each hit</span>
}`
    },

    /* 05 CancellationToken */
    {
      type: 'evr',
      label: 'topic 4 · cancellation tokens',
      expect_items: [
        'Pass CancellationToken through the full call chain — controller → service → repository → DB.',
        'Respect cancellation at I/O boundaries — don\'t observe it only in the top layer.',
        'Handle OperationCanceledException gracefully, not as a crash.'
      ],
      reality_items: [
        'CancellationToken parameter defined but ignored — requests run to completion even after client disconnects.',
        'Token only checked in Controller, never passed to EF Core queries or HttpClient calls.',
        '"We\'ll add cancellation later" — technical debt that causes thread exhaustion under load.'
      ],
      code: `<span class="cgr">// ✦ Proper CancellationToken propagation</span>
<span class="cr">public async</span> Task&lt;IActionResult&gt; GetOrder(
    <span class="cb">int</span> id, CancellationToken ct)  <span class="cgr">// ← from framework</span>
{
    <span class="cr">var</span> order = <span class="cr">await</span> _service.GetAsync(id, ct);
    <span class="cr">return</span> Ok(order);
}

<span class="cr">public async</span> Task&lt;Order&gt; GetAsync(<span class="cb">int</span> id, CancellationToken ct)
{
    <span class="cr">return await</span> _db.Orders
        .Where(o =&gt; o.Id == id)
        .FirstOrDefaultAsync(ct);  <span class="cgr">// ← propagated to EF</span>
}`
    },

    /* 06 NUANCE */
    {
      type: 'nuance',
      label: 'the real lesson · async is not free',
      quote_title: 'Async is a <span style="color:var(--red);">tool,</span><br>not a <span style="color:var(--red);">default.</span>',
      quote_body: 'Not every method needs to be async. CPU-bound work in a Task.Run wrapper is not "async" — it\'s just offloaded. Real async means waiting on I/O without holding a thread.',
      left_label: 'When async helps',
      left_body: 'Database calls, HTTP requests, file I/O, message queue reads. Any operation where the CPU waits for an external resource.',
      right_label: 'When async hurts',
      right_body: 'Pure CPU computation, tiny synchronous operations wrapped in Task.Run, async void event handlers that swallow exceptions.',
      insight: 'The <strong style="color:#fff;">state machine overhead</strong> of async/await is real. For sub-microsecond operations, a synchronous path is faster. Measure before you async.'
    },

    /* 07 CTA */
    { type: 'cta' }
  ]
};
