/* ── Unit Testing .NET: What Actually Works ─────────────────────── */
window.TIP_DATA = {
  id: 'unit-testing-strategies',
  title: 'Unit Testing .NET: What Actually Works',
  description: 'Arrange/Act/Assert, Moq, FluentAssertions, test doubles — building a test suite that catches real bugs, not just lines.',
  category: 'Testing · 7 slides',
  tags: ['#testing', '#dotnet', '#unittesting', '#tdd'],
  date: '2026-04-07',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `High test coverage does not mean your tests are useful.

I have audited codebases with 85% coverage where almost every test was testing implementation details, not behaviour. Change the internals and 60 tests break. Nothing the user experiences was actually at risk.

Tests should tell you when something that matters to the user breaks. Not when you renamed a variable.

Arrange/Act/Assert, Moq, FluentAssertions, what to mock and what not to — the patterns that build a suite that catches real bugs.

#testing #dotnet #unittesting #tdd`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: '.NET Testing.<br><span style="color:var(--red);">Tests that pass.</span><br><span style="color:#555;font-weight:300;">Mean absolutely nothing.</span>',
      description: '100% code coverage with tests that never fail — because they test nothing real. The most dangerous test suite is the one that gives you false confidence.',
      tags: ['#testing', '#dotnet', '#unittesting', '#tdd']
    },

    /* 02 AAA Pattern */
    {
      type: 'evr-code',
      label: 'topic 1 · arrange act assert',
      expect_items: [
        'Clear AAA separation — Arrange setup, Act on system under test, Assert single outcome.',
        'One logical assertion per test — multiple unrelated asserts hide which one failed.',
        'Use FluentAssertions for readable, informative failure messages.'
      ],
      reality_items: [
        '100-line test methods with no structure — impossible to diagnose which step failed.',
        'Asserting implementation details (which private method called) not observable behaviour.',
        'Tests that always pass because they assert nothing meaningful — Assert.IsNotNull(result).'
      ],
      code_good: `<span class="cgr">// ✦ Clean AAA structure</span>
[Fact]
<span class="cr">public async</span> Task CreateOrder_ValidData_ReturnsOrderId()
{
    <span class="cgr">// Arrange</span>
    <span class="cr">var</span> cmd = <span class="cr">new</span> CreateOrderCommand(<span class="cg">"cust-1"</span>, <span class="cb">99.99m</span>);
    <span class="cr">var</span> handler = <span class="cr">new</span> CreateOrderHandler(_repoMock.Object);

    <span class="cgr">// Act</span>
    <span class="cr">var</span> result = <span class="cr">await</span> handler.Handle(cmd, ct);

    <span class="cgr">// Assert</span>
    result.Should().NotBeEmpty();        <span class="cgr">// ✦ FluentAssertions</span>
}`,
      code_bad: `<span class="cgr">// ✗ No structure, asserts implementation detail</span>
[Fact]
<span class="cr">public async</span> Task TestOrder()
{
    <span class="cr">var</span> svc = <span class="cr">new</span> OrderService(_db, _email, _log, _cache);
    <span class="cr">await</span> svc.ProcessAsync(<span class="cr">new</span> OrderDto {
        Id = <span class="cb">1</span>, Items = <span class="cr">null</span>, Total = <span class="cb">-1</span>
    });
    <span class="cgr">// asserts side-effect not result</span>
    _emailMock.Verify(e => e.Send(), Times.Once());
    <span class="cr">Assert</span>.IsNotNull(result);  <span class="cgr">// proves nothing</span>
}`
    },

    /* 03 Test Doubles */
    {
      type: 'evr',
      label: 'topic 2 · mocks fakes stubs',
      expect_items: [
        'Mock external dependencies (DB, HTTP, email) — not pure domain logic.',
        'Prefer fakes (in-memory EF, local SMTP replacements) over complex mocks where possible.',
        'Integration tests cover the stack — unit tests cover business rules.'
      ],
      reality_items: [
        'Mocking DbContext directly — fragile, complex setup, misses real EF query translation.',
        'Zero integration tests — unit tests all green, application broken end-to-end.',
        'Mocking value objects and domain entities that have no I/O.'
      ],
      code: `<span class="cgr">// ✦ Unit test — proper mock</span>
_repoMock
    .Setup(r => r.FindCustomerAsync(<span class="cg">"c-1"</span>, ct))
    .ReturnsAsync(Customer.Create(<span class="cg">"c-1"</span>, <span class="cg">"Rais"</span>));

<span class="cgr">// ✦ Integration test — real EF, in-memory SQLite</span>
<span class="cr">var</span> opts = <span class="cr">new</span> DbContextOptionsBuilder&lt;AppDbContext&gt;()
    .UseSqlite(<span class="cg">"DataSource=:memory:"</span>)
    .Options;
<span class="cr">using var</span> db = <span class="cr">new</span> AppDbContext(opts);
<span class="cr">await</span> db.Database.EnsureCreatedAsync();

<span class="cgr">// ✦ Integration test — WebApplicationFactory</span>
<span class="cr">var</span> client = _factory.CreateClient();
<span class="cr">var</span> res = <span class="cr">await</span> client.PostAsJsonAsync(<span class="cg">"/orders"</span>, cmd);
res.Should().HaveStatusCode(HttpStatusCode.Created);`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · test strategy matrix',
      cells: [
        { label: 'Unit Tests',       value: 'Business rules, domain logic',   sub: 'Fast, isolated, no I/O — run per commit' },
        { label: 'Integration Tests',value: 'EF repos + API endpoints',        sub: 'WebApplicationFactory, in-memory SQLite' },
        { label: 'FluentAssertions', value: 'result.Should().Be(expected)',    sub: 'Readable failures, chained assertions' },
        { label: 'xUnit Fixtures',   value: 'IClassFixture shared setup',      sub: 'DB seeding, HTTP client reuse across tests' },
        { label: 'Test Coverage',    value: 'Branch coverage > line coverage', sub: '100% line coverage is a trap — chase branch' },
        { label: 'Test Naming', red: true, value: 'Method_Scenario_Expected', sub: 'Tests are living documentation' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · coverage ≠ quality',
      quote_title: 'Tests that pass mean nothing<br>if they <span style="color:var(--red);">test nothing real.</span>',
      quote_body: 'A green test suite with 100% coverage where every test is someService.DoWork() and Assert.IsNotNull(result) is worse than no tests — it gives false confidence and slows every refactor.',
      left_label: 'Write failing tests first',
      left_body: 'TDD forces you to think about the interface before implementing it. Even without strict TDD, start the test before the implementation.',
      right_label: 'Test behaviour not internals',
      right_body: 'Tests should not break when you refactor internal implementation. If renaming a private method breaks your tests, your tests are wrong.',
      insight: 'The best test is the <strong style="color:#fff;">simplest test that would fail if the code was broken</strong>. If deleting the implementation still passes, the test proves nothing.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
