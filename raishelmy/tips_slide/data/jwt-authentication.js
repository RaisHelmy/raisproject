/* ── JWT Authentication in ASP.NET Core ─────────────────────────── */
window.TIP_DATA = {
  id: 'jwt-authentication',
  title: 'JWT Authentication in ASP.NET Core',
  description: 'JWT validation, claims-based authorization, token refresh, and the security mistakes that get apps compromised.',
  category: 'Security · 7 slides',
  tags: ['#jwt', '#authentication', '#aspnetcore', '#security'],
  date: '2026-04-12',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Found a JWT secret key hardcoded in appsettings.json. In a public repository.

The app had been live for eight months. The key was still active. Anyone who found that repo could generate valid tokens for any user ID in the system.

JWT implementation looks straightforward until you map out all the ways it can go wrong — key management, algorithm confusion, token expiry, refresh token rotation.

Slides on doing it properly so you are not one git push away from a full auth bypass.

#jwt #security #aspnetcore #authentication`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'JWT Auth.<br><span style="color:var(--red);">Secret in appsettings.</span><br><span style="color:#555;font-weight:300;">Committed to git.</span>',
      description: 'JWT secret key hardcoded in appsettings.json. Committed to a public repo. Attacker generates tokens for any user ID. This is still happening in production systems in 2026.',
      tags: ['#jwt', '#authentication', '#aspnetcore', '#security']
    },

    /* 02 JWT Setup */
    {
      type: 'evr-code',
      label: 'topic 1 · secure jwt configuration',
      expect_items: [
        'Load JWT secret from environment variables or Azure Key Vault — never appsettings.json.',
        'Validate issuer, audience, and lifetime in AddJwtBearer — do not skip any validation.',
        'Use RS256 (asymmetric) in production — issuer has private key, validators need only public key.'
      ],
      reality_items: [
        'JWT secret in appsettings.json committed to git — anyone with repo access can forge tokens.',
        'TokenValidationParameters.ValidateLifetime = false — tokens never expire, no revocation possible.',
        'Algorithm: "none" accepted by parser — attacker strips signature, server accepts unsigned tokens.'
      ],
      code_good: `<span class="cgr">// ✦ Load from environment, not config file</span>
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o => {
        o.TokenValidationParameters = <span class="cr">new</span> TokenValidationParameters {
            ValidIssuer   = builder.Configuration[<span class="cg">"Jwt:Issuer"</span>],
            ValidAudience = builder.Configuration[<span class="cg">"Jwt:Audience"</span>],
            IssuerSigningKey = <span class="cr">new</span> SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(
                    Environment.GetEnvironmentVariable(<span class="cg">"JWT_SECRET"</span>)!)),
            ValidateIssuer    = <span class="cr">true</span>,     <span class="cgr">// ✦ all true</span>
            ValidateAudience  = <span class="cr">true</span>,
            ValidateLifetime  = <span class="cr">true</span>,
            ValidAlgorithms   = [SecurityAlgorithms.HmacSha256]
        };
    });`,
      code_bad: `<span class="cgr">// ✗ Secret in config, minimal validation</span>
.AddJwtBearer(o => {
    o.TokenValidationParameters = <span class="cr">new</span> TokenValidationParameters {
        IssuerSigningKey  = <span class="cr">new</span> SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(
                config[<span class="cg">"Jwt:Secret"</span>]!)),  <span class="cgr">// ← appsettings.json 💀</span>
        ValidateIssuer   = <span class="cr">false</span>,    <span class="cgr">// ← all false 💀</span>
        ValidateAudience = <span class="cr">false</span>,
        ValidateLifetime = <span class="cr">false</span>
    };
});`
    },

    /* 03 Claims & Authorization */
    {
      type: 'evr',
      label: 'topic 2 · claims & policy authorization',
      expect_items: [
        'Put role and permission claims in the token — avoid extra DB lookups per request.',
        'Use policy-based authorization over role-based — [Authorize(Policy = "CanViewOrders")].',
        'ClaimTypes.NameIdentifier for user ID — parse once in a base controller, not every action.'
      ],
      reality_items: [
        'Storing user role in JWT sub claim — confusing, non-standard, breaks third-party parsers.',
        'DB lookup every request to check permissions — defeats the purpose of token-based auth.',
        'No claim validation — trusting any JWT claim without checking it exists and is valid.'
      ],
      code: `<span class="cgr">// ✦ Policy-based authorization</span>
builder.Services.AddAuthorization(o =>
{
    o.AddPolicy(<span class="cg">"CanManageOrders"</span>, policy =>
        policy.RequireClaim(<span class="cg">"permission"</span>, <span class="cg">"orders:write"</span>));
});

[Authorize(Policy = <span class="cg">"CanManageOrders"</span>)]
<span class="cr">public class</span> <span class="cy">OrdersController</span> : ControllerBase { }

<span class="cgr">// ✦ Extract ID once — base controller</span>
<span class="cr">protected</span> Guid UserId =>
    Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

<span class="cgr">// ✦ Token claims issued:</span>
<span class="cgr">// sub: userId, email: x, permission: orders:write, exp: unix`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · jwt security checklist',
      cells: [
        { label: 'Secret Storage',  value: 'Env var / Key Vault',         sub: 'Never in appsettings.json or source code' },
        { label: 'Algorithm',       value: 'HS256 (dev) RS256 (prod)',     sub: 'Explicitly whitelist — reject "none" algorithm' },
        { label: 'Token Expiry',    value: 'Access: 15m, Refresh: 7d',    sub: 'Short-lived access + refresh rotation' },
        { label: 'Claims',          value: 'sub, email, permissions',      sub: 'Keep token small — avoid large claim payloads' },
        { label: 'Revocation',      value: 'Blocklist with Redis/DB',      sub: 'Check jti claim on logout / password change' },
        { label: 'HTTPS Only', red: true, value: 'RequireHttpsMetadata=true', sub: 'Never transmit JWT over plain HTTP in production' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · jwts are not sessions',
      quote_title: 'A JWT cannot be invalidated<br>once issued — unless you <span style="color:var(--red);">build revocation.</span>',
      quote_body: 'The stateless nature of JWT is both its strength and its weakness. Once issued, the token is valid until expiry. If a user is compromised, their token stays valid. Plan for revocation from day one.',
      left_label: 'Refresh token rotation',
      left_body: 'Issue short-lived access tokens (15 minutes) with long-lived refresh tokens (7 days). Rotate refresh tokens on use — detect token theft via reuse detection.',
      right_label: 'Claims vs roles',
      right_body: 'Roles are coarse-grained. Permission claims are fine-grained. Use permission claims like "orders:write" instead of role "Admin" — easier to audit, easier to restrict.',
      insight: '<strong style="color:#fff;">Decode a JWT in jwt.io right now</strong> and check what is inside your production tokens. If you see sensitive data, database IDs you did not intend to expose, or missing validation claims — fix it today.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
