/* ── Best Practices: My Engineering Playbook — Rais Helmy ──────── */
window.TIP_DATA = {
  id: 'best-practices-rais',
  title: 'My Engineering Playbook: How I Build Scalable, Maintainable Software',
  description: 'A comprehensive walkthrough of my engineering approach — how I assess before coding, enforce .NET and React best practices, rescue failing projects, and deliver enterprise-grade systems across insurance, defence, utility, and government domains.',
  category: 'Best Practices · 20 slides',
  tags: ['#dotnet', '#react', '#cleancode', '#architecture', '#interview'],
  date: '2026-04-08',
  author: { name: 'Rais Helmy', role: 'Senior .NET Engineer · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `I get asked often: how do you know where to start when you're handed a new feature or a broken system?

The answer is: I don't start coding. Not yet.

After 6+ years building enterprise .NET systems — from insurance backends at Etiqa, to a police C4i command centre at PDRM, to field engineering platforms at TNB — I've learned that the most expensive bugs are the ones you introduced because you solved the wrong problem.

Here's my actual playbook: how I assess before I code, the .NET and React practices I enforce from day one, how I rescue broken projects, and what "clean code" actually looks like in production under BNM regulation.

#dotnet #react #cleancode #architecture #softwareengineering`,

  slides: [

    /* ════════════════════════════════════════════════════════════════
       1. COVER
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'cover', dark: true,
      label: 'engineering playbook · rais helmy',
      title_html: 'My Engineering<br><span style="color:var(--red);">Playbook.</span><br><span style="color:#555;font-weight:300;">6+ years of code that lasts.</span>',
      description: 'How I assess a situation before touching code, implement .NET and React best practices, rescue failing projects, and deliver enterprise systems across insurance (Etiqa), defence (PDRM), and utility (TNB) domains in Malaysia.',
      tags: ['#dotnet', '#react', '#cleancode', '#architecture', '#interview']
    },

    /* ════════════════════════════════════════════════════════════════
       2. FRAMEWORK: Career at a Glance
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'framework',
      label: 'career at a glance · 6+ years',
      cells: [
        { label: 'Current Role', value: 'Sr .NET Developer', sub: 'Etiqa Insurance · Clean Architecture · CQRS · BNM Regulated', red: false },
        { label: 'Previous', value: 'Sr Technical Consultant', sub: 'TNB ESS & TOMAS · SAP · FlutterFlow · .NET 6', red: false },
        { label: 'Architecture', value: 'Solution Architect', sub: 'PDRM C4i · ArcGIS · SIP/PBX · VMware HCI', red: false },
        { label: 'Domains', value: 'Insurance · Defence · Utility', sub: 'Etiqa · PDRM · TNB · Government', red: false },
        { label: 'Core stack', value: '.NET 8 · React · Flutter', sub: 'SQL Server · Oracle · Cloudflare Workers', red: false },
        { label: 'Known for', value: 'Project rescue specialist', sub: 'Reverse-engineer, rebuild, ship under pressure', red: true }
      ]
    },

    /* ════════════════════════════════════════════════════════════════
       3. NUANCE: Phase 0 — Assess Before You Code
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'nuance',
      label: 'phase 0 · assess before you code',
      quote_title: 'I never write line one before I understand the problem.',
      quote_body: 'Whether it\'s a greenfield feature, a production bug at Etiqa, or an inherited codebase at TNB — I spend the first 20–30% of the effort just understanding context. What is the real problem? Who is affected? What does success look like? What exists already that I can extend instead of rewrite? At PDRM C4i, I spent two weeks producing HLD/LLD documentation before writing a single line of code. At TNB TOMAS, I spent the first sprint reverse-engineering a broken project before proposing my rebuild plan.',
      left_label: 'Questions I always ask first',
      left_body: 'What is the business outcome, not just the ticket? · Who are the stakeholders and what are their constraints? · What is the current system doing — trace it before changing it · What\'s the blast radius if this breaks? · Is there existing code or pattern that already solves 80% of this? · What regulatory or compliance requirements exist (BNM, PDRM)?',
      right_label: 'How I assess — real tools',
      right_body: 'Read the codebase before writing any code — grep, trace call stacks, git blame · Reproduce the bug or behaviour locally · Write down assumptions — validate with team + stakeholder · Sketch sequence diagrams for non-trivial flows · Check existing integration contracts (SAP, Oracle, LDAP) · Review change request history and regression patterns',
      insight: '→ My rule: if I cannot explain the problem in two sentences without jargon, I am not ready to implement. Ambiguous problems produce ambiguous solutions.'
    },

    /* ════════════════════════════════════════════════════════════════
       4. NUANCE: Project Rescue — TNB TOMAS
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'nuance',
      label: 'real story · rescuing tnb tomas',
      quote_title: 'I inherited a broken project. I rebuilt it from scratch.',
      quote_body: 'TNB TOMAS was an Asset & Permit Management System for Tenaga Nasional Berhad field engineers. When I joined, the project had broken source code, a non-functional mobile app, and no clear architecture. My first move was NOT to start coding — I spent the initial sprint performing a full reverse-engineering audit to diagnose why it was failing. Then I proposed and executed a complete rebuild.',
      left_label: 'What I did',
      left_body: 'Reverse-engineered the broken source code to understand original intent · Rebuilt mobile app from scratch using FlutterFlow + Flutter/Dart · Re-architected .NET 6 REST API with JWT auth + LDAP/AD SSO · Integrated SAP for asset master data sync · Designed multi-layer approval workflow engine · Delivered Asset, Permit, Health Monitoring, and Grid modules',
      right_label: 'Why it worked',
      right_body: 'Assessed before coding: spent a full sprint on diagnosis before proposing a plan · Clean separation: API ↔ Mobile ↔ SAP integration had clear boundaries · Workflow engine was configurable by role, group, asset category, and org hierarchy · iOS Enterprise + Android distribution via provisioning profiles · Direct stakeholder coordination with TNB operations team',
      insight: '→ Lesson: the temptation is to start fresh immediately. But if you don\'t understand why the previous attempt failed, you\'ll repeat the same mistakes with cleaner code.'
    },

    /* ════════════════════════════════════════════════════════════════
       5. EVR + CODE: .NET — Clean Architecture + CQRS
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'evr-code',
      label: '.net best practice 1 · clean architecture + cqrs',
      expect_items: [
        'Strict inward dependency: Presentation → Application → Domain. Infrastructure implements Application contracts.',
        'Commands mutate state. Queries read state. Never mix read/write in the same handler. This is how I structure Etiqa backend.',
        'Domain layer has zero infrastructure dependencies — no EF Core, no HttpClient, no DI containers inside entities.'
      ],
      reality_items: [
        'God controllers: 400-line action methods with EF queries, business rules, and email sending all mixed together.',
        'Anemic domain models: entities are just data bags with getters/setters. All logic lives in "Service" classes.',
        'DbContext injected directly into controllers — the domain has no boundary and the schema becomes the API contract.'
      ],
      code_good: `<span class="cgr">// ✦ How I structure it at Etiqa — Command + Handler</span>
<span class="cb">public record</span> <span class="cy">ApproveClaimCommand</span>(
    Guid ClaimId, Guid ApprovedBy
) : IRequest&lt;<span class="cg">Result</span>&gt;;

<span class="cb">public class</span> <span class="cy">ApproveClaimHandler</span>
    : IRequestHandler&lt;ApproveClaimCommand, Result&gt;
{
  <span class="cb">public async</span> Task&lt;Result&gt; Handle(
      ApproveClaimCommand cmd, CancellationToken ct)
  {
    <span class="cr">var</span> claim = <span class="cr">await</span> _repo.GetByIdAsync(cmd.ClaimId, ct);
    <span class="cr">if</span> (claim <span class="cr">is null</span>)
        <span class="cr">return</span> Result.Fail(<span class="cy">"Claim not found"</span>);

    claim.Approve(cmd.ApprovedBy); <span class="cgr">// domain logic</span>
    <span class="cr">await</span> _repo.SaveAsync(ct);
    <span class="cr">return</span> Result.Ok();
  }
}`,
      code_bad: `<span class="cgr">// ✗ Fat controller — everything in one place</span>
[HttpPost(<span class="cy">"{id}/approve"</span>)]
<span class="cb">public async</span> Task&lt;IActionResult&gt; Approve(Guid id)
{
  <span class="cr">var</span> claim = <span class="cr">await</span> _db.Claims
      .Include(c => c.Documents)
      .FirstOrDefaultAsync(c => c.Id == id);
  <span class="cr">if</span> (claim == <span class="cr">null</span>) <span class="cr">return</span> NotFound();

  <span class="cgr">// business logic in controller 🚩</span>
  claim.Status = <span class="cy">"Approved"</span>;
  claim.ApprovedAt = DateTime.UtcNow;
  <span class="cr">await</span> _db.SaveChangesAsync();
  <span class="cr">await</span> _emailSvc.SendApproval(claim); <span class="cgr">// 🚩</span>
  <span class="cr">return</span> Ok();
}`
    },

    /* ════════════════════════════════════════════════════════════════
       6. EVR + CODE: .NET — DDD + Repository Pattern
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'evr-code',
      label: '.net best practice 2 · ddd + repository + unit of work',
      expect_items: [
        'Rich domain models: business rules live inside entities. Order.Approve() enforces invariants — not a service class.',
        'Repository abstracts persistence. Application layer never writes SQL or references DbContext directly.',
        'Unit of Work ensures transactional consistency across aggregate changes — one SaveChanges per business operation.'
      ],
      reality_items: [
        'Domain models are just POCOs with public setters — any code can mutate state without validation.',
        'Repositories that are just wrappers around DbContext.Set<T>() — adding no value, just indirection.',
        'Multiple SaveChanges calls in one request — partial failures corrupt business state.'
      ],
      code_good: `<span class="cgr">// ✦ Rich domain with enforced invariants</span>
<span class="cb">public class</span> <span class="cy">Policy</span> : AggregateRoot
{
  <span class="cb">public</span> PolicyStatus Status { <span class="cr">get</span>; <span class="cr">private set</span>; }
  <span class="cb">public</span> DateTime? RenewedAt { <span class="cr">get</span>; <span class="cr">private set</span>; }

  <span class="cb">public</span> Result Renew(DateTime effectiveDate)
  {
    <span class="cr">if</span> (Status != PolicyStatus.Active)
      <span class="cr">return</span> Result.Fail(
        <span class="cy">"Cannot renew non-active policy"</span>
      );

    Status = PolicyStatus.Renewed;
    RenewedAt = effectiveDate;
    AddDomainEvent(<span class="cr">new</span> PolicyRenewedEvent(Id));
    <span class="cr">return</span> Result.Ok();
  }
}`,
      code_bad: `<span class="cgr">// ✗ Anemic model — anyone can break rules</span>
<span class="cb">public class</span> <span class="cy">Policy</span>
{
  <span class="cb">public</span> <span class="cr">string</span> Status { <span class="cr">get</span>; <span class="cr">set</span>; }
  <span class="cb">public</span> DateTime? RenewedAt { <span class="cr">get</span>; <span class="cr">set</span>; }
  <span class="cgr">// No validation — anyone writes anything</span>
}

<span class="cgr">// business logic in a service</span>
policy.Status = <span class="cy">"Renewed"</span>; <span class="cgr">// typo? "renewed"?</span>
policy.RenewedAt = DateTime.Now; <span class="cgr">// local, not UTC 🚩</span>`
    },

    /* ════════════════════════════════════════════════════════════════
       7. EVR: .NET — Logging, Error Handling, Compliance
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'evr',
      label: '.net best practice 3 · structured logging + error handling',
      expect_items: [
        'Serilog with structured properties — every log has correlation ID, user context, and operation name queryable in Application Insights.',
        'Global exception middleware returns ProblemDetails (RFC 7807) — no stack traces leak to clients.',
        'Audit trail on every mutation: who, when, what changed. At Etiqa this is BNM-mandated.',
        'AMLA watchlist batch jobs have separate logging pipelines with compliance-grade retention.'
      ],
      reality_items: [
        'Console.WriteLine() and catch(Exception ex) { /* swallow */ } in production.',
        'Inconsistent error formats: some endpoints return { error: "..." }, others return 500 with HTML.',
        'No correlation ID — impossible to trace a single request across services.',
        'Audit? "We\'ll add it later." (Later never comes.)'
      ],
      code: `<span class="cgr">// ✦ Structured logging — Etiqa pattern</span>
Log.Information(
    <span class="cy">"Processing AMLA watchlist batch {BatchId} "</span> +
    <span class="cy">"for {ProfileCount} profiles"</span>,
    batch.Id,
    batch.Profiles.Count
);

<span class="cgr">// ✦ Global error middleware — ProblemDetails</span>
app.UseExceptionHandler(appErr =&gt; {
    appErr.Run(<span class="cr">async</span> ctx =&gt; {
        ctx.Response.ContentType = <span class="cy">"application/problem+json"</span>;
        <span class="cr">var</span> pd = <span class="cr">new</span> ProblemDetails {
            Status = 500,
            Title  = <span class="cy">"An unexpected error occurred"</span>,
            Detail = <span class="cy">"Ref: "</span> + ctx.TraceIdentifier
        };
        <span class="cr">await</span> ctx.Response.WriteAsJsonAsync(pd);
    });
});`
    },

    /* ════════════════════════════════════════════════════════════════
       8. EVR + CODE: .NET — API Security + JWT + LDAP
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'evr-code',
      label: '.net best practice 4 · api security · jwt + ldap',
      expect_items: [
        'JWT with proper claims — roles, permissions, and tenancy embedded. Refresh tokens stored securely, short-lived access tokens.',
        'LDAP / Active Directory integration for enterprise SSO — I\'ve done this at TNB TOMAS and PDRM C4i.',
        'RBAC enforced at the API level — [Authorize(Roles = "...")] plus policy-based authorization for complex scenarios.'
      ],
      reality_items: [
        'JWT tokens that never expire, stored in localStorage with no refresh rotation.',
        'Username/password checked by querying DB on every request instead of validating a signed token.',
        'Authorization checked in the UI only — backend endpoints accept anyone who sends the right JSON.'
      ],
      code_good: `<span class="cgr">// ✦ JWT + LDAP integration (TNB TOMAS pattern)</span>
<span class="cb">public async</span> Task&lt;AuthResult&gt; Authenticate(
    LoginDto login)
{
  <span class="cgr">// 1. Validate against AD/LDAP</span>
  <span class="cr">var</span> ldapUser = <span class="cr">await</span> _ldapService
      .ValidateCredentials(
          login.Username, login.Password);
  <span class="cr">if</span> (!ldapUser.IsValid)
      <span class="cr">return</span> AuthResult.Fail(<span class="cy">"Invalid credentials"</span>);

  <span class="cgr">// 2. Map AD groups to application roles</span>
  <span class="cr">var</span> roles = MapAdGroupsToRoles(ldapUser.Groups);

  <span class="cgr">// 3. Issue short-lived JWT + refresh token</span>
  <span class="cr">var</span> token = _tokenService.GenerateJwt(
      ldapUser, roles, TimeSpan.FromMinutes(15));
  <span class="cr">return</span> AuthResult.Ok(token);
}`,
      code_bad: `<span class="cgr">// ✗ Auth in controller, no LDAP, long-lived token</span>
[HttpPost(<span class="cy">"login"</span>)]
<span class="cb">public</span> IActionResult Login(LoginDto login)
{
  <span class="cr">var</span> user = _db.Users.FirstOrDefault(
    u =&gt; u.Name == login.User
      && u.Password == login.Pass <span class="cgr">// 🚩 plaintext!</span>
  );
  <span class="cr">if</span> (user == <span class="cr">null</span>) <span class="cr">return</span> Unauthorized();

  <span class="cr">var</span> token = GenerateToken(user,
    TimeSpan.FromDays(365)); <span class="cgr">// 🚩 1 year!</span>
  <span class="cr">return</span> Ok(<span class="cr">new</span> { token });
}`
    },

    /* ════════════════════════════════════════════════════════════════
       9. EVR: React — Structure + State Ownership
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'evr',
      label: 'react best practice 1 · structure + state ownership',
      expect_items: [
        'One component, one responsibility. If a component has more than one reason to change, split it.',
        'State lives as close to its consumers as possible. Lift only when two+ siblings genuinely share it.',
        'Server state (API data) managed by React Query — never useState + useEffect + fetch chains.',
        'Custom hooks extract domain logic, not just effects. If a hook only wraps useEffect, it\'s not abstracting enough.'
      ],
      reality_items: [
        '300-line "God components" that fetch data, compute derived values, handle forms, and render JSX all at once.',
        'Global store holding UI state that belongs in local component state — a global "loading" flag for one button.',
        'useEffect with empty deps as componentDidMount — masking missing dependency warnings.',
        'Prop-drilling 4+ levels deep instead of composing with compound components or context for UI state.'
      ],
      code: `<span class="cgr">// ✦ Focused components + React Query</span>
<span class="cb">function</span> <span class="cy">useOrderDetails</span>(orderId) {
  <span class="cr">return</span> useQuery({
    queryKey: [<span class="cy">'order'</span>, orderId],
    queryFn: () =&gt; api.orders.getById(orderId),
    staleTime: 1000 * 60 * 5,
  });
}

<span class="cb">function</span> <span class="cy">OrderPage</span>({ orderId }) {
  <span class="cr">const</span> { data, isLoading, error } = useOrderDetails(orderId);
  <span class="cr">if</span> (isLoading) <span class="cr">return</span> &lt;<span class="cy">OrderSkeleton</span> /&gt;;
  <span class="cr">if</span> (error)     <span class="cr">return</span> &lt;<span class="cy">ErrorBoundary</span> error={error} /&gt;;
  <span class="cr">return</span> &lt;<span class="cy">OrderDetails</span> order={data} /&gt;;
}

<span class="cgr">// OrderDetails — pure render, no data fetching</span>
<span class="cb">function</span> <span class="cy">OrderDetails</span>({ order }) {
  <span class="cr">return</span> (
    &lt;section&gt;
      &lt;h2&gt;{order.title}&lt;/h2&gt;
      &lt;<span class="cy">OrderItems</span> items={order.items} /&gt;
      &lt;<span class="cy">OrderTotal</span> total={order.total} /&gt;
    &lt;/section&gt;
  );
}`
    },

    /* ════════════════════════════════════════════════════════════════
       10. NUANCE: Scalable & Maintainable — Principles
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'nuance',
      label: 'principle · scalable + maintainable code',
      quote_title: 'Scalability is not about handling 10× users. It\'s about handling 10× requirements.',
      quote_body: 'The systems that fail at scale aren\'t necessarily slow — they\'re the ones where no one can change them safely anymore. At Etiqa, I maintain backend systems serving insurance lifecycle APIs under BNM regulation. At TNB, I inherited a monolith with thousands of users. The pattern is the same: tight coupling, missing abstractions, and logic scattered across layers make every new feature a risk. I design for changeability first, performance second.',
      left_label: 'What I enforce from day one',
      left_body: 'Dependency inversion — depend on interfaces, not concretions · Single Responsibility — every class/function does one thing well · Fail fast at boundaries — validate input at the edge, trust internal state · Explicit over clever — readable beats "elegant" one-liners · No premature abstraction — solve the actual problem, not the hypothetical one',
      right_label: 'Where codebases hit a wall',
      right_body: '"Util" classes that become rubbish bins · Business logic scattered across controllers, services, and repositories · Missing boundaries — any module can call any other module · Tests that test implementation details, brittle to refactoring · Configuration hardcoded rather than externalised · "Don\'t touch that module" — untested undocumented debt',
      insight: '→ My measure: can a new developer make a change correctly without reading more than 3 files? If not, the boundary or naming is wrong.'
    },

    /* ════════════════════════════════════════════════════════════════
       11. EVR + CODE: Clean Code — Naming + SRP
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'evr-code',
      label: 'clean code · naming + single responsibility',
      expect_items: [
        'Functions say what they do AND what they return: IsEligibleForDiscount(), CalculateRefundAmount().',
        'Classes have one reason to change. OrderValidator does not send emails or write to the DB.',
        'Magic values are named constants or enums — no hardcoded "3", "ACTIVE", or "0x02" in business logic.'
      ],
      reality_items: [
        'ProcessData(), HandleRequest(), DoStuff() — names that describe nothing about what actually happens.',
        '"Helper" classes that accumulate 40 unrelated methods spanning 5 domains.',
        'if (status == 1 || status == 3 || type == "admin") — what does 1 mean? Why "admin"?'
      ],
      code_good: `<span class="cgr">// ✦ Intention-revealing + single purpose</span>
<span class="cb">public class</span> <span class="cy">PolicyRenewalEligibilityChecker</span>
{
  <span class="cr">private const int</span> <span class="cy">MinActiveMonths</span> = 6;

  <span class="cb">public</span> <span class="cr">bool</span> IsEligible(<span class="cy">Policy</span> policy)
  {
    <span class="cr">return</span> policy.Status == PolicyStatus.Active
        && policy.ActiveMonths &gt;= MinActiveMonths
        && !policy.HasPendingClaims;
  }
}

<span class="cgr">// caller reads like English:</span>
<span class="cr">if</span> (renewalChecker.IsEligible(policy))
    policy.Renew(effectiveDate);`,
      code_bad: `<span class="cgr">// ✗ Mystery names + side effects</span>
<span class="cb">public class</span> <span class="cy">Utilities</span>
{
  <span class="cb">public</span> <span class="cr">bool</span> Check(<span class="cy">Policy</span> p)
  {
    <span class="cr">if</span> (p.S == 1 && p.M &gt;= 6 && !p.PC)
    {
      SendEmail(p.Email); <span class="cgr">// 🚩 side effect in check!</span>
      LogToDb(<span class="cy">"checked"</span>); <span class="cgr">// 🚩 DB in a validator!</span>
      <span class="cr">return true</span>;
    }
    <span class="cr">return false</span>;
  }
}`
    },

    /* ════════════════════════════════════════════════════════════════
       12. NUANCE: Enterprise Integration Approach
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'nuance',
      label: 'enterprise integration · sap + oracle + ldap + arcgis',
      quote_title: 'Integration is where most enterprise projects fail.',
      quote_body: 'Across Etiqa, TNB, and PDRM, I\'ve integrated with SAP HR/ERP, Oracle, SQL Server, LDAP/AD, Esri ArcGIS, PolisyM, MDM, SIP/PBX, XMPP/Jitsi, and VMS video systems. The pattern is always the same: never trust the external system\'s documentation. Always build a local integration test that proves the contract before writing business logic.',
      left_label: 'My integration discipline',
      left_body: 'Verify the real API contract — not the docs, the actual responses · Build adapter/gateway classes — isolate third-party APIs behind your own interface · Handle failures explicitly: SAP down? Queue the request. Oracle timeout? Retry with backoff · Log every external call with correlation ID, latency, and response status · Data mapping lives in one place — never scattered across multiple services',
      right_label: 'Systems I\'ve integrated',
      right_body: 'SAP HR/ERP (TNB: employee data, payroll, asset sync) · Oracle + SQL Server (Etiqa: policy data, PolisyM, MDM) · LDAP/AD (TNB TOMAS + PDRM: SSO + RBAC) · Esri ArcGIS (PDRM: incident mapping, geospatial analytics) · SIP/PBX + XMPP/Jitsi (PDRM: emergency dispatch + comms) · VMS/RTSP (PDRM: CCTV live feeds)',
      insight: '→ Key: every external system gets its own adapter. Your domain never knows about SAP field names or Oracle column types. The adapter translates.'
    },

    /* ════════════════════════════════════════════════════════════════
       13. NUANCE: PDRM C4i — Architecture at Scale
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'nuance',
      label: 'real story · pdrm c4i command & control',
      quote_title: 'I architected a command centre for the Royal Malaysia Police.',
      quote_body: 'PDRM C4i is a next-generation Command, Control, Communications, Computers & Intelligence platform covering real-time dispatch, GIS mapping, emergency telephony, unified comms, and video surveillance. I served as Solution Architect — responsible for the full system design from HLD/LLD to deployment on hyperconverged VMware ESXi infrastructure.',
      left_label: 'What I architected',
      left_body: '.NET Core 5/6 API backend with RSS feed ingestion · Esri ArcGIS for live incident mapping and geospatial analytics · SIP/PBX telephony for emergency call routing · XMPP/Jitsi/Openfire for unified messaging + video · VMS with RTSP/MJPEG live feed streaming · Active Directory RBAC for all subsystems',
      right_label: 'Infrastructure I designed',
      right_body: 'Hyperconverged VMware ESXi — compute, storage, networking in HA cluster · VPN perimeter: IPSec (RadioIP) + OpenVPN + Softether · nginx + caddy reverse proxy with TLS termination · Security risk assessment + data retention policy · HLD/LLD documentation + architecture diagrams · Liaised directly with PDRM stakeholders for UAT + alignment',
      insight: '→ This project taught me that architecture documents are not bureaucracy — they\'re the only thing standing between your team and a 2am production call with stakeholders you can\'t explain things to.'
    },

    /* ════════════════════════════════════════════════════════════════
       14. EVR: Etiqa — BNM Compliance + AMLA
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'evr',
      label: 'real story · etiqa insurance — bnm compliance',
      expect_items: [
        'Engineered enterprise insurance backend using Clean Architecture + CQRS with MediatR — strict layer separation.',
        'Built AMLA Watchlist Batch Job: automated pipeline fetching external watchlist, entity screening, sanction matching, and compliance audit trails.',
        'User Profile Screening: real-time identity verification, risk flagging, role-based approval workflows.',
        'Integrated SQL Server, Oracle, MDM, PolisyM — covering underwriting, endorsements, renewals, and claims lifecycle.'
      ],
      reality_items: [
        'In regulated environments, "move fast and break things" gets you a BNM audit finding — not a feature release.',
        'Every change goes through a structured CR process: impact assessment, regression test plan, UAT sign-off.',
        'Audit logging is not optional — every mutation needs a who/when/what trail queryable by compliance team.',
        'Zero-tolerance for partial deployments — you deploy the full CR or you roll back. No in-between.'
      ],
      code: `<span class="cgr">// ✦ AMLA Watchlist Batch Job — Etiqa pattern</span>
<span class="cb">public class</span> <span class="cy">AmlaWatchlistJob</span> : IScheduledJob
{
  <span class="cb">public async</span> Task ExecuteAsync(CancellationToken ct)
  {
    <span class="cgr">// 1. Fetch external watchlist source</span>
    <span class="cr">var</span> watchlist = <span class="cr">await</span> _watchlistProvider
        .FetchLatestAsync(ct);

    <span class="cgr">// 2. Screen all active profiles</span>
    <span class="cr">var</span> profiles = <span class="cr">await</span> _profileRepo
        .GetActiveProfilesAsync(ct);

    <span class="cr">foreach</span> (<span class="cr">var</span> profile <span class="cr">in</span> profiles)
    {
      <span class="cr">var</span> match = watchlist.Screen(profile);
      <span class="cr">if</span> (match.IsHighRisk)
      {
        <span class="cr">await</span> _flagService.FlagForReview(
            profile, match, ct);
        <span class="cgr">// 3. Compliance audit trail (BNM)</span>
        _auditLog.LogScreeningResult(
            profile.Id, match, BatchId);
      }
    }
  }
}`
    },

    /* ════════════════════════════════════════════════════════════════
       15. EVR + CODE: FlutterFlow + Mobile Best Practices
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'evr-code',
      label: 'mobile · flutterflow + flutter/dart',
      expect_items: [
        'Mobile architecture: clean separation between UI, state management, and API layer — even in FlutterFlow.',
        'JWT token stored securely (FlutterSecureStorage, not SharedPreferences). Refresh token rotation on expiry.',
        'Offline-first design for field engineering apps: queue operations when no connectivity, sync when back online.',
        'iOS Enterprise + Android distribution: enterprise provisioning profiles, managed deployment pipelines.'
      ],
      reality_items: [
        'Business logic in UI widgets — rebuilding the same validation in 5 different screens.',
        'API calls scattered across widgets with no central error handling or retry logic.',
        'Token stored in plain SharedPreferences — any rooted device can read it.',
        '"Just upload to Google Drive" instead of proper enterprise distribution channels.'
      ],
      code_good: `<span class="cgr">// ✦ TNB TOMAS — API service layer</span>
<span class="cb">class</span> <span class="cy">AssetApiService</span> {
  <span class="cb">final</span> ApiClient _client;
  <span class="cb">final</span> TokenManager _tokens;

  Future&lt;List&lt;Asset&gt;&gt; getAssets() <span class="cb">async</span> {
    <span class="cr">final</span> response = <span class="cr">await</span> _client.get(
      <span class="cy">'/api/assets'</span>,
      headers: _tokens.authHeaders,
    );
    <span class="cr">return</span> response.data
      .map((j) =&gt; Asset.fromJson(j))
      .toList();
  }
}`,
      code_bad: `<span class="cgr">// ✗ API call directly in widget build()</span>
<span class="cb">class</span> <span class="cy">AssetPage</span> <span class="cb">extends</span> StatefulWidget {
  @override
  _State createState() =&gt; _State();
}
<span class="cb">class</span> _State <span class="cb">extends</span> State&lt;AssetPage&gt; {
  @override
  <span class="cr">void</span> initState() {
    http.get(<span class="cy">'https://api.tnb.com/assets'</span>,
      headers: {<span class="cy">'token'</span>: prefs.getString(<span class="cy">'t'</span>)!}
    ).then((r) {
      setState(() { data = json.decode(r.body); });
    }); <span class="cgr">// No error handling 🚩</span>
  }
}`
    },

    /* ════════════════════════════════════════════════════════════════
       16. EVR: Database Best Practices
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'evr',
      label: 'databases · sql server + oracle + ef core',
      expect_items: [
        'Schema design with proper normalization, foreign keys, and indexes. Migration-first approach using EF Core migrations or Flyway.',
        'AsNoTracking for read queries. Projection (Select) over loading entire entities. Pagination using cursor/keyset, not OFFSET.',
        'Connection pooling configured properly. No DbContext leak across async boundaries.',
        'Write operations use explicit transactions. Read-heavy paths hit read replicas where available.'
      ],
      reality_items: [
        'SELECT * FROM everything WHERE something — no indexes, no projection, loading 50 columns to display 3.',
        'N+1 queries: loop over orders, then for each order do a separate query for items.',
        'String concatenation for SQL: $"WHERE name = \'{input}\'" — SQL injection waiting to happen.',
        'One giant connection string with sa credentials, shared across all services.'
      ],
      code: `<span class="cgr">// ✦ EF Core — projection + pagination</span>
<span class="cr">var</span> policies = <span class="cr">await</span> _db.Policies
    .AsNoTracking()
    .Where(p =&gt; p.Status == PolicyStatus.Active)
    .OrderBy(p =&gt; p.CreatedAt)
    .Select(p =&gt; <span class="cr">new</span> PolicySummaryDto {
        Id = p.Id,
        Number = p.PolicyNumber,
        Premium = p.Premium
    })
    .Take(pageSize + 1) <span class="cgr">// cursor: fetch N+1</span>
    .ToListAsync(ct);

<span class="cr">var</span> hasMore = policies.Count &gt; pageSize;
<span class="cr">if</span> (hasMore) policies.RemoveAt(pageSize);

<span class="cgr">// ✗ What NOT to do</span>
<span class="cgr">// var all = await _db.Policies.ToListAsync();</span>
<span class="cgr">// return all.Skip(page * size).Take(size);</span>
<span class="cgr">// ↑ loads ENTIRE table into memory 🚩</span>`
    },

    /* ════════════════════════════════════════════════════════════════
       17. NUANCE: DevOps, CI/CD & Infrastructure
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'nuance',
      label: 'devops · infrastructure · ci/cd',
      quote_title: 'I\'ve designed infrastructure from bare metal to edge serverless.',
      quote_body: 'From hyperconverged VMware ESXi clusters at PDRM to Cloudflare Workers edge deployments for personal projects — I understand the full infrastructure spectrum. At PDRM, I designed HA clusters, VPN perimeters, and reverse proxy topology. At Etiqa, I work with Azure DevOps CI/CD. For my own platforms, I deploy serverless on Cloudflare Workers with D1 and R2.',
      left_label: 'Enterprise infrastructure',
      left_body: 'VMware ESXi: hyperconverged compute + storage + networking · VPN perimeter: IPSec, OpenVPN, Softether · Active Directory: RBAC, group policy, SSO federation · nginx + caddy: reverse proxy, TLS termination, load balancing · Docker: containerised .NET apps with multi-stage builds · GitLab CI/CD + Azure DevOps: pipeline automation',
      right_label: 'Edge & serverless',
      right_body: 'Cloudflare Workers: edge compute with sub-millisecond cold starts · D1: SQLite at the edge for globally distributed reads · R2: object storage for uploads and assets · Pages: static site deployment with CI from GitHub · Wrangler: local dev + deploy CLI · Zero infrastructure cost at idle — pay per request',
      insight: '→ The skill isn\'t in knowing one tool — it\'s in choosing the right one. PDRM needed on-premise HA. Etiqa needs regulated cloud. My sites need zero-cost edge. Different problems, different solutions.'
    },

    /* ════════════════════════════════════════════════════════════════
       18. FRAMEWORK: Technical Skills Matrix
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'framework',
      label: 'technical skills matrix',
      cells: [
        { label: '.NET Ecosystem', value: '.NET 6/7/8 · ASP.NET Core', sub: 'Clean Architecture · CQRS · MediatR · DDD · EF Core · REST API', red: false },
        { label: 'Mobile', value: 'FlutterFlow · Flutter · Dart', sub: 'iOS Enterprise · Android · JWT · Secure Storage', red: false },
        { label: 'Frontend', value: 'React · HTML/CSS/JS', sub: 'React Query · Component composition · Cloudflare Pages', red: false },
        { label: 'Databases', value: 'SQL Server · Oracle · PostgreSQL', sub: 'D1 (edge SQLite) · Schema design · EF Core migrations', red: false },
        { label: 'Integration', value: 'SAP · LDAP/AD · ArcGIS', sub: 'PolisyM · MDM · SIP/PBX · XMPP/Jitsi · VMS/RTSP', red: false },
        { label: 'Infrastructure', value: 'VMware · Docker · Cloudflare', sub: 'nginx · VPN perimeter · GitLab CI · Azure DevOps', red: false }
      ]
    },

    /* ════════════════════════════════════════════════════════════════
       19. FRAMEWORK: Interview — My Engineering Checklist
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'framework',
      label: 'my checklist — before shipping any feature',
      cells: [
        { label: 'Problem understood?', value: 'Explain in 2 sentences', sub: 'Stakeholder + technical intent both clear before code', red: false },
        { label: 'Existing code read?', value: 'Always first', sub: 'Trace call stack, git blame, understand current state', red: false },
        { label: 'Layer boundaries?', value: 'Domain logic in Domain', sub: 'No EF/HTTP deps in domain. Clean Architecture enforced', red: false },
        { label: 'Integration isolated?', value: 'Adapters for externals', sub: 'SAP, Oracle, LDAP behind interfaces. Domain never knows', red: false },
        { label: 'Logging + audit?', value: 'Structured from day 1', sub: 'Serilog, correlation ID, BNM audit trail, ProblemDetails', red: true },
        { label: 'Tested + CR compliant?', value: 'UAT + regression before deploy', sub: 'Impact assessed. Rollback plan documented. No partial deploy', red: false }
      ]
    },

    /* ════════════════════════════════════════════════════════════════
       20. CTA
       ════════════════════════════════════════════════════════════════ */
    {
      type: 'cta',
      label: 'want to work together?'
    }
  ]
};
