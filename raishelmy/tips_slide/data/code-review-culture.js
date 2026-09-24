/* ── Code Review Culture ─────────────────────────────────────── */
window.TIP_DATA = {
  id: 'code-review-culture',
  title: 'Code Reviews: The Culture Most Teams Get Wrong',
  description: 'What to review, what to skip, how to give and receive feedback without politics, and building a review culture that ships faster.',
  category: 'Best Practices · 7 slides',
  tags: ['#codereview', '#culture', '#engineering', '#teamwork'],
  date: '2026-05-01',
  author: { name: 'Rais Helmy', role: 'Senior Engineer · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `The best code review I ever received was not about the code.

The reviewer pointed out that my abstraction solved the current requirement fine — but it would make the next three changes significantly harder. He was right.

That is what code review is supposed to be. Not a style checker. Not a comment thread about variable naming.

Done right, it is the highest-leverage quality and knowledge-sharing practice your team has. Done wrong, it is your biggest blocker and a source of unnecessary politics.

The difference usually comes down to how you approach the feedback, not the code itself.

#codereview #softwareengineering #teamwork #engineering`,

  slides: [
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Code Reviews.<br><span style="color:var(--red);">The culture</span><br><span style="color:#555;font-weight:300;">most teams get wrong.</span>',
      description: 'Code review is not a gatekeeping exercise. Done right, it\'s the highest-leverage quality and knowledge-sharing practice your team has.',
      tags: ['#codereview', '#culture', '#engineering', '#teamwork']
    },
    {
      type: 'evr',
      label: 'principle 1 · what to actually review',
      expect_items: [
        'Logic correctness, edge cases, error handling — things that affect runtime behaviour.',
        'Security concerns: SQL injection, missing auth checks, secrets in code, input validation.',
        'Architecture fit: does this follow our patterns? Will this be easy to maintain in 6 months?'
      ],
      reality_items: [
        'Nit-picking indentation and variable names that a linter would catch automatically.',
        'Long debates over style preferences — enforced by tooling, not by reviewers.',
        'Rubber-stamping approvals to avoid friction — "LGTM" on a 500-line PR reviewed in 30 seconds.'
      ],
      code: `<span class="cgr">// ✦ Review checklist (high-value items)</span>
<span class="cy">Logic concerns:
  □ Does this handle all edge cases?
  □ Error paths: what happens when this fails?
  □ Is the happy path correct?

Security:
  □ User input validated/sanitised?
  □ Auth check on every endpoint?
  □ No secrets/PII in logs?

Maintainability:
  □ Would a new team member understand this?
  □ Does this follow our patterns?
  □ Are tests covering the important paths?</span>
<span class="cgr">// Leave linting, formatting to CI</span>`
    },
    {
      type: 'evr',
      label: 'principle 2 · giving feedback well',
      expect_items: [
        'Label comment severity: [nit] for minor, [blocker] for must-fix, [question] for discussion.',
        'Suggest, don\'t demand: "Consider using X here — it handles the null case more explicitly."',
        'Praise good code. "Nice use of the pattern here" reinforces what to repeat.'
      ],
      reality_items: [
        '"This is wrong" — no explanation of why, no suggestion for what\'s right.',
        'Rewriting the entire approach in review comments instead of pairing to understand the author\'s intent.',
        'Piling on — 3 reviewers all commenting the same nit, making the author feel attacked.'
      ],
      code: `<span class="cgr">// ✗ Unhelpful review comment</span>
<span class="cr">This code is confusing. Rewrite it.</span>

<span class="cgr">// ✦ Helpful review comment</span>
<span class="cy">[question] I'm having trouble following the control
flow here — what's the intent when userId is null?

[suggestion] One option that might be clearer:
  if (!userId) return Result.notFound('User');
  const user = await findUser(userId);
→ Keeps the null guard explicit at the top.

What do you think?</span>

<span class="cgr">// Author feels respected. Clear path forward.</span>`
    },
    {
      type: 'nuance',
      label: 'principle 3 · review turnaround',
      quote_title: 'Waiting for review is the biggest flow killer on most teams.',
      quote_body: 'A PR reviewed in 4 hours keeps the author in context. A PR reviewed in 2 days means context switching, lost momentum, merge conflicts, and stale branches. Treat review requests like production alerts — not like emails you get to when convenient.',
      left_label: 'Slow review cost',
      left_body: '2-day wait × 3 PRs in flight = 6 days of blocked work per week · Author moves to new work, loses context when review arrives · WIP explodes, integration hell follows',
      right_label: 'Fast review culture',
      right_body: 'Team agrees: reviews within 4 business hours · Small PRs (<400 lines) take < 20 min to review · Reviewer blocks < 2 hours for review slots per day',
      insight: '→ The fastest way to increase team throughput is not to code faster — it\'s to unblock PRs faster. Review is a team sport.'
    },
    {
      type: 'framework',
      label: 'code review operating standards',
      cells: [
        { label: 'PR size', value: '< 400 lines', sub: 'Large PRs get rubber-stamped — break them up', red: false },
        { label: 'Review SLA', value: '< 4 hours', sub: 'Team agreement — a delayed review is a blocker', red: false },
        { label: 'Blockers vs nits', value: 'Label clearly', sub: '[blocker] / [nit] / [question] on every comment', red: false },
        { label: 'Author response', value: 'Same day', sub: 'Respond to all comments — even "noted, will fix in X"', red: false },
        { label: 'Style debates', value: 'Automate them', sub: 'ESLint / Prettier / .editorconfig — not reviewer time', red: false },
        { label: 'Approval without read', value: 'Never', sub: 'LGTM without reading is worse than no review', red: true }
      ]
    },
    {
      type: 'cta',
      label: 'found this useful?'
    }
  ]
};
