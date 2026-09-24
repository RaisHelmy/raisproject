/* ── Nullable Reference Types Done Right ────────────────────────── */
window.TIP_DATA = {
  id: 'nullable-reference-types',
  title: 'Nullable Reference Types Done Right',
  description: 'NullReferenceException eliminated at compile time — enabling NRTs, null-forgiving operator misuse, and annotation strategy.',
  category: 'C# · 7 slides',
  tags: ['#nullable', '#csharp', '#dotnet', '#codesafety'],
  date: '2026-04-15',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Team enabled nullable reference types.

847 warnings appeared.

Someone decided the fastest fix was ! after every nullable reference. All 847 of them. The project now has #nullable enable in every file and zero actual null safety.

That is not using the feature. That is silencing it.

NRTs are one of the most underrated improvements in modern C# when done properly. The slides show how to roll it out gradually without the null-forgiving operator apocalypse.

#csharp #dotnet #nullable #softwaredevelopment`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Nullable Types.<br><span style="color:var(--red);">A thousand warnings.</span><br><span style="color:#555;font-weight:300;">All suppressed with !.</span>',
      description: 'Team enables nullable reference types. 847 warnings appear. Team adds ! everywhere to silence them. You now have an NRT-enabled project that provides zero null safety. The entire feature is cosmetic.',
      tags: ['#nullable', '#csharp', '#dotnet', '#codesafety']
    },

    /* 02 Enabling NRT */
    {
      type: 'evr-code',
      label: 'topic 1 · enabling nrt correctly',
      expect_items: [
        'Enable globally in project file: <Nullable>enable</Nullable> — enforces annotations everywhere.',
        'Fix warnings by actually annotating nullable return types and parameters — not by adding !.',
        'Use required modifier (C# 11) for properties that must be initialized — replaces [Required].'
      ],
      reality_items: [
        'Enabling NRT then suppressing all warnings with ! — provides zero null safety, just noise.',
        '"We will fix warnings later" — 800 warnings outstanding for 18 months.',
        'Required properties still left as string? Customer — compiler cannot warn on uninitialized.'
      ],
      code_good: `<span class="cgr">// ✦ Proper nullable annotations</span>
<span class="cr">public class</span> <span class="cy">Order</span>
{
    <span class="cr">public required</span> <span class="cb">string</span> CustomerId { get; init; }  <span class="cgr">// ✦ required C#11</span>
    <span class="cr">public</span> <span class="cb">string</span>? Notes { get; init; }                <span class="cgr">// ✦ ? = nullable OK</span>
    <span class="cr">public</span> Address? ShippingAddress { get; init; }     <span class="cgr">// ✦ explicitly optional</span>
}

<span class="cgr">// ✦ Nullable return type</span>
<span class="cr">public async</span> Task&lt;Order?&gt; FindAsync(<span class="cb">int</span> id, CancellationToken ct)
    => <span class="cr">await</span> _db.Orders.FindAsync(id, ct);  <span class="cgr">// ← null if not found</span>`,
      code_bad: `<span class="cgr">// ✗ null-forgiving operator abuse</span>
<span class="cr">public class</span> <span class="cy">Order</span>
{
    <span class="cr">public</span> <span class="cb">string</span> CustomerId { get; set; } = <span class="cr">null</span>!;  <span class="cgr">// 💀 lie to compiler</span>
    <span class="cr">public</span> Address ShippingAddress { get; set; } = <span class="cr">null</span>!;
}

<span class="cr">var</span> order = <span class="cr">await</span> _repo.FindAsync(id)!;  <span class="cgr">// ! without null check</span>
<span class="cr">var</span> name = order.Customer!.Name!.ToUpper();  <span class="cgr">// chain of lies`
    },

    /* 03 Null Patterns */
    {
      type: 'evr',
      label: 'topic 2 · null patterns in practice',
      expect_items: [
        'Null-coalescing assignment ??= for lazy init — clean one-liner initialization.',
        'Pattern matching null check: if (order is null) return NotFound() — explicit and clear.',
        'ArgumentNullException.ThrowIfNull(param) — replaces verbose null guard boilerplate.'
      ],
      reality_items: [
        'obj != null nested everywhere — hard to read, easy to get wrong precedence.',
        'Catching NullReferenceException as control flow — the wrong abstraction for missing data.',
        'Using null to mean "not found" in domain objects — use Optional<T> or Result<T> pattern.'
      ],
      code: `<span class="cgr">// ✦ Modern null patterns</span>
ArgumentNullException.ThrowIfNull(command);   <span class="cgr">// ✦ C# 10 guard</span>

<span class="cr">var</span> order = <span class="cr">await</span> _repo.FindAsync(id, ct);
<span class="cr">if</span> (order <span class="cr">is null</span>) <span class="cr">return</span> Results.NotFound();   <span class="cgr">// ✦ pattern match</span>

<span class="cgr">// ✦ Coalescing assignment — lazy init</span>
_cache ??= <span class="cr">new</span> Dictionary&lt;<span class="cb">string</span>, Order&gt;();

<span class="cgr">// ✦ Null-conditional chain — safe navigation</span>
<span class="cr">var</span> city = order.Customer?.Address?.City ?? <span class="cg">"Unknown"</span>;

<span class="cgr">// ✦ List pattern (C# 11)</span>
<span class="cr">if</span> (items <span class="cr">is</span> [] <span class="cr">or</span> <span class="cr">null</span>) <span class="cr">return</span> Results.NoContent();`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · nrt strategy matrix',
      cells: [
        { label: 'Project File',     value: '<Nullable>enable</Nullable>',    sub: 'Enable globally — never per-file pragma' },
        { label: 'required (C#11)',  value: 'Mandatory init property',        sub: 'Replaces constructor enforcement for records' },
        { label: '! Operator',       value: 'Use sparingly with comment WHY', sub: 'Legitimate use: EF nav props after Include()' },
        { label: 'string? vs string',value: 'Explicit optional vs required',  sub: 'Makes intent clear at API boundaries' },
        { label: 'ThrowIfNull',      value: 'ArgumentNullException.ThrowIfNull', sub: 'One-line public API guard' },
        { label: 'Never', red: true, value: 'string prop = null!;',          sub: 'Mutes compiler without fixing the real problem' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · nrt is a contract',
      quote_title: 'NRT is a compile-time contract,<br>not a <span style="color:var(--red);">runtime guarantee.</span>',
      quote_body: 'Nullable Reference Types tell the compiler and your teammates what can and cannot be null. They do not prevent NullReferenceException at runtime from unvalidated external inputs. JSON deserialization, EF, and external APIs still produce nulls at the boundary.',
      left_label: 'EF Core nav properties',
      left_body: 'EF Core navigation properties loaded via Include() are non-null after the query. The legitimate use of ! is on EF nav properties: Order.Customer! — document why with a comment.',
      right_label: 'Migrate incrementally',
      right_body: 'Enable NRT, then fix warnings file by file (#nullable enable at file top). Do not enable globally and suppress everything. Fix means annotating correctly, not silencing.',
      insight: 'A <strong style="color:#fff;">codebase with NRT enabled and zero warnings</strong> is a meaningful achievement. It means every nullable boundary is documented. Worth the migration effort over 2–3 sprints.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
