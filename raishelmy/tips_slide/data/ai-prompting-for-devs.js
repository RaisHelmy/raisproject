/* ── AI Prompting for Devs ───────────────────────────────────── */
window.TIP_DATA = {
  id: 'ai-prompting-for-devs',
  title: 'Prompting for Developers: Get 10x More From LLMs',
  description: 'Chain-of-thought, role prompting, few-shot examples, and structured output — developer-specific LLM techniques that actually work.',
  category: 'AI · 7 slides',
  tags: ['#ai', '#llm', '#prompting', '#chatgpt'],
  date: '2026-04-24',
  author: { name: 'Rais Helmy', role: 'Senior Engineer · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Six months ago I was using ChatGPT like a search engine.

Ask question. Get answer. Copy code. Move on.

Then I actually learned how to prompt — role context, chain-of-thought, few-shot examples, output constraints.

Same model. Completely different quality of results.

If you write code for a living, prompting is now a real skill. Not for hype reasons — it genuinely changes output quality in ways that matter to your actual work.

Dropped the techniques I use daily into slides for anyone wanting a practical starting point.

#llm #promptengineering #devtools #softwareengineering`,

  slides: [
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'LLM Prompting<br><span style="color:var(--red);">for Developers.</span><br><span style="color:#555;font-weight:300;">Get 10x more.</span>',
      description: 'Most developers use LLMs like a search engine. The ones shipping 10x faster treat them like a junior developer who needs proper context.',
      tags: ['#ai', '#llm', '#prompting', '#chatgpt']
    },
    {
      type: 'evr-code',
      label: 'technique 1 · context-first prompting',
      expect_items: [
        'Provide full context: tech stack, constraints, existing patterns, and desired output format.',
        'Specify what you do NOT want — "no classes, use only arrow functions, no lodash".',
        'Include an example of the style or pattern you expect.'
      ],
      reality_items: [
        '"Write me a login function" — vague prompt, generic output, rounds of correction.',
        'No mention of language version, framework version, or constraints.',
        'Asking for code without telling it how the rest of the codebase looks.'
      ],
      code_good: `<span class="cgr">// ✦ Context-rich prompt</span>
<span class="cy">You are a senior TypeScript developer.
Stack: Next.js 14, Prisma, PostgreSQL.
Style: arrow functions, no classes, zod validation.

Write a server action that:
- Accepts FormData
- Validates with zod schema (email + password)
- Calls prisma.user.create()
- Returns { success, error } — never throws</span>`,
      code_bad: `<span class="cgr">// ✗ Vague prompt</span>
<span class="cr">Write me a user registration function in TypeScript</span>

<span class="cgr">// Result: generic Express handler with bcrypt,
// no zod, classes, no error handling pattern,
// completely different from your actual codebase style</span>`
    },
    {
      type: 'evr',
      label: 'technique 2 · chain-of-thought + role prompting',
      expect_items: [
        '"Think step by step" or "reason before answering" dramatically improves accuracy on complex problems.',
        'Role prompting: "Act as a security engineer reviewing this code for OWASP Top 10 issues."',
        'Separate reasoning from action: "First explain the bug, then provide the fix."'
      ],
      reality_items: [
        'Accepting the first answer without asking for reasoning — misses edge cases.',
        'Single-turn prompts for multi-step architectural decisions.',
        '"Fix this" without specifying what correct looks like — gets you something different, not necessarily better.'
      ],
      code: `<span class="cgr">// ✦ Chain-of-thought for debugging</span>
<span class="cy">This function returns undefined sometimes.
Think step by step:
1. Identify all code paths that could return undefined
2. Explain which input causes this
3. Provide a fix with proper null handling
4. Add a unit test for the edge case

Code:
[paste code here]</span>

<span class="cgr">// ✦ Role prompting for security review</span>
<span class="cy">Act as a security engineer doing a code review.
Check for: SQL injection, XSS, IDOR, broken auth.
For each issue: severity + line number + fix.

[paste endpoint code]</span>`
    },
    {
      type: 'nuance',
      label: 'technique 3 · structured output',
      quote_title: 'Ask for the shape you need, not just the content.',
      quote_body: 'LLMs will match whatever format you demonstrate. If you need JSON, show the schema. If you need a PR description, show the template. If you need test cases, show the test structure. The model will follow your pattern.',
      left_label: 'Unstructured (bad)',
      left_body: '"List the edge cases for this function" → prose paragraph you have to manually parse into test cases',
      right_label: 'Structured (good)',
      right_body: '"List edge cases as JSON: [{input, expected, reason}]" → paste directly into parameterized tests',
      insight: '→ Pro tip: End prompts with "Output only the code/JSON/list — no explanation" to skip verbose preambles when you just need the artifact.'
    },
    {
      type: 'framework',
      label: 'prompting techniques by use case',
      cells: [
        { label: 'Debug a bug', value: 'Chain-of-thought', sub: '"Think step by step, identify all paths"', red: false },
        { label: 'Code review', value: 'Role prompting', sub: '"Act as a senior security engineer"', red: false },
        { label: 'Architecture', value: 'Few-shot examples', sub: 'Show 1–2 patterns you like, ask to extend', red: false },
        { label: 'Test writing', value: 'Structured output', sub: '"Return as [{input, expected, reason}]"', red: false },
        { label: 'Refactoring', value: 'Constraint prompt', sub: '"No classes, preserve behaviour, add types"', red: false },
        { label: 'Risky prompts', value: 'Add constraints', sub: '"Explain trade-offs before changing anything"', red: true }
      ]
    },
    {
      type: 'cta',
      label: 'found this useful?'
    }
  ]
};
