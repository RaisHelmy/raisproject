/* ── Healthy Codebase ────────────────────────────────────────── */
window.TIP_DATA = {
  id: 'healthy-codebase',
  title: 'Signs of a Healthy Codebase (and the Red Flags)',
  description: 'Naming conventions, test coverage, coupling metrics, documentation culture, and the green flags that signal maintainable software.',
  category: 'Best Practices · 7 slides',
  tags: ['#bestpractices', '#codequality', '#engineering', '#architecture'],
  date: '2026-05-02',
  author: { name: 'Rais Helmy', role: 'Senior Engineer · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Spent two days reading a codebase I had never seen before.

By the end of day one I could already tell this was going to be painful. Methods with 300 lines. Variables named data2. Tests that tested nothing. Comments explaining what the code did, not why it did it.

You can tell within 30 minutes of reading a codebase whether the team cared. Not about the architecture necessarily — about the craft.

Wrote down the signals I use to make that judgment. And the green flags too, because healthy codebases deserve documenting as much as the antipatterns.

#cleancode #softwareengineering #codequality #engineering`,

  slides: [
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Healthy Codebase.<br><span style="color:var(--red);">Green flags</span><br><span style="color:#555;font-weight:300;">and red flags.</span>',
      description: 'You can sense a healthy codebase within 30 minutes of reading it. Here are the signals that separate maintainable systems from maintenance nightmares.',
      tags: ['#bestpractices', '#codequality', '#engineering', '#architecture']
    },
    {
      type: 'evr',
      label: 'signal 1 · naming and clarity',
      expect_items: [
        'Function names say what they do AND what they return: getUserById(), not getUser() or fetchData().',
        'Boolean names answer a yes/no question: isActive, hasPermission, canEdit.',
        'No abbreviations unless universal (HTTP, ID, URL). "mgr", "proc", "tmpVal" make everyone slower.'
      ],
      reality_items: [
        'handleStuff(), doProcess(), processItems2() — names that require reading the entire body to understand.',
        'Booleans: flag, mode, status — what flag? what mode? what status?',
        'Hungarian notation relics: strUserName, intCount, arrItems — redundant with typed languages.'
      ],
      code: `<span class="cgr">// ✗ Mystery names</span>
<span class="cr">async</span> <span class="cb">function</span> process(data, flag) {
  <span class="cr">if</span> (flag) {
    <span class="cr">const</span> res = <span class="cr">await</span> doStuff(data);
    <span class="cr">return</span> handle(res, 1);
  }
  <span class="cr">return</span> handle(data, 0);
}

<span class="cgr">// ✦ Intention-revealing names</span>
<span class="cr">async</span> <span class="cb">function</span> processOrderRefund(
  order,
  <span class="cy">isPartialRefund</span>
) {
  <span class="cr">if</span> (isPartialRefund) {
    <span class="cr">const</span> refundAmount = <span class="cr">await</span> calculatePartialAmount(order);
    <span class="cr">return</span> issueRefund(order, refundAmount);
  }
  <span class="cr">return</span> issueFullRefund(order);
}`
    },
    {
      type: 'nuance',
      label: 'signal 2 · test coverage vs test quality',
      quote_title: '80% coverage means nothing if the 80% tests wrong things.',
      quote_body: 'Coverage is a proxy, not a goal. A test suite that checks every line but only tests the happy path gives false confidence. Healthy codebases have tests that catch the bugs that actually happen: null inputs, empty arrays, expired sessions, network failures.',
      left_label: 'High-quality tests cover',
      left_body: 'Edge cases (null, empty, boundary values) · Error paths (DB failure, API timeout) · Business invariants ("an order can\'t have negative items")',
      right_label: 'Low-quality tests cover',
      right_body: 'Only the path that always works · Constructor calls to hit coverage numbers · Mocks that mock everything including what\'s being tested',
      insight: '→ Mutation testing (Stryker, PITest) measures test quality rather than test quantity — it\'s the honest coverage metric.'
    },
    {
      type: 'evr',
      label: 'signal 3 · coupling and boundaries',
      expect_items: [
        'Modules have clear public APIs — internals are private and can change without affecting callers.',
        'Dependency direction is intentional: services don\'t depend on controllers.',
        'Cross-module dependencies go through interfaces, not concrete implementations.'
      ],
      reality_items: [
        'Circular dependencies: A imports B which imports C which imports A — modular in name only.',
        'Controllers calling repository methods directly, skipping service layer.',
        'Database models leaking into API responses — changing the schema breaks the client contract.'
      ],
      code: `<span class="cgr">// ✗ Tight coupling — controller knows DB</span>
<span class="cr">class</span> OrderController {
  async getOrder(req) {
    <span class="cr">const</span> row = <span class="cr">await</span> db.query(
      <span class="cy">'SELECT * FROM orders WHERE id = ?'</span>, [req.params.id]
    );
    <span class="cr">return</span> res.json(row[0]);  <span class="cgr">// DB schema == API contract</span>
  }
}

<span class="cgr">// ✦ Boundaries respected</span>
<span class="cr">class</span> OrderController {
  async getOrder(req) {
    <span class="cr">const</span> order = <span class="cr">await</span> this.orderService.findById(req.params.id);
    <span class="cr">return</span> res.json(OrderDto.from(order)); <span class="cgr">// stable DTO</span>
  }
}`
    },
    {
      type: 'framework',
      label: 'codebase health indicators',
      cells: [
        { label: 'Onboarding time', value: '< 1 day to first PR', sub: 'Good README, runnable locally, clear structure', red: false },
        { label: 'Change failure rate', value: 'Tracked', value: '< 15% reverting', sub: 'Deploy-revert rate = real quality signal', red: false },
        { label: 'PR review time', value: '< 4 hours avg', sub: 'Slow review = code waiting = WIP explosion', red: false },
        { label: 'Test flakiness', value: '0 tolerance', sub: 'Flaky tests get fixed or deleted — no exceptions', red: true },
        { label: 'Deploy frequency', value: 'Multiple/week', sub: 'Small frequent deploys = safe, fast feedback', red: false },
        { label: 'Fear of changing X', value: 'Red flag', sub: '"Don\'t touch module Y" = untested, undocumented debt', red: true }
      ]
    },
    {
      type: 'cta',
      label: 'found this useful?'
    }
  ]
};
