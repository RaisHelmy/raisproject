/* ── Source Generators: Power & Pitfalls ────────────────────────── */
window.TIP_DATA = {
  id: 'source-generators',
  title: 'Source Generators: Power & Pitfalls',
  description: 'Source generators for JSON, regex, DI, logging — and when rolling your own costs more than it saves.',
  category: 'C# · 7 slides',
  tags: ['#sourcegenerators', '#csharp', '#dotnet', '#roslyn'],
  date: '2026-04-20',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Source generators feel like magic the first time you see them work.

Serialisers, DI registration, logger extensions, regex compilation — all generated at compile time. No runtime reflection. No overhead.

The catch is they are also easy to get wrong. Incremental generators have specific performance requirements. Debugging them is non-trivial. And building your own for something the BCL already generates is rarely worth it.

Slides on the power, the gotchas, and where the tooling actually makes sense to reach for.

#sourcegenerators #csharp #dotnet #roslyn`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Source Generators.<br><span style="color:var(--red);">Build time 4 minutes.</span><br><span style="color:#555;font-weight:300;">For 47 generated files.</span>',
      description: 'Custom source generator written to avoid 20 lines of boilerplate. Now generates 47 files, build time quadrupled, debugging is nearly impossible, and the original developer left. Know when not to write one.',
      tags: ['#sourcegenerators', '#csharp', '#dotnet', '#roslyn']
    },

    /* 02 Built-in Generators */
    {
      type: 'evr-code',
      label: 'topic 1 · built-in source generators',
      expect_items: [
        'System.Text.Json: [JsonSerializable] generates AOT-compatible serializers — no reflection at runtime.',
        'Regex.GeneratedRegex: compile-time regex compilation — faster, no runtime regex compilation overhead.',
        'LoggerMessage.Define: source-generated logging — avoids boxing, zero allocation on hot paths.'
      ],
      reality_items: [
        'JsonSerializer.Serialize without context — uses reflection, slow startup, fails in AOT/NativeAOT.',
        'new Regex(pattern) in hot path — compiled every call, allocates, no caching.',
        '_logger.LogInformation($"Order {id} created") — string interpolation allocates even when log level disabled.'
      ],
      code_good: `<span class="cgr">// ✦ AOT-compatible JSON serialization</span>
[JsonSerializable(<span class="cr">typeof</span>(Order))]
[JsonSerializable(<span class="cr">typeof</span>(List&lt;Order&gt;))]
<span class="cr">internal partial class</span> <span class="cy">AppJsonContext</span> : JsonSerializerContext { }

<span class="cr">var</span> json = JsonSerializer.Serialize(order, AppJsonContext.Default.Order);

<span class="cgr">// ✦ Compile-time regex — GeneratedRegex attribute</span>
<span class="cr">public partial class</span> <span class="cy">OrderParser</span>
{
    [GeneratedRegex(<span class="cg">@"^ORD-\d{6}$"</span>)]
    <span class="cr">private static partial</span> Regex OrderIdRegex();

    <span class="cr">public bool</span> IsValid(<span class="cb">string</span> id) => OrderIdRegex().IsMatch(id);
}`,
      code_bad: `<span class="cgr">// ✗ Reflection-based serialization in AOT</span>
<span class="cr">var</span> json = JsonSerializer.Serialize(order);  <span class="cgr">// reflection — AOT fails</span>

<span class="cgr">// ✗ Regex in hot path</span>
<span class="cr">if</span> (<span class="cr">new</span> Regex(<span class="cg">@"^ORD-\d{6}$"</span>).IsMatch(id)) <span class="cgr">// compiled every call</span>

<span class="cgr">// ✗ String interpolation in log</span>
_logger.LogInformation(<span class="cg">$"Order {id} at {DateTime.Now}"</span>);
<span class="cgr">// allocates string even if log level is Warning`
    },

    /* 03 Custom Generators */
    {
      type: 'evr',
      label: 'topic 2 · when to write a custom generator',
      expect_items: [
        'Good use: generating repetitive strongly-typed mapping code that a human would write anyway.',
        'Good use: compile-time validation of attributes — catch misconfiguration at build time.',
        'Rule: if the generated code can be written by hand in < 200 lines, do not write a generator.'
      ],
      reality_items: [
        'Custom generator to avoid writing 20 lines of boilerplate — generator is 400 lines of Roslyn API.',
        'Generator produces untested code — bugs in generated code are hidden and hard to trace.',
        'Generator runs IIncrementalGenerator incorrectly — slows IDE IntelliSense for entire team.'
      ],
      code: `<span class="cgr">// ✦ Minimal IIncrementalGenerator skeleton</span>
[Generator]
<span class="cr">public class</span> <span class="cy">MyGenerator</span> : IIncrementalGenerator
{
    <span class="cr">public void</span> Initialize(IncrementalGeneratorInitializationContext ctx)
    {
        <span class="cr">var</span> provider = ctx.SyntaxProvider
            .CreateSyntaxProvider(
                predicate: <span class="cr">static</span> (node, _) => node <span class="cr">is</span> ClassDeclarationSyntax,
                transform: <span class="cr">static</span> (ctx, _) => GetTarget(ctx))
            .Where(m => m <span class="cr">is not null</span>)!;

        ctx.RegisterSourceOutput(provider,
            <span class="cr">static</span> (spc, source) => spc.AddSource(
                <span class="cg">$"{source}.g.cs"</span>, Generate(source)));
    }
}`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · source generator matrix',
      cells: [
        { label: 'JSON Serialization', value: 'JsonSerializerContext',       sub: 'AOT-safe, zero reflection, NativeAOT-compatible' },
        { label: 'Regex',             value: 'GeneratedRegex attribute',     sub: 'Compile-time compiled, faster hot path regex' },
        { label: 'Logging',           value: 'LoggerMessage source gen',     sub: 'Zero allocation, zero boxing on disabled levels' },
        { label: 'DI Registration',   value: 'Microsoft.Extensions.DI gen', sub: '.NET 8 — source-generated DI for AOT' },
        { label: 'Custom Generator',  value: 'IIncrementalGenerator',        sub: 'Only if benefit clearly exceeds Roslyn complexity' },
        { label: 'Do Not Use', red: true, value: 'To avoid 50 lines of code', sub: 'Generator complexity > benefit at small scale' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · generation has a cost',
      quote_title: 'Source generators move bugs<br>from runtime to <span style="color:var(--red);">invisible build-time.</span>',
      quote_body: 'A bug in generated code is not in your codebase — it is in the generator. It does not show in code coverage. It requires a Roslyn debugging setup to diagnose. The cost of maintaining a custom generator is significant. Use built-in generators freely, write custom ones rarely.',
      left_label: 'NativeAOT and Blazor WASM',
      left_body: 'Source generators are not optional for NativeAOT targets or Blazor WASM — reflection-based serialization and DI does not work. In these targets, source generators are mandatory.',
      right_label: 'Test your generator',
      right_body: 'Use Microsoft.CodeAnalysis.CSharp.SourceGenerators.Testing NuGet package to unit test generators. A generator with no tests is a black box that breaks silently on Roslyn version updates.',
      insight: 'Check what source generators are already running in your build: examine the <strong style="color:#fff;">obj/ folder for *.g.cs files</strong>. You might already have 50 generated files from packages you use daily without realising it.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
