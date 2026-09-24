/* ── AI in Production ────────────────────────────────────────── */
window.TIP_DATA = {
  id: 'ai-in-production',
  title: 'AI in Production: What No One Tells You',
  description: 'Hallucinations, latency, cost explosion, RAG pitfalls, and the operational realities of shipping LLM features to real users.',
  category: 'AI · 7 slides',
  tags: ['#ai', '#llm', '#rag', '#production'],
  date: '2026-04-25',
  author: { name: 'Rais Helmy', role: 'Senior Engineer · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `The demo worked beautifully. GPT returned exactly what we needed. Everyone in the room was impressed.

Then we deployed it.

Latency averaged 4 seconds. Some calls timed out silently. Cost hit $400 in week one. And the hallucinations — for a system where accuracy mattered, we had shipped a liability.

Every team I talk to goes through this exact arc.

LLM features are genuinely useful when done right. The "done right" part is what nobody documents.

These slides are what I wish someone had told us before we pushed to production.

#llm #aiengineering #softwaredevelopment #production`,

  slides: [
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'AI in Production.<br><span style="color:var(--red);">The hard parts</span><br><span style="color:#555;font-weight:300;">no one mentions.</span>',
      description: 'The demo worked. Production is a different story. Hallucinations, 4-second latencies, $400 API bills, and RAG that retrieves the wrong context.',
      tags: ['#ai', '#llm', '#rag', '#production']
    },
    {
      type: 'evr',
      label: 'reality 1 · hallucinations & guardrails',
      expect_items: [
        'Validate LLM output structurally — parse JSON, check required fields, reject malformed responses.',
        'Use deterministic tools for facts: dates, prices, DB lookups. LLM adds intelligence, not data.',
        'Add output filters: profanity, PII leakage, off-topic detection.'
      ],
      reality_items: [
        'Trusting the model\'s answer as ground truth — users get wrong data served confidently.',
        'No retry/fallback on malformed JSON output — app crashes with parse errors.',
        'Sending customer PII straight into OpenAI without reviewing data handling agreements.'
      ],
      code: `<span class="cgr">// ✦ Validate + fallback LLM output</span>
<span class="cr">async</span> <span class="cb">function</span> classifyIntent(text) {
  <span class="cr">const</span> raw = <span class="cr">await</span> llm.complete({
    prompt: <span class="cy">\`Classify as JSON: {intent, confidence}\n"\${text}"\`</span>
  });

  <span class="cr">let</span> parsed;
  <span class="cr">try</span> { parsed = JSON.parse(raw); }
  <span class="cr">catch</span> { <span class="cr">return</span> { intent: <span class="cy">'unknown'</span>, confidence: 0 }; }

  <span class="cr">if</span> (!VALID_INTENTS.includes(parsed.intent)) {
    <span class="cr">return</span> { intent: <span class="cy">'unknown'</span>, confidence: 0 };
  }
  <span class="cr">return</span> parsed;
}`
    },
    {
      type: 'nuance',
      label: 'reality 2 · latency & cost control',
      quote_title: 'LLM latency and cost scale faster than you expect.',
      quote_body: 'A single GPT-4 call at 2,000 input tokens + 500 output tokens costs ~$0.07. At 100k calls/day that\'s $7,000/day. Response time averages 3–5 seconds. Stream responses and cache aggressively.',
      left_label: 'Cost killers',
      left_body: 'Sending entire conversation history · No input token limits · Using GPT-4 for tasks GPT-3.5 handles · Re-computing identical prompts',
      right_label: 'Cost fixes',
      right_body: 'Semantic caching (exact + near-duplicate) · Summarise history > 4k tokens · Route simple tasks to smaller models · Stream responses for UX',
      insight: '→ Add cost tracking from day one: log (model, input_tokens, output_tokens, user_id) per call — or your AI feature will kill your margins silently.'
    },
    {
      type: 'evr',
      label: 'reality 3 · rag pitfalls',
      expect_items: [
        'Chunk documents semantically (by section/paragraph), not by fixed token count.',
        'Embed the question AND retrieved chunks together in the final prompt for coherence.',
        'Evaluate retrieval quality separately from generation quality.'
      ],
      reality_items: [
        'Splitting PDFs every 500 chars — cuts sentences mid-thought, retrieves incoherent fragments.',
        'Retrieving top-5 chunks but injecting all 5 even when 3 are irrelevant — adds noise.',
        '"RAG is set up, AI is done" — retrieval degrades as source documents grow and no one monitors it.'
      ],
      code: `<span class="cgr">// ✦ Score and filter retrieved chunks</span>
<span class="cr">const</span> chunks = <span class="cr">await</span> vectorStore.query({
  embedding: <span class="cr">await</span> embed(userQuery),
  topK: 8
});

<span class="cgr">// Filter low-relevance chunks</span>
<span class="cr">const</span> relevant = chunks.filter(c =&gt; c.score &gt; <span class="cy">0.78</span>).slice(0, 4);

<span class="cr">if</span> (relevant.length === 0) {
  <span class="cr">return</span> <span class="cy">"I don't have enough context to answer that."</span>;
}

<span class="cr">const</span> context = relevant.map(c =&gt; c.text).join(<span class="cy">'\n---\n'</span>);
<span class="cr">return</span> <span class="cr">await</span> llm.complete(buildPrompt(userQuery, context));`
    },
    {
      type: 'framework',
      label: 'ai feature production checklist',
      cells: [
        { label: 'Output validation', value: 'Parse + schema check', sub: 'Reject malformed responses, fallback gracefully', red: false },
        { label: 'Cost tracking', value: 'Log every call', sub: 'model + tokens + user — alert on anomalies', red: false },
        { label: 'Latency', value: 'Stream + cache', sub: 'Stream for UX, semantic cache for cost', red: false },
        { label: 'PII / Safety', value: 'Filter before & after', sub: 'Strip PII in, block harmful content out', red: false },
        { label: 'Eval pipeline', value: 'LLM-as-judge', sub: 'Automated quality scoring on sample outputs', red: false },
        { label: 'No skip these', value: 'Rate limits', sub: 'Per-user quotas — one runaway prompt destroys budget', red: true }
      ]
    },
    {
      type: 'cta',
      label: 'found this useful?'
    }
  ]
};
