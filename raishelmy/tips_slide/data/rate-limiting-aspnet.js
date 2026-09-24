/* ── Rate Limiting in ASP.NET Core ──────────────────────────────── */
window.TIP_DATA = {
  id: 'rate-limiting-aspnet',
  title: 'Rate Limiting in ASP.NET Core',
  description: 'Fixed window, sliding window, token bucket, concurrency limiters — protecting your API from abuse and overload.',
  category: 'ASP.NET · 7 slides',
  tags: ['#ratelimiting', '#aspnetcore', '#dotnet', '#security'],
  date: '2026-04-19',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Public API. No rate limiting.

A misconfigured client started hammering it — 50,000 requests in 30 seconds. Database connection pool exhausted. App down. Pagerduty at 2am.

The fix was eight lines of code. The outage was 45 minutes.

Rate limiting is one of those things that feels optional — until that one day when it clearly is not. Fixed window, sliding window, token bucket, concurrency limiters are all built in to ASP.NET Core now.

Slides on setting it up before the 2am call.

#aspnetcore #dotnet #security #ratelimiting`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Rate Limiting.<br><span style="color:var(--red);">No limits.</span><br><span style="color:#555;font-weight:300;">Script kiddie DoS at midnight.</span>',
      description: 'Public API with no rate limiting. A misconfigured client sends 50,000 requests in 30 seconds. Database connection pool exhausted. App down. Users on the phone. The fix was three lines of code.',
      tags: ['#ratelimiting', '#aspnetcore', '#dotnet', '#security']
    },

    /* 02 Built-in Rate Limiting */
    {
      type: 'evr-code',
      label: 'topic 1 · aspnetcore rate limiting',
      expect_items: [
        '.NET 7+ built-in: AddRateLimiter() — no NuGet needed, four policy types out of the box.',
        'EnableRateLimiting / DisableRateLimiting attributes per controller or endpoint.',
        'Partition by IP, user ID, or API key — per-client limits rather than global.'
      ],
      reality_items: [
        'No rate limiting on public endpoints — DDoS or misbehaving client takes down the service.',
        'Custom middleware from scratch — reinventing what .NET 7 ships built-in.',
        'Global limit only — authenticated users and anonymous users share the same bucket.'
      ],
      code_good: `<span class="cgr">// ✦ .NET 7+ built-in rate limiter</span>
builder.Services.AddRateLimiter(o => {
    o.OnRejected = <span class="cr">async</span> (ctx, ct) => {
        ctx.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        <span class="cr">await</span> ctx.HttpContext.Response.WriteAsync(<span class="cg">"Rate limit exceeded"</span>, ct);
    };
    o.AddPolicy(<span class="cg">"fixed-per-ip"</span>, ctx =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? <span class="cg">"anon"</span>,
            factory: _ => <span class="cr">new</span> FixedWindowRateLimiterOptions {
                PermitLimit = <span class="cb">100</span>, Window = TimeSpan.FromMinutes(<span class="cb">1</span>)
            }));
});
app.UseRateLimiter();`,
      code_bad: `<span class="cgr">// ✗ No rate limiting on public endpoint</span>
app.MapPost(<span class="cg">"/api/login"</span>, <span class="cr">async</span> (LoginDto dto, IAuthService svc) =>
{
    <span class="cgr">// No rate limit — brute force / DoS possible</span>
    <span class="cr">var</span> result = <span class="cr">await</span> svc.LoginAsync(dto);
    <span class="cr">return</span> result.Success ? Results.Ok(result) : Results.Unauthorized();
});`
    },

    /* 03 Strategy Selection */
    {
      type: 'evr',
      label: 'topic 2 · choosing the right algorithm',
      expect_items: [
        'Fixed Window: 100 req/min — simple, may allow 200 requests at window boundary.',
        'Sliding Window: smoother — limits burst at window edges, better for APIs.',
        'Token Bucket: burst-friendly — allows N burst then refills at fixed rate. Best for background jobs.'
      ],
      reality_items: [
        'Fixed window only — window-boundary burst attacks still possible at 2× rate.',
        'Same limit for all endpoints — login endpoint needs 10/min, catalogue search can be 500/min.',
        'No Retry-After header — clients do not know when to retry, causing thundering herd.'
      ],
      code: `<span class="cgr">// ✦ Sliding window — smoother than fixed</span>
o.AddPolicy(<span class="cg">"sliding-api"</span>, ctx =>
    RateLimitPartition.GetSlidingWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? <span class="cg">"anon"</span>,
        _ => <span class="cr">new</span> SlidingWindowRateLimiterOptions {
            PermitLimit = <span class="cb">60</span>, Window = TimeSpan.FromMinutes(<span class="cb">1</span>),
            SegmentsPerWindow = <span class="cb">6</span>  <span class="cgr">// ✦ 10-second buckets</span>
        }));

<span class="cgr">// ✦ Token bucket for burst-tolerant endpoints</span>
o.AddPolicy(<span class="cg">"token-bucket"</span>, _ =>
    RateLimitPartition.GetTokenBucketLimiter(<span class="cg">"global"</span>,
        _ => <span class="cr">new</span> TokenBucketRateLimiterOptions {
            TokenLimit = <span class="cb">200</span>, RefillRate = <span class="cb">50</span>,
            ReplenishmentPeriod = TimeSpan.FromSeconds(<span class="cb">10</span>)
        }));`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · rate limiting matrix',
      cells: [
        { label: 'Fixed Window',    value: '100 req/min per IP',             sub: 'Simple, predictable, edge-burst vulnerability' },
        { label: 'Sliding Window',  value: '100 req/last 60 seconds',        sub: 'Smoother, better fairness, slightly more CPU' },
        { label: 'Token Bucket',    value: 'Burst N then rate R',            sub: 'Best for allowing short bursts gracefully' },
        { label: 'Concurrency',     value: 'Max N simultaneous requests',    sub: 'Protect DB from connection pool exhaustion' },
        { label: 'Partition Key',   value: 'IP, UserId, ApiKey',             sub: 'Per-user limits, not global — fair usage' },
        { label: 'Auth Endpoints', red: true, value: 'Strict limit (5/min)', sub: 'Login, password-reset, OTP — brute force vectors' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · limits are features',
      quote_title: 'Rate limiting is not about<br>distrusting your users — it is about <span style="color:var(--red);">protecting them.</span>',
      quote_body: 'A misconfigured client, a DDoS, a runaway background job — these affect all your users. Rate limiting is a reliability feature, not a security-only concern. Every public endpoint needs a limit.',
      left_label: 'Return Retry-After header',
      left_body: 'On 429 Too Many Requests, include Retry-After: 60 header. Well-behaved clients back off and retry. Without it, clients immediately retry, making the overload worse.',
      right_label: 'Redis for distributed limits',
      right_body: 'Built-in .NET rate limiter is per-instance. In a load-balanced deployment, use Redis-backed rate limiting so limits apply across all instances, not per-pod.',
      insight: 'Apply rate limiting at the <strong style="color:#fff;">Cloudflare / reverse proxy / API gateway level first</strong>. Application-level limiting is the second line of defence. A DDoS that reaches your app has already cost you compute.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
