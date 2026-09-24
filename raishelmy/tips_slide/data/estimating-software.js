/* ── Software Estimation ─────────────────────────────────────── */
window.TIP_DATA = {
  id: 'estimating-software',
  title: 'Software Estimation: Stop Lying to Yourself',
  description: 'Why estimates are always wrong, planning poker fallacies, cone of uncertainty, and how to set expectations that stick.',
  category: 'Project Management · 7 slides',
  tags: ['#estimation', '#planning', '#projectmanagement', '#agile'],
  date: '2026-04-28',
  author: { name: 'Rais Helmy', role: 'Senior Engineer · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `"How long will it take?"

I used to say a number with false confidence. Then I would be wrong by 40%. Stakeholders frustrated. Me frustrated. Repeat every project.

What changed: I stopped estimating tasks and started estimating ranges with explicit assumptions stated out loud. The conversation shifted from "why is it late" to "here is what we know and what we do not."

Not a silver bullet. But significantly better than the planning poker theatre I was doing before.

#softwareestimation #projectmanagement #engineering #agile`,

  slides: [
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Software Estimation.<br><span style="color:var(--red);">Stop lying</span><br><span style="color:#555;font-weight:300;">to yourself.</span>',
      description: 'It\'ll take 2 weeks. Three months later. Why software estimates fail, and what to do instead of pretending precision is possible.',
      tags: ['#estimation', '#planning', '#projectmanagement', '#agile']
    },
    {
      type: 'nuance',
      label: 'truth 1 · the planning fallacy',
      quote_title: 'You are not pessimistic enough about your own work.',
      quote_body: 'The Planning Fallacy (Kahneman) — we estimate based on best-case scenarios while ignoring past failures. Software estimates are optimistic by nature: we imagine the happy path, forget interruptions, unknown unknowns, dependencies, and code that already exists doing the wrong thing.',
      left_label: 'What we mentally model',
      left_body: 'Requirements are clear · No integration surprises · No sick days · No design changes · Existing code is as expected',
      right_label: 'What reality adds',
      right_body: '+30% unclear requirements · +50% integration issues · +holiday/sick time · +2 design pivots · +legacy code surprises',
      insight: '→ Empirical rule: take your gut estimate and multiply by π (3.14). You\'ll be closer to reality than if you multiply by 1.'
    },
    {
      type: 'evr',
      label: 'truth 2 · estimation anti-patterns',
      expect_items: [
        'Estimate ranges, not single points — "3–5 days" is honest; "3 days" is a promise.',
        'Track actuals vs estimates for 3 sprints to find your personal multiplier.',
        'Spike (timebox) unknowns before estimating — never estimate what you haven\'t explored.'
      ],
      reality_items: [
        'Planning poker: "5 points" from the entire team after 30 seconds — false consensus.',
        'Single-point estimates given to management who calendar-block "Done by Tuesday".',
        'Estimating features with external dependencies as if you control the dependency.'
      ],
      code: `<span class="cgr">// ✦ Range estimation + assumptions</span>
<span class="cy">Feature: Payment webhook handler
Estimate: 3–7 days
Assumptions:
  - Stripe sandbox access available (not yet confirmed)
  - Existing Order model can accept status updates
  - No UI changes needed (backend only)
  
If any assumption is wrong: estimate resets.
Current spike needed: verify Stripe sandbox access.
</span>
<span class="cgr">// ✗ Single-point with hidden assumptions</span>
<span class="cr">"3 days" — assumes you know what you don't know</span>`
    },
    {
      type: 'evr',
      label: 'truth 3 · communicating estimates',
      expect_items: [
        'Give ranges with explicit dependencies: "2–4 days, assuming design is final and API docs are ready."',
        'Separate discovery (spike) from delivery — "I need 1 day to investigate before I can estimate."',
        'Update estimates when scope or assumptions change — communicate early, not after the deadline.'
      ],
      reality_items: [
        '"It should be done by Friday" — no, that\'s when you\'ll discover why it isn\'t.',
        'Discovering a blocker on day 3 but staying quiet to avoid disappointing stakeholders.',
        'Constant padding to protect from pressure — creates a culture of inflated estimates that nobody trusts.'
      ],
      code: `<span class="cgr">// ✦ Honest stakeholder communication</span>
<span class="cy">Status update (Day 2 of 5):

Completed: DB schema + basic CRUD
Discovered: Payment provider API has rate limits
            not in the docs. Need to redesign
            the retry logic.

Updated estimate: 5–7 days (was 3–5)
No change to sprint goal — lower priority
tickets can move if needed.
</span>
<span class="cgr">// Early transparency > late surprise</span>`
    },
    {
      type: 'framework',
      label: 'estimation confidence guide',
      cells: [
        { label: 'Cone of uncertainty', value: '4× range early', sub: 'Early project: 1 month = 0.25–4 month actual', red: false },
        { label: 'Spike first', value: '1–2 day max', sub: 'Timeboxed exploration before any estimate', red: false },
        { label: 'Personal multiplier', value: 'Track it', sub: 'Actual / Estimate over 6 sprints = your factor', red: false },
        { label: 'Buffer per feature', value: '+30–50%', sub: 'Integration, communication, review, deploy time', red: false },
        { label: 'Never commit to', value: 'Fixed scope+date', sub: 'Fixed scope OR fixed date — pick one', red: true },
        { label: 'Dependencies', value: 'Separate track', sub: 'External deps get their own risk flag, always', red: false }
      ]
    },
    {
      type: 'cta',
      label: 'found this useful?'
    }
  ]
};
