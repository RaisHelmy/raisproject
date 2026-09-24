/* ── Agile Myths ─────────────────────────────────────────────── */
window.TIP_DATA = {
  id: 'agile-myths',
  title: 'Agile Myths That Are Killing Your Team',
  description: 'Daily standups, sprint velocity, story points, and the Agile rituals that became bureaucracy in disguise.',
  category: 'Project Management · 7 slides',
  tags: ['#agile', '#scrum', '#projectmanagement', '#leadership'],
  date: '2026-04-27',
  author: { name: 'Rais Helmy', role: 'Senior Engineer · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Honest question.

How much of your "Agile" is just meetings with a timer?

The standups became status reports. Sprint reviews became presentations. Retrospectives became a list of complaints nobody acted on.

We stopped doing Agile. We started doing the appearance of Agile.

The difference is bigger than most teams admit.

I put together the myths I keep seeing — not because Agile is fundamentally broken, but because the way most teams practice it has drifted so far from the original intent.

Slide 3 specifically. That one changed how I run teams.

#agile #scrum #softwareengineering #projectmanagement`,

  slides: [
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Agile Myths.<br><span style="color:var(--red);">Killing your team.</span><br><span style="color:#555;font-weight:300;">The real story.</span>',
      description: 'Agile promised software delivery built on trust, feedback, and adaptability. What most teams practice is scheduling overhead disguised as methodology.',
      tags: ['#agile', '#scrum', '#projectmanagement', '#leadership']
    },
    {
      type: 'evr',
      label: 'myth 1 · daily standup',
      expect_items: [
        'Standup is for the team to coordinate blockers — not a status report to the manager.',
        'If you have no blockers, a standup in async Slack is faster and equally effective.',
        'A 15-minute standup with 8 people costs 2 hours of collective focus time per day.'
      ],
      reality_items: [
        '"What did you do yesterday?" — a status meeting with a timer, not a collaboration ritual.',
        'Engineers context-switching from deep work at 9am because the standup is a fixed ceremony.',
        'The person who needed a blocker resolved yesterday waits until 9am standup to surface it.'
      ],
      code: `<span class="cgr">// ✦ Async-first standup format</span>
<span class="cy">Post in #standup channel when you start work:

✅ Done: [PR link] - Order refund endpoint
🔨 Today: Cart session expiry logic
🚧 Blocked: Need DB access to staging
             → @DevOps can you help?

Thread for discussion. Video only if stuck.
Decision in meeting → post outcome async.</span>

<span class="cgr">// Saves: 6 people × 15min = 1.5hrs/day
// Enables: async, timezone-friendly, searchable
// Preserves: accountability + visibility</span>`
    },
    {
      type: 'nuance',
      label: 'myth 2 · velocity is a metric',
      quote_title: 'Velocity measures output. It doesn\'t measure value.',
      quote_body: 'A team that ships 40 story points of the wrong features is wasting effort at high speed. Velocity is a planning tool for the team — the moment management uses it to compare teams or judge performance, it gets gamed and loses all meaning.',
      left_label: 'Velocity is useful for',
      left_body: 'Forecasting when a backlog will be done · The team\'s own capacity planning · Spotting significant throughput changes over time',
      right_label: 'Velocity is NOT for',
      right_body: 'Comparing teams ("Team A does 60 points, why does Team B do 40?") · Performance reviews · Committing to fixed delivery dates',
      insight: '→ If your story points inflated by 30% after management started tracking velocity — you\'re measuring estimation, not delivery.'
    },
    {
      type: 'evr',
      label: 'myth 3 · sprints = deadlines',
      expect_items: [
        'Sprints create a feedback loop — demo at the end, inspect what was built, adapt the plan.',
        'Unfinished work rolls to the next sprint — a sprint is a time-box, not a commitment contract.',
        'The sprint goal (the why) matters more than completing the sprint task list (the what).'
      ],
      reality_items: [
        '"It must be done by Friday — that\'s the sprint end." Quality shortcuts follow.',
        'Teams doing mini-waterfall: full sprint planning day one, nothing demoed, sprint ended.',
        'No retrospective, no adaptation — sprint is just a two-week chunk with the same problems repeating.'
      ],
      code: `<span class="cgr">// ✦ Sprint goal > sprint task list</span>
<span class="cy">Sprint Goal: Customers can checkout without errors

That means:
- Payment API integration → must-have
- Order confirmation email → must-have
- Invoice PDF → nice-to-have (can slip)
- Analytics tracking → nice-to-have (can slip)

At sprint end: if goal is met, sprint succeeded.
Missing nice-to-haves is not a failure.</span>

<span class="cgr">// ✗ Task-list sprint</span>
<span class="cr">Sprint: Complete all 23 tickets by Friday.</span>
<span class="cgr">// → "Done" tickets written at 11:59pm
// → Tests skipped, bugs shipped, morale lost</span>`
    },
    {
      type: 'framework',
      label: 'agile ritual health check',
      cells: [
        { label: 'Daily standup', value: 'Async-first', sub: 'Meeting only when genuinely blocked', red: false },
        { label: 'Sprint planning', value: '< 2 hrs', sub: 'Long planning = unclear backlog, fix the backlog', red: false },
        { label: 'Sprint review', value: 'Real users', sub: 'Demo to stakeholders/customers — not just PM', red: false },
        { label: 'Retrospective', value: 'Actioned', sub: 'Every retro → at least one thing actually changes', red: false },
        { label: 'Velocity tracking', value: 'Team-only', sub: 'Never reported to management as a KPI', red: true },
        { label: 'Story points', value: 'T-shirt sizes', sub: 'If estimates take > 1 min, they\'re too precise', red: false }
      ]
    },
    {
      type: 'cta',
      label: 'found this useful?'
    }
  ]
};
