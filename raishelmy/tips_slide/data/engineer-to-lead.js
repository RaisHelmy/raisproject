/* ── Engineer to Tech Lead ───────────────────────────────────── */
window.TIP_DATA = {
  id: 'engineer-to-lead',
  title: 'Engineer to Tech Lead: What Nobody Tells You',
  description: 'The mindset shift, influence without authority, saying no clearly, 1-on-1s that matter, and avoiding the common traps.',
  category: 'Business · 7 slides',
  tags: ['#leadership', '#techlead', '#career', '#softskills'],
  date: '2026-04-30',
  author: { name: 'Rais Helmy', role: 'Senior Engineer · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `The hardest part of becoming a tech lead was not the technical stuff.

It was realising that being right no longer mattered as much as making everyone around me more effective.

I used to win arguments on merit. As a lead, winning an argument while demoralising the team in the process is a net loss. That shift took me longer to internalise than any technical skill I have learned.

If you are about to step into a lead role, or already in one and finding it uncomfortable — these slides are what I would tell my earlier self.

#techlead #leadership #softwareengineering #careergrowth`,

  slides: [
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Engineer to<br><span style="color:var(--red);">Tech Lead.</span><br><span style="color:#555;font-weight:300;">The real shift.</span>',
      description: 'You were promoted because you wrote great code. Now your job is to make others write great code. Everything you relied on has changed.',
      tags: ['#leadership', '#techlead', '#career', '#softskills']
    },
    {
      type: 'nuance',
      label: 'shift 1 · your success metric changed',
      quote_title: 'Your output is now the team\'s output — not your code.',
      quote_body: 'As an engineer, you measured yourself by code shipped. As a tech lead, you measure yourself by how much the team ships, with what quality, and how confidently. The hardest part: you\'ll often need to not code the thing — even when you could do it faster.',
      left_label: 'Engineer success looks like',
      left_body: 'Closed 12 tickets this sprint · Wrote the fastest implementation · Solved the hardest bug alone',
      right_label: 'Tech lead success looks like',
      right_body: 'Team closed 40 tickets · Junior wrote code they\'re proud of · Team unblocked themselves · PR review within 4 hours',
      insight: '→ Practical test: if you were absent for a week, does the team slow down because of missing decisions (good) or missing code (you\'re still an IC, not a lead)?'
    },
    {
      type: 'evr',
      label: 'shift 2 · influence without authority',
      expect_items: [
        'Build technical credibility through review quality, not through being the fastest coder.',
        'Ask questions that lead teams to better conclusions rather than dictating solutions.',
        'Document and communicate architectural decisions — others can only follow what\'s written.'
      ],
      reality_items: [
        '"Just do it my way" — creates compliance, not ownership. Engineers disengage.',
        'Only being heard in meetings because of seniority, not because of reasoning quality.',
        'Architectural decisions in the lead\'s head — tribal knowledge, no onboarding, no decisions revisited.'
      ],
      code: `<span class="cgr">// ✦ Decision documentation (ADR format)</span>
<span class="cy">docs/decisions/0004-authentication-strategy.md

Status: Accepted
Date: 2026-04-15
Context: Need auth for new customer portal.
         3 options evaluated.

Decision: Use NextAuth v5 with Prisma adapter.
Reason: 
  - Team already knows Next.js
  - Built-in session management
  - Easy role extension via Prisma

Alternatives considered:
  - Auth0: cost at scale, vendor lock
  - Custom JWT: maintenance burden
  
Revisit if: user count exceeds 50k or SLA > 99.95%</span>`
    },
    {
      type: 'evr',
      label: 'shift 3 · saying no properly',
      expect_items: [
        '"No" to a feature should come with: the trade-off being made and an alternative.',
        'Saying no to scope protects delivery commitments — it\'s a leadership act, not obstruction.',
        'Frame no as a prioritisation: "Yes, but after X" or "Yes, if we drop Y."'
      ],
      reality_items: [
        '"We can\'t do that" with no explanation — builds resentment, breaks trust with product.',
        'Saying yes to everything because of discomfort with conflict — then missing deadlines.',
        'Tech leads who never say no becoming blockers because they\'re overloaded with side requests.'
      ],
      code: `<span class="cgr">// ✦ Saying no with context</span>
<span class="cy">Request: "Can we add analytics tracking this sprint?"

No, because:
  We committed to payment flow + checkout fixes.
  Adding analytics this sprint risks both.

Options:
  A) Analytics in Sprint N+1 (recommended)
  B) Move one checkout fix to N+1 and add analytics now
  C) Analytics as background task if payment finishes early

What's the priority call from your side?</span>
<span class="cgr">// → No to request + context + options = respect</span>`
    },
    {
      type: 'framework',
      label: 'tech lead operating model',
      cells: [
        { label: 'Code review', value: 'Daily, < 4hrs', sub: 'Blocking PRs kill momentum — prioritise reviews', red: false },
        { label: '1-on-1s', value: 'Weekly, theirs', sub: 'Their agenda — not a status report session', red: false },
        { label: 'Architecture', value: 'Document ADRs', sub: 'Every significant decision gets a written record', red: false },
        { label: 'Coding', value: '< 30% of time', sub: 'More coding = less unblocking = team slows down', red: false },
        { label: 'Conflict', value: 'Engage early', sub: 'Small friction addressed now = no blow-ups later', red: false },
        { label: 'Burnout signal', value: 'You attend everything', sub: 'Delegate meetings — you can\'t be everywhere', red: true }
      ]
    },
    {
      type: 'cta',
      label: 'found this useful?'
    }
  ]
};
