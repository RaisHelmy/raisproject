/* ── Vibe Coding Done Right ──────────────────────────────────── */
window.TIP_DATA = {
  id: 'vibe-coding-done-right',
  title: 'Vibe Coding: Ship Fast Without The Regrets',
  description: 'AI-assisted development is powerful — but momentum without judgment creates unmaintainable messes. Here\'s the balance.',
  category: 'Vibe Coding · 7 slides',
  tags: ['#vibecoding', '#ai', '#cursor', '#copilot'],
  date: '2026-04-26',
  author: { name: 'Rais Helmy', role: 'Senior Engineer · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Vibe coding got me a working prototype in 45 minutes.

It also got me into a codebase three months later where nothing was testable, dependencies were tangled, and nobody — including the AI — could explain why certain decisions were made.

AI-assisted development is a genuine force multiplier when you bring judgment to it. It is a liability when you do not.

The slides cover what I have learned about keeping the momentum without creating the kind of mess that takes longer to fix than it saved to build.

#vibecoding #ai #cursor #copilot`,

  slides: [
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Vibe Coding.<br><span style="color:var(--red);">Ship fast.</span><br><span style="color:#555;font-weight:300;">No regrets.</span>',
      description: 'Cursor, Copilot, and Claude can write 80% of your code. But the remaining 20% — the decisions, the boundaries, the judgment — that\'s still yours.',
      tags: ['#vibecoding', '#ai', '#cursor', '#copilot']
    },
    {
      type: 'evr',
      label: 'principle 1 · context is everything',
      expect_items: [
        'Maintain a cursor rules / .github/copilot-instructions.md with your stack, conventions, and patterns.',
        'Point the AI at multiple relevant files — not just the file you\'re editing.',
        'Give it a working example before asking it to generate similar code.'
      ],
      reality_items: [
        '"Generate a user auth flow" in an empty context — gets generic Express boilerplate.',
        'Accepting AI output file by file without showing how they connect.',
        'No persistent rules — repeating the same constraints every session.'
      ],
      code: `<span class="cgr">// ✦ .cursorrules / copilot-instructions.md</span>
<span class="cy">Stack: Next.js 14 App Router, Prisma, Tailwind
Auth: NextAuth v5, role-based (admin/user/guest)
Patterns:
  - Server actions for mutations (no API routes)
  - Zod schemas co-located with server actions
  - Error: return {success, data, error} — never throw
  - Tests: Vitest + Testing Library
  - No classes, arrow functions only
  - shadcn/ui for all UI components

Before writing code: check if a similar pattern
exists in /lib or /components — follow it.</span>`
    },
    {
      type: 'nuance',
      label: 'principle 2 · the acceptance threshold',
      quote_title: 'Don\'t just accept — understand and own.',
      quote_body: 'Vibe coding creates an invisible debt: code you ship but don\'t understand. When it breaks at 2am, you\'re the one debugging it. Before accepting AI output, be able to explain every line. If you can\'t, ask the AI to explain it first.',
      left_label: 'Green light to accept',
      left_body: 'You can read and explain every line · It follows your established patterns · You\'ve seen the test pass · Edge cases are handled',
      right_label: 'Ask for explanation first',
      right_body: 'Unfamiliar library APIs used · Complex async/concurrency logic · Security-relevant code (auth, payments) · DB schema changes',
      insight: '→ Mental model: treat AI like a pair programmer who types fast but needs your review before the code goes in.'
    },
    {
      type: 'evr-code',
      label: 'principle 3 · steer with tests',
      expect_items: [
        'Write the test first — it defines the expected behaviour before the AI generates the implementation.',
        'Use failing tests as AI prompts: "Make this test pass without changing the test."',
        'Tests give the AI a concrete success criterion — output quality jumps significantly.'
      ],
      reality_items: [
        'Generate code → it looks right → skip tests → discover edge cases in production.',
        'Asking for code AND tests together — AI writes tests that describe the code, not the requirement.',
        'No tests = no safety net when you ask AI to refactor next month.'
      ],
      code_good: `<span class="cgr">// ✦ Test-first vibe coding</span>
<span class="cgr">// 1. Write the test (your intent)</span>
it(<span class="cy">'rejects password under 8 chars'</span>, () =&gt; {
  expect(validatePassword(<span class="cy">'abc'</span>)).toEqual({
    valid: <span class="cr">false</span>, error: <span class="cy">'Min 8 characters'</span>
  });
});

<span class="cgr">// 2. Prompt: "Make this test pass.
//    Return {valid, error}. No throwing."</span>`,
      code_bad: `<span class="cgr">// ✗ Generate then test</span>
<span class="cgr">// Prompt: "Write validatePassword with tests"</span>

<span class="cgr">// ← AI writes code, then writes tests
//   that match the code it just wrote.
//   Tests pass. But do they test
//   your requirements or its assumptions?</span>`
    },
    {
      type: 'framework',
      label: 'vibe coding decision guide',
      cells: [
        { label: 'Boilerplate', value: 'Full auto', sub: 'CRUD, form handlers, API wrappers — trust it', red: false },
        { label: 'Business logic', value: 'Review carefully', sub: 'Read every line, run tests, own the output', red: false },
        { label: 'Auth / Payments', value: 'Human-primary', sub: 'Use AI for structure only, review every token', red: false },
        { label: 'DB migrations', value: 'Never auto-accept', sub: 'Schema changes are irreversible in production', red: true },
        { label: 'Tests', value: 'Write first', sub: 'Define intent before asking AI to implement', red: false },
        { label: 'Refactoring', value: 'Snapshot test first', sub: 'Capture current behaviour before AI rewrites', red: false }
      ]
    },
    {
      type: 'cta',
      label: 'found this useful?'
    }
  ]
};
