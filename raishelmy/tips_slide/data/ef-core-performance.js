/* ── EF Core Performance Anti-Patterns ─────────────────────── */
window.TIP_DATA = {
  id: 'ef-core-performance',
  title: 'Entity Framework Core Performance Anti-Patterns',
  description: 'N+1 queries, missing AsNoTracking, loading entire tables — the EF Core mistakes that destroy query performance.',
  category: '.NET · 7 slides',
  tags: ['#entityframework', '#dotnet', '#database', '#performance'],
  date: '2026-04-04',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Query ran in 0.7 seconds in development. Same query: 28 seconds in production.

The difference? Dev had 50 rows. Production had 40,000. And we were loading navigation properties inside a loop — EF Core fired one query per record instead of joining at the database.

Classic N+1. Easy to write. Hard to spot without looking at the SQL.

EF Core is genuinely powerful for data access. It is also the easiest way to accidentally send 10,000 queries when you expected one. The abstraction hides the cost.

This is the reference I now share with anyone starting on Entity Framework.

#efcore #dotnet #performance #database`,
  slides: [
    { type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Entity Framework.<br><span style="color:var(--red);">N+1 queries.</span><br><span style="color:#555;font-weight:300;">The performance killers.</span>',
      description: 'EF Core is powerful. It&apos;s also one of the easiest ways to accidentally send 10,000 queries when you expected 1.',
      tags: ['#entityframework', '#dotnet', '#database', '#performance'] },

    { type: 'evr-code',
      label: 'topic 1 · n+1 query problem',
      expect_items: [
        'Eager load related entities in one query using Include() / ThenInclude().',
        'Use projection (Select) to fetch only the columns you need.',
        'Profile your queries in development — use MiniProfiler or EF Core logging.'
      ],
      reality_items: [
        'Iterating orders and accessing order.Customer triggers 1 query per order — 1000 orders = 1001 queries.',
        'Lazy loading enabled globally — invisible database calls on every property access.',
        'No query profiling in dev — N+1 discovered in production during a load spike.'
      ],
      code_good: `<span class="cgr">// ✦ Eager loading — 1 query with JOIN</span>
<span class="cr">var</span> orders = <span class="cr">await</span> _db.Orders
    .Include(o =&gt; o.Customer)
    .Include(o =&gt; o.Items)
        .ThenInclude(i =&gt; i.Product)
    .Where(o =&gt; o.Status == OrderStatus.Active)
    .AsNoTracking()
    .ToListAsync(ct);`,
      code_bad: `<span class="cgr">// ✗ N+1: 1 query for orders + 1 per customer</span>
<span class="cr">var</span> orders = <span class="cr">await</span> _db.Orders
    .ToListAsync();  <span class="cgr">// loads 500 orders</span>

<span class="cr">foreach</span> (<span class="cr">var</span> o <span class="cr">in</span> orders)
{
    <span class="cr">var</span> name = o.Customer.Name; <span class="cgr">// 💀 lazy db hit
    // 500 orders = 501 queries total</span>
}` },

    { type: 'evr',
      label: 'topic 2 · asnotracking & projections',
      expect_items: [
        'AsNoTracking() on read-only queries — no change tracker overhead, up to 50% faster.',
        'Select() projection fetches only needed columns — avoids loading BLOBs or wide rows.',
        'Compiled queries for hot paths — avoid query translation cost on every call.'
      ],
      reality_items: [
        'Every query tracked even for read-only reports — change tracker holds thousands of entities in memory.',
        'Loading full entity then accessing 2 fields — 30-column table row fetched for a string.',
        '"We\'ll optimise after launch" — 2 years later, the app handles 100 users before OOM.'
      ],
      code: `<span class="cgr">// ✦ Projection — fetch only what you need</span>
<span class="cr">var</span> dtos = <span class="cr">await</span> _db.Orders
    .Where(o =&gt; o.CustomerId == customerId)
    .AsNoTracking()                      <span class="cgr">// no tracking</span>
    .Select(o =&gt; <span class="cr">new</span> OrderSummaryDto {  <span class="cgr">// projection</span>
        Id       = o.Id,
        Total    = o.Total,
        Customer = o.Customer.Name       <span class="cgr">// join in SQL</span>
    })
    .ToListAsync(ct);
<span class="cgr">// Result: SELECT Id, Total, c.Name — not SELECT *</span>` },

    { type: 'framework',
      label: 'practical guide · ef core performance checklist',
      cells: [
        { label: 'AsNoTracking', value: 'Add to all read queries', sub: 'Saves change tracker memory per entity' },
        { label: 'Include / ThenInclude', value: 'Prevent N+1 on navigation props', sub: 'Profile with SQL logging first' },
        { label: 'Select Projection', value: 'Fetch only needed columns', sub: 'Especially for list/grid views' },
        { label: 'SplitQuery', value: 'For large collection includes', sub: 'Avoids cartesian explosion on multi-includes' },
        { label: 'Bulk Operations', value: 'EF Core 7+ ExecuteUpdateAsync', sub: 'Skip entity load for mass updates' },
        { label: 'SQL Logging', value: 'Enable in Development always', sub: 'optionsBuilder.LogTo(Console.WriteLine)', red: true }
      ] },

    { type: 'nuance',
      label: 'the real lesson · orm is a leaky abstraction',
      quote_title: 'EF Core hides SQL.<br>It does <span style="color:var(--red);">not</span> replace understanding it.',
      quote_body: 'Every LINQ query becomes SQL. If you don\'t know what SQL it becomes, you\'re flying blind. Enable SQL logging in development — your database will thank you.',
      left_label: 'Profile in development',
      left_body: 'Enable EF Core SQL logging or use MiniProfiler. Every slow page in production was first a slow page in development — you just weren\'t looking.',
      right_label: 'Know when to skip EF',
      right_body: 'Complex reporting, bulk operations, and raw performance paths sometimes need Dapper or raw SQL. EF Core 7+ ExecuteUpdate/DeleteAsync helps but isn\'t always enough.',
      insight: 'The best ORM query is the one that generates the <strong style="color:#fff;">SQL you would have written by hand</strong>. If you can\'t predict the SQL from your LINQ, simplify the LINQ.' },

    { type: 'cta' }
  ]
};
