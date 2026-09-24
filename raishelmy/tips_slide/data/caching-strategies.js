/* ── Caching in .NET: What to Use When ──────────────────────────── */
window.TIP_DATA = {
  id: 'caching-strategies',
  title: 'Caching in .NET: What to Use When',
  description: 'IMemoryCache vs IDistributedCache vs OutputCache — cache invalidation, stale data, and the mistakes that cause production bugs.',
  category: '.NET · 7 slides',
  tags: ['#caching', '#dotnet', '#performance', '#redis'],
  date: '2026-04-10',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Caching looks easy until you have to invalidate it.

I have seen systems where IMemoryCache worked fine for two months — then the team added a second instance and half the users started seeing stale data. Nobody had thought about what happens in multi-node deployments.

IMemoryCache, IDistributedCache, output caching, cache stampede prevention — each has a specific use case. Mixing them up is a recurring trap.

Quick slides on when to use what, and the invalidation patterns that save you later.

#dotnet #performance #caching #redis`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: '.NET Caching.<br><span style="color:var(--red);">Stale data.</span><br><span style="color:#555;font-weight:300;">Users see yesterday\'s prices.</span>',
      description: 'Caching is the easiest win in performance — and the easiest source of bugs. Wrong eviction strategy, missing invalidation, or stale data in multi-instance deployments. Knowing when NOT to cache matters.',
      tags: ['#caching', '#dotnet', '#performance', '#redis']
    },

    /* 02 IMemoryCache vs IDistributedCache */
    {
      type: 'evr-code',
      label: 'topic 1 · memory vs distributed cache',
      expect_items: [
        'IMemoryCache: per-process, in-memory — fast, zero setup, perfect for single-instance apps.',
        'IDistributedCache: shared across instances (Redis, SQL) — required for load-balanced deployments.',
        'IHybridCache (.NET 9): tiered — L1 memory, L2 distributed — best of both worlds.'
      ],
      reality_items: [
        'Using IMemoryCache on a load-balanced app — each instance has different cache state, inconsistent data.',
        'Caching everything in memory without size limits — OutOfMemoryException on high traffic.',
        'No cache invalidation strategy — data becomes permanently stale after initial load.'
      ],
      code_good: `<span class="cgr">// ✦ Cache-aside pattern with proper options</span>
<span class="cr">public async</span> Task&lt;Product&gt; GetProductAsync(<span class="cb">int</span> id, CancellationToken ct)
{
    <span class="cr">var</span> key = <span class="cg">$"product:{id}"</span>;
    <span class="cr">if</span> (_cache.TryGetValue(key, <span class="cr">out</span> Product? cached))
        <span class="cr">return</span> cached!;

    <span class="cr">var</span> product = <span class="cr">await</span> _repo.FindAsync(id, ct);
    <span class="cr">var</span> opts = <span class="cr">new</span> MemoryCacheEntryOptions()
        .SetAbsoluteExpiration(TimeSpan.FromMinutes(<span class="cb">15</span>))
        .SetSlidingExpiration(TimeSpan.FromMinutes(<span class="cb">5</span>))
        .SetSize(<span class="cb">1</span>);   <span class="cgr">// ✦ size limit required</span>
    _cache.Set(key, product, opts);
    <span class="cr">return</span> product;
}`,
      code_bad: `<span class="cgr">// ✗ No size, no expiry, no key pattern</span>
<span class="cr">public async</span> Task&lt;Product&gt; GetProductAsync(<span class="cb">int</span> id)
{
    <span class="cr">if</span> (_cache.TryGetValue(id, <span class="cr">out</span> Product p))
        <span class="cr">return</span> p;                     <span class="cgr">// key is just 'id' — collision risk</span>

    <span class="cr">var</span> product = <span class="cr">await</span> _repo.FindAsync(id);
    _cache.Set(id, product);        <span class="cgr">// no expiry — lives forever</span>
    <span class="cr">return</span> product;
}`
    },

    /* 03 Invalidation */
    {
      type: 'evr',
      label: 'topic 2 · cache invalidation',
      expect_items: [
        'Invalidate by key on write — when you update a product, remove that product\'s cache key.',
        'Use tag-based expiry (OutputCache tags, IHybridCache tags) for group invalidation.',
        'Set ChangeToken for config/file-based caches — auto-expires when source changes.'
      ],
      reality_items: [
        'No invalidation — update product in DB, cache still serves old price for next 15 minutes.',
        'Clearing entire cache on every write — defeats the purpose, thrashes Redis.',
        '"We\'ll just set a short expiry" — users still see stale data, just for less time.'
      ],
      code: `<span class="cgr">// ✦ Invalidate on write</span>
<span class="cr">public async</span> Task UpdateProductAsync(UpdateProductCommand cmd, CancellationToken ct)
{
    <span class="cr">await</span> _repo.UpdateAsync(cmd, ct);
    _cache.Remove(<span class="cg">$"product:{cmd.Id}"</span>);         <span class="cgr">// ← precise invalidation</span>
}

<span class="cgr">// ✦ OutputCache tag invalidation (.NET 7+)</span>
[HttpGet(<span class="cg">"{id}"</span>), OutputCache(Tags = [<span class="cg">"products"</span>])]
<span class="cr">public async</span> Task&lt;IActionResult&gt; Get(<span class="cb">int</span> id) => Ok(<span class="cr">await</span> _svc.GetAsync(id));

[HttpPut(<span class="cg">"{id}"</span>)]
<span class="cr">public async</span> Task&lt;IActionResult&gt; Update([FromBody] UpdateProductDto dto)
{
    <span class="cr">await</span> _svc.UpdateAsync(dto);
    <span class="cr">await</span> _outputCache.EvictByTagAsync(<span class="cg">"products"</span>); <span class="cgr">// ✦ evict all tagged</span>
    <span class="cr">return</span> NoContent();
}`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · cache selection matrix',
      cells: [
        { label: 'IMemoryCache',     value: 'Single-instance apps',        sub: 'Fast, no serialization, bounded by process RAM' },
        { label: 'IDistributedCache',value: 'Multi-instance / load balanced', sub: 'Redis or SQL Server — serialization required' },
        { label: 'OutputCache',      value: 'HTTP response caching',       sub: '.NET 7+ — tag-based, middleware-level' },
        { label: 'IHybridCache',     value: 'L1 memory + L2 distributed',  sub: '.NET 9 — stampede protection, tags, clones' },
        { label: 'Expiry Strategy',  value: 'Absolute + sliding',          sub: 'Absolute caps total age, sliding resets on access' },
        { label: 'Never Cache', red: true, value: 'User-specific sensitive data', sub: 'Auth tokens, PII, financial balances per user' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · cache is a bet',
      quote_title: 'Caching bets that the data<br><span style="color:var(--red);">won\'t change before expiry.</span>',
      quote_body: 'Every cache entry is a wager that the cached value will still be valid when served. If the data changes frequently and consistency matters, caching can cause more damage than the latency you saved.',
      left_label: 'Cache at the right layer',
      left_body: 'Cache computed results, not raw DB rows. Cache after business logic, not before. Caching raw DB rows means your business logic runs against stale primitives.',
      right_label: 'Stampede protection',
      right_body: 'When a cache key expires under high load, hundreds of requests may hit the DB simultaneously. IHybridCache handles this. Otherwise use SemaphoreSlim or staggered expiry.',
      insight: 'Phil Karlton: <strong style="color:#fff;">"There are only two hard things in computer science: cache invalidation and naming things."</strong> He was right. Plan your invalidation strategy before you cache anything.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
