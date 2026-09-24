/* ── Managing Tech Debt ──────────────────────────────────────── */
window.TIP_DATA = {
  id: 'managing-tech-debt',
  title: 'Tech Debt: When to Pay, When to Walk Away',
  description: 'Not all tech debt is equal. Strategic debt vs reckless debt, refactoring ROI, and how to sell prioritisation to stakeholders.',
  category: 'Business · 7 slides',
  tags: ['#techdebt', '#refactoring', '#engineering', '#business'],
  date: '2026-04-29',
  author: { name: 'Rais Helmy', role: 'Senior Engineer · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Not all tech debt needs to be fixed.

Some is deliberate. A shortcut taken to hit a deadline, with a plan to revisit. That is fine. That is engineering.

The problem is when teams cannot tell the difference between "acceptable shortcuts we will address later" and "this is actively blocking us from moving forward." One is strategy. The other is a crisis that has not been named yet.

I have seen teams rewrite entire systems because nobody had the conversation about which debt was worth paying down and when.

These slides are the framework I use to structure that conversation with stakeholders.

#techdebt #softwarearchitecture #engineering #refactoring`,

  slides: [
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Tech Debt.<br><span style="color:var(--red);">When to pay.</span><br><span style="color:#555;font-weight:300;">When to accept it.</span>',
      description: 'Not all tech debt is a crisis. Some is strategic. The problem is when teams can\'t tell the difference — and when engineers cry wolf, eroding stakeholder trust over time.',
      tags: ['#techdebt', '#refactoring', '#engineering', '#business']
    },
    {
      type: 'nuance',
      label: 'frame 1 · types of tech debt',
      quote_title: 'Debt has an interest rate. Know yours.',
      quote_body: 'Ward Cunningham\'s original metaphor: deliberate debt (we know the shortcut) vs inadvertent debt (we didn\'t know better). The former is a business decision. The latter is the result of learning. Only reckless debt — shortcuts taken carelessly — is always bad.',
      left_label: 'Deliberate (strategic)',
      left_body: '"We\'ll use a direct DB call for now to hit the launch date — we\'ll abstract it in Q2." Known, tracked, planned.',
      right_label: 'Reckless (crisis)',
      right_body: 'No tests, no documentation, magic strings everywhere, functions named "doStuff2". Nobody knows why. Nobody documented the shortcut.',
      insight: '→ Document deliberate debt the moment it\'s created: what shortcut was taken, why, and what the repayment plan is. Undocumented shortcuts become reckless debt within 60 days.'
    },
    {
      type: 'evr',
      label: 'frame 2 · when to prioritise refactoring',
      expect_items: [
        'Refactor on the path of new features — the boy scout rule: leave code cleaner than you found it.',
        'Prioritise debt that slows new feature delivery by >20% — measurable business impact.',
        'Track "flow debt" — the code areas engineers avoid because they\'re painful to change.'
      ],
      reality_items: [
        '"We need a full rewrite quarter" — never approved, never scoped. Debt grows instead.',
        'Refactoring tickets sitting in backlog for 8 months with no business justification.',
        'Engineers complaining about debt to each other but not translating impact for stakeholders.'
      ],
      code: `<span class="cgr">// ✦ Business-case framing for debt</span>
<span class="cy">Tech Debt: Order Processing Module

Current cost: 3 days to add any new payment method
             due to tightly coupled legacy code.

Last quarter: 2 features delayed 1.5 weeks each = 3 weeks.
Estimated Q3: 3 features planned = ~4.5 week delay risk.

Refactor cost: 1 sprint (2 weeks)
ROI: breakeven after 1 feature in Q3
Recommendation: prioritise in next sprint as investment,
                not maintenance.</span>`
    },
    {
      type: 'evr',
      label: 'frame 3 · selling debt to stakeholders',
      expect_items: [
        'Translate debt to delivery risk, not engineering aesthetics: "This slows feature delivery by X days."',
        'Show the compound effect: debt grows over time if not addressed — like financial interest.',
        'Propose a % allocation: "We reserve 20% of sprint capacity for debt reduction each sprint."'
      ],
      reality_items: [
        '"The code is messy" — stakeholder hears: engineer complaining, doesn\'t see business risk.',
        'Asking for a full sprint of "refactoring" with no measurable outcome: stakeholders reject it.',
        'No tracking — same debt argument made every quarter with no evidence anything changed.'
      ],
      code: `<span class="cgr">// ✦ 20% rule framing</span>
<span class="cy">Proposal: Reserve 20% sprint capacity for debt.

This doesn't slow features — it prevents slowdown.
Current trend: 5% slower feature delivery per quarter
              as the codebase grows without maintenance.

With 20% debt budget:
  - Q3: same velocity as today
  - Q4: +10% faster than without maintenance
  - Year 2: team avoids the "big rewrite" conversation

Tracked by: deployment frequency + lead time metrics.</span>`
    },
    {
      type: 'framework',
      label: 'tech debt triage matrix',
      cells: [
        { label: 'High pain + frequent touch', value: 'Fix next sprint', sub: 'Slows daily work, high ROI on fix', red: false },
        { label: 'High pain + rare touch', value: 'Document & isolate', sub: 'Wrap with an abstraction, don\'t touch internals', red: false },
        { label: 'Low pain + frequent touch', value: 'Boy-scout rule', sub: 'Incrementally improve while passing through', red: false },
        { label: 'Low pain + rare touch', value: 'Accept it', sub: 'Technical debt with negligible interest rate', red: false },
        { label: 'Unknown pain', value: 'Spike first', sub: 'Understand the cost before committing to a fix', red: false },
        { label: 'Rewrite urge', value: 'Strong resist', sub: 'Rewrites almost always reveal why the original existed', red: true }
      ]
    },
    {
      type: 'cta',
      label: 'found this useful?'
    }
  ]
};
