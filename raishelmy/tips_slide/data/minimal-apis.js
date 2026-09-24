/* ── Minimal APIs: When to Ditch Controllers ─────────────────────── */
window.TIP_DATA = {
  id: 'minimal-apis',
  title: 'Minimal APIs: When to Ditch Controllers',
  description: 'Minimal API endpoints, route groups, filters, typed results — and when MVC controllers are still the right choice.',
  category: 'ASP.NET · 7 slides',
  tags: ['#minimalapi', '#aspnetcore', '#dotnet', '#webapi'],
  date: '2026-04-14',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Minimal APIs in .NET are genuinely good.

They are also easy to misuse.

I have seen codebases where everything is app.MapGet scattered across six files, no route grouping, no filters, handlers defined inline with 80 lines of logic. At that point you would have more structure for free with controllers.

Minimal APIs shine when kept minimal. Route groups, typed results, endpoint filters — the patterns that let them scale without becoming chaos.

Slides on when to use what.

#dotnet #aspnetcore #minimalapi #csharp`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Minimal APIs.<br><span style="color:var(--red);">One-liner endpoints.</span><br><span style="color:#555;font-weight:300;">Five files to find them.</span>',
      description: 'Minimal API: endpoints defined everywhere, no grouping, no filters, no shared concerns. Six months later you have 40 app.MapGet calls spread across Program.cs and you miss controllers.',
      tags: ['#minimalapi', '#aspnetcore', '#dotnet', '#webapi']
    },

    /* 02 Route Groups */
    {
      type: 'evr-code',
      label: 'topic 1 · route groups & endpoints',
      expect_items: [
        'MapGroup() creates a route group — shared prefix, shared filters, shared auth in one place.',
        'TypedResults returns strongly typed Results<T, ProblemDetails> — OpenAPI knows the response types.',
        'IEndpointRouteBuilder extension methods — organize endpoints into feature modules.'
      ],
      reality_items: [
        '40 app.MapGet / app.MapPost calls in Program.cs — no organization, no shared concerns.',
        'Returning object from lambdas — OpenAPI cannot infer response types, no typed validation.',
        'No route prefixing — /api/v1/orders prefix duplicated on every MapGet call.'
      ],
      code_good: `<span class="cgr">// ✦ Organised route group extension</span>
<span class="cr">public static class</span> <span class="cy">OrdersEndpoints</span>
{
    <span class="cr">public static</span> RouteGroupBuilder MapOrders(
        <span class="cr">this</span> IEndpointRouteBuilder app)
    {
        <span class="cr">var</span> grp = app.MapGroup(<span class="cg">"/api/v1/orders"</span>)
            .RequireAuthorization()
            .WithTags(<span class="cg">"Orders"</span>);

        grp.MapGet(<span class="cg">"/"</span>, GetAll);
        grp.MapGet(<span class="cg">"/{id:int}"</span>, GetById);
        grp.MapPost(<span class="cg">"/"</span>, Create).Accepts&lt;CreateOrderDto&gt;();
        <span class="cr">return</span> grp;
    }
}`,
      code_bad: `<span class="cgr">// ✗ Dumped into Program.cs</span>
app.MapGet(<span class="cg">"/api/orders"</span>, async ([FromServices] IOrderService s)
    => <span class="cr">await</span> s.GetAllAsync());
app.MapGet(<span class="cg">"/api/orders/{id}"</span>, async (<span class="cb">int</span> id, IOrderService s)
    => <span class="cr">await</span> s.GetAsync(id));
app.MapPost(<span class="cg">"/api/orders"</span>, async ([FromBody] CreateOrderDto d, IOrderService s)
    => <span class="cr">await</span> s.CreateAsync(d));
<span class="cgr">// × 37 more lines of this ...</span>`
    },

    /* 03 Typed Results */
    {
      type: 'evr',
      label: 'topic 2 · typed results & filters',
      expect_items: [
        'TypedResults.Ok<T>(), TypedResults.NotFound() — compile-time return type checking.',
        'IEndpointFilter: cross-cutting concerns (logging, validation) without middleware.',
        'Produces<T>() / ProducesResponseType() documents response types in OpenAPI.'
      ],
      reality_items: [
        'Results.Ok(anything) — untyped, OpenAPI shows "any" response type, client SDK is useless.',
        'Repeating FluentValidation logic in every endpoint lambda — no DRY, no filter.',
        'IResult but without ProducesResponseType — Swagger shows no response schema.'
      ],
      code: `<span class="cgr">// ✦ Typed results + endpoint filter</span>
grp.MapPost(<span class="cg">"/"</span>, async Task&lt;Results&lt;Created&lt;OrderDto&gt;, ValidationProblem&gt;&gt;
    (CreateOrderDto dto, IOrderService svc, CancellationToken ct) =>
{
    <span class="cr">var</span> result = <span class="cr">await</span> svc.CreateAsync(dto, ct);
    <span class="cr">return</span> TypedResults.Created(<span class="cg">$"/api/v1/orders/{result.Id}"</span>, result);
})
.AddEndpointFilter&lt;<span class="cy">ValidationFilter</span>&lt;<span class="cy">CreateOrderDto</span>&gt;&gt;()
.WithSummary(<span class="cg">"Create a new order"</span>)
.Produces&lt;OrderDto&gt;(StatusCodes.Status201Created);`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · minimal api vs controllers',
      cells: [
        { label: 'Use Minimal APIs',  value: 'Microservices, small APIs',    sub: 'Few endpoints, fast startup, low overhead' },
        { label: 'Use Controllers',   value: 'Large apps, complex routing',   sub: 'Model binding, action filters, areas, views' },
        { label: 'Route Groups',      value: 'MapGroup() + auth + prefix',    sub: 'Essential — avoid duplication in big APIs' },
        { label: 'TypedResults',      value: 'Results<T, Problem>',           sub: 'OpenAPI autodoc, Kiota/NSwag client generation' },
        { label: 'IEndpointFilter',   value: 'Validation, logging, auth',     sub: 'Equivalent of action filters for minimal APIs' },
        { label: 'Performance', red: true, value: '~5-10% faster than MVC', sub: 'Less middleware, no model state per action' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · minimal api ≠ less structure',
      quote_title: '&ldquo;Minimal&rdquo; refers to ceremony,<br>not to <span style="color:var(--red);">code organisation.</span>',
      quote_body: 'The word "minimal" means no [ApiController] attribute, no ControllerBase, no action method boilerplate. It does not mean all your endpoints in one file. Without route groups and extension methods, minimal APIs become un-navigable quickly.',
      left_label: 'Good for: greenfield microservices',
      left_body: 'Single-concern service, 5–20 endpoints, maximum performance. Minimal APIs shine here — less overhead, faster startup, smaller binary.',
      right_label: 'Keep controllers for: large apps',
      right_body: 'If you have 50+ endpoints, need areas, complex model binding, or ApiController validation behaviour — controllers are still the right tool without shame.',
      insight: 'Mix them: use <strong style="color:#fff;">Minimal APIs for high-performance endpoints</strong> (OAuth callbacks, health checks, webhooks) and controllers for CRUD-heavy domains in the same app.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
