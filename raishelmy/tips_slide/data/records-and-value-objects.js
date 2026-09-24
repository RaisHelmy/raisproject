/* ── Records vs Value Objects vs Classes ─────────────────────────── */
window.TIP_DATA = {
  id: 'records-and-value-objects',
  title: 'Records vs Value Objects vs Classes',
  description: 'C# records, DDD value objects, immutability — choosing the right type for money, IDs, and domain concepts.',
  category: 'C# · 7 slides',
  tags: ['#records', '#csharp', '#ddd', '#immutability'],
  date: '2026-04-16',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `A method took two decimal parameters: price and discount.

Called with the wrong order. Both were valid decimals. No compiler error. Discount applied as price, price applied as discount.

Shipped to QA. QA missed it. Finance noticed three days later.

A Money type and a Percentage type would have made this impossible at compile time. The types themselves become the documentation and the enforcement.

C# records and value objects are the lightweight answer to this class of bug. When to use them, what they give you, where they stop helping — in these slides.

#csharp #ddd #dotnet #typedesign`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Records & Value Objects.<br><span style="color:var(--red);">Passing around</span><br><span style="color:#555;font-weight:300;">raw decimals for money.</span>',
      description: 'A method accepts decimal price and decimal discount. Which is which? Wrong order, silent bug. A Money value object would have made this impossible. Types are your first line of defence.',
      tags: ['#records', '#csharp', '#ddd', '#immutability']
    },

    /* 02 Records for DTOs */
    {
      type: 'evr-code',
      label: 'topic 1 · records for data transfer',
      expect_items: [
        'record: immutable POCO with structural equality — perfect for DTOs, commands, events.',
        'record struct: stack-allocated, value semantics — for small, frequently created data like Point.',
        'with expressions: non-destructive mutation — create modified copies of immutable records.'
      ],
      reality_items: [
        'Mutable class DTOs with {get;set;} — accidental mutation, no equality semantics, verbose.',
        'records used for entities — EF Core change tracking conflicts with immutable records.',
        'Manually overriding Equals/GetHashCode on class DTOs — boilerplate that records eliminate.'
      ],
      code_good: `<span class="cgr">// ✦ Records for commands and DTOs</span>
<span class="cr">public record</span> <span class="cy">CreateOrderCommand</span>(
    <span class="cb">string</span> CustomerId,
    IReadOnlyList&lt;OrderItem&gt; Items,
    <span class="cb">string</span>? Notes = <span class="cr">null</span>);

<span class="cr">public record</span> <span class="cy">OrderItem</span>(<span class="cb">int</span> ProductId, <span class="cb">int</span> Qty, Money Price);

<span class="cgr">// ✦ with expression — non-destructive copy</span>
<span class="cr">var</span> updated = original <span class="cr">with</span> { Notes = <span class="cg">"urgent"</span> };

<span class="cgr">// ✦ Structural equality built-in</span>
cmd1 == cmd2  <span class="cgr">// true if all fields equal — no override needed</span>`,
      code_bad: `<span class="cgr">// ✗ Mutable DTO class</span>
<span class="cr">public class</span> <span class="cy">CreateOrderCommand</span>
{
    <span class="cr">public string</span> CustomerId { get; set; }  <span class="cgr">// mutable — accidents waiting</span>
    <span class="cr">public List</span>&lt;OrderItem&gt; Items { get; set; }  <span class="cgr">// mutable list</span>

    <span class="cr">public override bool</span> Equals(object? obj) { <span class="cgr">/* ... 20 lines ... */</span> }
    <span class="cr">public override int</span> GetHashCode() { <span class="cgr">/* ... 20 lines ... */</span> }
}`
    },

    /* 03 Value Objects */
    {
      type: 'evr',
      label: 'topic 2 · ddd value objects',
      expect_items: [
        'Value Object: equality by value, immutable, contains validation — Money(amount, currency).',
        'Primitive obsession antipattern: using string for email, decimal for money, Guid for IDs.',
        'Wrapping primitives prevents wrong-order argument bugs at compile time.'
      ],
      reality_items: [
        'AddProduct(string name, decimal price, decimal discount) — which decimal is which?',
        'Email validation spread across multiple services — Email value object validates once on creation.',
        'Guid userId and Guid orderId passed to wrong parameters — silent bugs.'
      ],
      code: `<span class="cgr">// ✦ Money value object</span>
<span class="cr">public record</span> <span class="cy">Money</span>(<span class="cb">decimal</span> Amount, <span class="cb">string</span> Currency)
{
    <span class="cr">public static</span> Money MYR(<span class="cb">decimal</span> amount)
    {
        <span class="cr">if</span> (amount &lt; <span class="cb">0</span>) <span class="cr">throw new</span> DomainException(<span class="cg">"Negative money"</span>);
        <span class="cr">return new</span>(<span class="cb">Math.Round</span>(amount, <span class="cb">2</span>), <span class="cg">"MYR"</span>);
    }
    <span class="cr">public</span> Money Add(Money other)
    {
        <span class="cr">if</span> (Currency != other.Currency) <span class="cr">throw new</span> DomainException(<span class="cg">"Currency mismatch"</span>);
        <span class="cr">return this with</span> { Amount = Amount + other.Amount };
    }
}
<span class="cgr">// Now: void ApplyDiscount(Money price, Money discount) — unambiguous`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · type selection matrix',
      cells: [
        { label: 'record',          value: 'DTOs, Commands, Events',         sub: 'Immutable, structural equality, with expressions' },
        { label: 'record struct',   value: 'Small value types (Point, Range)', sub: 'Stack allocated, copy semantics, no inheritance' },
        { label: 'Value Object',    value: 'Domain concepts (Money, Email)',  sub: 'Validation on creation, behaviours attached' },
        { label: 'class',           value: 'Entities, services, repositories', sub: 'Reference semantics, tracked by EF Core' },
        { label: 'struct',          value: 'Interop, unsafe, raw perf',       sub: 'Only when you have profiled allocation as bottleneck' },
        { label: 'Avoid', red: true,value: 'Primitive obsession',            sub: 'Wrap domain concepts in types — not raw primitives' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · types encode intent',
      quote_title: 'A method that accepts <span style="color:var(--red);">two Guids</span><br>in the wrong order compiles fine.',
      quote_body: 'CustomerId and OrderId are both Guid. A method with the wrong parameter order is a runtime bug. UserId userId, OrderId orderId — two distinct types — makes that impossible to compile.',
      left_label: 'EF Core + value objects',
      left_body: 'EF Core supports value object mapping via OwnsOne(). Map Money as an owned type — Amount and Currency stored as columns in the same table without a separate entity.',
      right_label: 'Records are not entities',
      right_body: 'Do not use records for EF entities. EF Core relies on reference equality for change tracking — records break this because their equality is structural, not reference-based.',
      insight: '<strong style="color:#fff;">Every primitive in your domain model is a potential bug</strong>. Email, Phone, Money, CustomerId, OrderStatus — these deserve their own types. It takes ten minutes to create one. It saves hours of debugging.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
