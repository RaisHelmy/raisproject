/* ── Pagination Patterns: Cursor vs Offset ──────────────────────── */
window.TIP_DATA = {
  id: 'pagination-patterns',
  title: 'Pagination Patterns: Cursor vs Offset',
  description: 'Offset pagination, cursor-based pagination, keyset pagination — which to use, when offset breaks, and how to implement.',
  category: 'API · 7 slides',
  tags: ['#pagination', '#api', '#database', '#dotnet'],
  date: '2026-04-21',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `"Why is the admin export slow?"

Because page 7 of the transaction list is doing SKIP 600 rows on a table with 2 million records. And three of these queries were running in parallel.

Offset pagination is intuitive and broken at scale. Not immediately broken — broken in the way that works fine with small data, then silently degrades until someone files a ticket.

Cursor-based pagination is the fix. Slightly more work to implement. Much better under load.

Full comparison with implementation patterns in the slides.

#database #pagination #backend #performance`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Pagination.<br><span style="color:var(--red);">Skip(10000).</span><br><span style="color:#555;font-weight:300;">Database scans 10,000 rows.</span>',
      description: 'LINQ.Skip(pageNum * pageSize).Take(pageSize). Page 1 is instant. Page 500 scans 50,000 rows. A customer scrolls through "all orders" in your admin panel. Database CPU spikes. Support ticket logged.',
      tags: ['#pagination', '#api', '#database', '#dotnet']
    },

    /* 02 Offset vs Cursor */
    {
      type: 'evr-code',
      label: 'topic 1 · offset vs cursor pagination',
      expect_items: [
        'Offset (skip/take): simple, arbitrary page jump — but O(N) scan growth with page number.',
        'Cursor: pass last-seen ID or composite key — O(1) regardless of dataset size.',
        'Keyset: WHERE id > @lastId ORDER BY id — database uses index seek, not full scan.'
      ],
      reality_items: [
        'Skip(10000) on a 500k row table — full index scan, slow, grows worse as data grows.',
        'No total count for cursor pagination — UI cannot show "page X of Y" — requires UX change.',
        'Missing ORDER BY with OFFSET — inconsistent pages when concurrent inserts occur.'
      ],
      code_good: `<span class="cgr">// ✦ Keyset pagination — O(1) regardless of offset</span>
<span class="cr">public async</span> Task&lt;CursorPage&lt;Order&gt;&gt; GetOrdersAsync(
    Guid? afterId, <span class="cb">int</span> pageSize, CancellationToken ct)
{
    <span class="cr">var</span> query = _db.Orders
        .Where(o => afterId == <span class="cr">null</span> || o.Id > afterId)  <span class="cgr">// ✦ keyset</span>
        .OrderBy(o => o.Id)
        .Take(pageSize + <span class="cb">1</span>);                            <span class="cgr">// ✦ +1 to check hasMore

    var</span> items = <span class="cr">await</span> query.ToListAsync(ct);
    <span class="cr">var</span> hasMore = items.Count > pageSize;
    <span class="cr">return new</span> CursorPage&lt;Order&gt;(
        Items: items.Take(pageSize).ToList(),
        NextCursor: hasMore ? items[pageSize - <span class="cb">1</span>].Id : <span class="cr">null</span>);
}`,
      code_bad: `<span class="cgr">// ✗ Offset — O(N) scan at high pages</span>
<span class="cr">public async</span> Task&lt;PagedResult&lt;Order&gt;&gt; GetOrdersAsync(<span class="cb">int</span> page, <span class="cb">int</span> size)
{
    <span class="cr">var</span> total = <span class="cr">await</span> _db.Orders.CountAsync();    <span class="cgr">// extra query</span>
    <span class="cr">var</span> items = <span class="cr">await</span> _db.Orders
        .Skip((page - <span class="cb">1</span>) * size)               <span class="cgr">// 💀 full scan on high pages</span>
        .Take(size).ToListAsync();
    <span class="cr">return new</span>(items, total, page, size);
}`
    },

    /* 03 API Response Shape */
    {
      type: 'evr',
      label: 'topic 2 · pagination api design',
      expect_items: [
        'Return nextCursor (opaque string) — client passes it back as ?after=cursor.',
        'Include hasMore boolean — client knows when to stop requesting next pages.',
        'Link: header with first/next/prev URIs — follows RFC 8288, used by GitHub API.'
      ],
      reality_items: [
        'Exposing database row ID as cursor — leaks internal DB structure, insecure.',
        'No pagination on list endpoints — client fetches 50,000 records for a dropdown.',
        'Inconsistent: some endpoints paged, some not — API consumers cannot guess which.'
      ],
      code: `<span class="cgr">// ✦ Cursor response shape</span>
<span class="cr">public record</span> <span class="cy">CursorPage</span>&lt;T&gt;(
    IReadOnlyList&lt;T&gt; Items,
    <span class="cb">string</span>? NextCursor,  <span class="cgr">// ✦ opaque: Base64(id+timestamp)</span>
    <span class="cb">bool</span> HasMore);

<span class="cgr">// ✦ Opaque cursor — hides internals</span>
<span class="cr">private static string</span> EncodeCursor(Guid id, DateTime createdAt)
    => Convert.ToBase64String(
        Encoding.UTF8.GetBytes(<span class="cg">$"{id}|{createdAt:O}"</span>));

<span class="cgr">// API response:</span>
<span class="cgr">// { items: [...], nextCursor: "Z3VpZHx0aW1l...", hasMore: true }</span>
<span class="cgr">// Next request: GET /orders?after=Z3VpZHx0aW1l...`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · pagination selection matrix',
      cells: [
        { label: 'Offset',           value: 'Page 1–50 on small datasets',   sub: 'Simple, jump to any page — breaks at scale' },
        { label: 'Keyset/Cursor',    value: 'Infinite scroll, large datasets', sub: 'O(1) cost, no skip scan — use for feeds' },
        { label: 'Total Count',      value: 'Only if truly needed (costly)',  sub: 'COUNT(*) on large tables is expensive — avoid' },
        { label: 'Default Page Size',value: 'Max 100, default 20',           sub: 'Document limits — never allow unbounded queries' },
        { label: 'Opaque Cursor',    value: 'Base64 encode id+timestamp',    sub: 'Never expose raw DB IDs in cursors' },
        { label: 'Never', red: true, value: 'Unbounded list endpoints',      sub: 'GET /orders with no limit = potential DoS' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · pagination is a boundary',
      quote_title: 'Every list endpoint without a limit<br>is a <span style="color:var(--red);">potential DoS vector.</span>',
      quote_body: 'An endpoint that returns all orders without pagination will work in development with 20 rows. It will fail in production with 200,000. Default limits should be part of your API contract from day one, not retrofitted after the first production incident.',
      left_label: 'UI drives the pattern choice',
      left_body: 'Offset pagination works for numbered pages ("page 5 of 34"). Cursor/keyset works for infinite scroll. The UI requirement drives the backend pattern — talk to the front-end team before implementing.',
      right_label: 'EF Core and keyset',
      right_body: 'EF Core 8 supports ExecuteUpdate and raw keyset queries efficiently. For complex keyset with composite keys, use Dapper for the pagination query and EF for everything else.',
      insight: 'A <strong style="color:#fff;">compound index on (created_at DESC, id ASC)</strong> is often the most important performance index for paginated list queries. Add it early — adding it retroactively on a large table requires a long migration.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
