/* ── REST API Versioning Done Right ─────────────────────────────── */
window.TIP_DATA = {
  id: 'api-versioning',
  title: 'REST API Versioning Done Right',
  description: 'URL, header, and media-type versioning in ASP.NET Core. Breaking changes without breaking clients at 3am.',
  category: 'API · 7 slides',
  tags: ['#api', '#versioning', '#aspnetcore', '#restapi'],
  date: '2026-04-08',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Renamed a response field from customerId to customer_id.

Three integrations broke overnight. One was a payment provider. Another was a government portal. Queue the 2am calls.

That was the day I got serious about API versioning.

Not the most exciting topic. But get it wrong once in production and you will not skip it again.

URL versioning, header versioning, deprecation headers, migration timelines — the full picture in these slides.

#api #dotnet #backendengineering #aspnetcore`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'API Versioning.<br><span style="color:var(--red);">Breaking changes.</span><br><span style="color:#555;font-weight:300;">At 3am on a Friday.</span>',
      description: 'You rename a field. Three clients break. Nobody knew they were using it. API versioning is not optional — it is the contract you have with your consumers.',
      tags: ['#api', '#versioning', '#aspnetcore', '#restapi']
    },

    /* 02 Versioning strategies */
    {
      type: 'evr-code',
      label: 'topic 1 · versioning strategies',
      expect_items: [
        'URL versioning (/api/v1/) — simple, cacheable, bookmark-friendly for consumers.',
        'Header versioning (X-Api-Version: 2.0) — cleaner URLs, better for REST purists.',
        'Combine readers: URL first, header as fallback — maximum client compatibility.'
      ],
      reality_items: [
        'No versioning at all — every change is a breaking change affecting every client simultaneously.',
        'Version in URL but all routes map to same controllers — cosmetic versioning that does nothing.',
        '"We will add versioning later" — by the time you want it, you have 12 clients to migrate.'
      ],
      code_good: `<span class="cgr">// ✦ Asp.Versioning.Http NuGet</span>
builder.Services.AddApiVersioning(o => {
    o.DefaultApiVersion = <span class="cr">new</span> ApiVersion(<span class="cb">1</span>, <span class="cb">0</span>);
    o.AssumeDefaultVersionWhenUnspecified = <span class="cr">true</span>;
    o.ReportApiVersions = <span class="cr">true</span>;   <span class="cgr">// ← adds version headers in responses</span>
    o.ApiVersionReader = ApiVersionReader.Combine(
        <span class="cr">new</span> UrlSegmentApiVersionReader(),
        <span class="cr">new</span> HeaderApiVersionReader(<span class="cg">"X-Api-Version"</span>));
});

[ApiVersion(<span class="cg">"2.0"</span>)]
[Route(<span class="cg">"api/v{version:apiVersion}/orders"</span>)]`,
      code_bad: `<span class="cgr">// ✗ No versioning at all</span>
[Route(<span class="cg">"api/orders"</span>)]
<span class="cr">public class</span> <span class="cy">OrdersController</span> : ControllerBase
{
    <span class="cgr">// Changing response shape breaks ALL clients</span>
    <span class="cgr">// Cannot run v1 and v2 simultaneously</span>
    <span class="cgr">// Cannot deprecate gracefully</span>
    <span class="cgr">// "We'll add versioning later" ← never happens</span>
}`
    },

    /* 03 Deprecation */
    {
      type: 'evr',
      label: 'topic 2 · deprecation & sunset',
      expect_items: [
        'Sunset header (Sunset: Sat, 01 Jan 2027) tells consumers exactly when version retires.',
        'Mark old controllers with Deprecated = true — response headers warn consumers automatically.',
        'Maintain N-1 version — never drop a version without minimum 6 months deprecation notice.'
      ],
      reality_items: [
        'v1 deleted same day v2 launches — partner integrations break with no warning.',
        'No communication about deprecation — consumers discover via HTTP 410 Gone in production.',
        'All versions point to same code path — versioning is theatre, not functional separation.'
      ],
      code: `<span class="cgr">// ✦ Mark version deprecated with Sunset header</span>
[ApiVersion(<span class="cg">"1.0"</span>, Deprecated = <span class="cr">true</span>)]
[Route(<span class="cg">"api/v{version:apiVersion}/orders"</span>)]
<span class="cr">public class</span> <span class="cy">OrdersV1Controller</span> : ControllerBase
{
    <span class="cr">public</span> IActionResult Get()
    {
        Response.Headers.Append(
            <span class="cg">"Sunset"</span>, <span class="cg">"Sat, 01 Jan 2027 00:00:00 GMT"</span>);
        <span class="cr">return</span> Ok(_mapper.MapToV1(_service.GetAll()));
    }
}

<span class="cgr">// Response includes automatically:</span>
<span class="cgr">// api-deprecated-versions: 1.0</span>
<span class="cgr">// api-supported-versions: 2.0</span>`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · versioning decision matrix',
      cells: [
        { label: 'URL Segment',    value: '/api/v2/orders',          sub: 'Best for: public APIs, browsable, cacheable' },
        { label: 'Header',         value: 'X-Api-Version: 2.0',      sub: 'Best for: internal APIs, REST purists' },
        { label: 'Query String',   value: '?api-version=2.0',         sub: 'Best for: testing, legacy system integration' },
        { label: 'Breaking Change',value: 'New version required',     sub: 'Removing fields, changing types, new auth' },
        { label: 'Non-Breaking',   value: 'Same version OK',          sub: 'Adding optional fields, new endpoints' },
        { label: 'Sunset Policy', red: true, value: 'Min 6 months',  sub: 'Sunset header + direct email to API consumers' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · your api is a contract',
      quote_title: 'Breaking an API without warning<br>is <span style="color:var(--red);">breaking a promise.</span>',
      quote_body: 'Your API consumers — internal teams, mobile apps, partner integrations — have production code that depends on your contract. Treat version deprecation like a legal notice, not a git commit message.',
      left_label: 'Version from day one',
      left_body: 'Adding versioning to an unversioned API later is painful. Start with /api/v1/ even if v2 never exists. The overhead is zero, the future flexibility is massive.',
      right_label: 'Document every version',
      right_body: 'Use Swashbuckle to generate separate OpenAPI docs per version. Consumers should never guess what changed between v1 and v2.',
      insight: 'The <strong style="color:#fff;">best API change</strong> is the one you never have to make — because your original design was extensible enough that it never needed breaking.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
