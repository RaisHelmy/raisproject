/* ── Profiling & Benchmarking .NET Apps ─────────────────────────── */
window.TIP_DATA = {
  id: 'performance-profiling',
  title: 'Profiling & Benchmarking .NET Apps',
  description: 'BenchmarkDotNet, dotnet-trace, dotnet-counters, memory profiling — measure before you optimize.',
  category: '.NET · 7 slides',
  tags: ['#performance', '#profiling', '#dotnet', '#benchmarking'],
  date: '2026-04-13',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Spent a week optimising string operations.

Switched to Span<T>, reduced allocations, wrote BenchmarkDotNet baselines. The numbers looked great.

The endpoint was still slow.

There was a synchronous database call blocking a thread pool thread for 200ms on every request. It had been there the whole time. We just never profiled it.

Optimise without measuring first and you are guessing. These slides are about finding the actual bottleneck — not the one that looks obvious before you look at the data.

#dotnet #performance #profiling #benchmarking`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: '.NET Performance.<br><span style="color:var(--red);">Optimizing.</span><br><span style="color:#555;font-weight:300;">The wrong thing. By feel.</span>',
      description: 'String concatenation replaced with StringBuilder. No benchmark. Still 2x slower. Because the actual bottleneck was a synchronous DB call nobody measured. Measure first, always.',
      tags: ['#performance', '#profiling', '#dotnet', '#benchmarking']
    },

    /* 02 BenchmarkDotNet */
    {
      type: 'evr-code',
      label: 'topic 1 · benchmarkdotnet',
      expect_items: [
        'BenchmarkDotNet: the standard for .NET micro-benchmarks — measures mean, stddev, allocations.',
        '[MemoryDiagnoser] attribute reports Gen0/Gen1/Gen2 GC collections and allocated bytes.',
        'Run benchmarks in Release mode — Debug benchmarks are meaningless noise.'
      ],
      reality_items: [
        'Stopwatch in Debug mode — JIT is not optimized, GC behaviour is different, results lie.',
        '"I can tell by looking at the code which is faster" — consistently wrong on modern JIT.',
        'Micro-optimizing string formatting while a LINQ query allocates 40MB on each request.'
      ],
      code_good: `<span class="cgr">// ✦ BenchmarkDotNet — run with: dotnet run -c Release</span>
[MemoryDiagnoser]
<span class="cr">public class</span> <span class="cy">JsonBenchmarks</span>
{
    <span class="cr">private readonly</span> Order _order = Order.Sample();

    [Benchmark(Baseline = <span class="cr">true</span>)]
    <span class="cr">public string</span> SystemTextJson()
        => JsonSerializer.Serialize(_order);

    [Benchmark]
    <span class="cr">public string</span> NewtonsoftJson()
        => JsonConvert.SerializeObject(_order);
}
<span class="cgr">// Output: Method | Mean | Alloc
// STJ    | 1.2μs | 240B   ← winner
// NSJ    | 3.8μs | 1.1KB</span>`,
      code_bad: `<span class="cgr">// ✗ Stopwatch "benchmark" in Debug</span>
<span class="cr">var</span> sw = Stopwatch.StartNew();
<span class="cr">for</span> (<span class="cr">var</span> i = <span class="cb">0</span>; i &lt; <span class="cb">1000</span>; i++)
    JsonSerializer.Serialize(_order);
sw.Stop();
Console.WriteLine(sw.ElapsedMilliseconds);
<span class="cgr">// Problem: JIT warming, GC timing, Debug mode
// no allocation info, no statistical validity`
    },

    /* 03 dotnet Diagnostics */
    {
      type: 'evr',
      label: 'topic 2 · dotnet diagnostic tools',
      expect_items: [
        'dotnet-counters: live CPU, memory, GC, threadpool, exceptions — real production telemetry.',
        'dotnet-trace: capture ETW/EventPipe trace for flamegraph analysis with SpeedScope.',
        'dotnet-dump: collect heap dump without stopping process — analyze memory leaks offline.'
      ],
      reality_items: [
        'Adding Console.WriteLine timers in production code — noisy, inaccurate, security risk.',
        'No baseline metrics — performance regressions take weeks to notice.',
        'Collecting GC metrics manually while dotnet-counters shows everything in one command.'
      ],
      code: `<span class="cgr">// Install tools once</span>
dotnet tool install -g dotnet-counters
dotnet tool install -g dotnet-trace

<span class="cgr">// ✦ Live counters — attach to running process</span>
dotnet-counters monitor -p &lt;PID&gt; \\
    --counters System.Runtime,Microsoft.AspNetCore.Hosting

<span class="cgr">// ✦ Capture CPU trace (30s) → SpeedScope flamegraph</span>
dotnet-trace collect -p &lt;PID&gt; --duration 00:00:30 \\
    --profile cpu-sampling -o trace.nettrace

<span class="cgr">// ✦ Heap dump — no process restart needed</span>
dotnet-dump collect -p &lt;PID&gt; -o heap.dmp
dotnet-dump analyze heap.dmp`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · profiling tool matrix',
      cells: [
        { label: 'BenchmarkDotNet', value: 'Micro-benchmarks, CI regression', sub: 'Use [MemoryDiagnoser], Release mode only' },
        { label: 'dotnet-counters', value: 'Live production telemetry',        sub: 'CPU, memory, GC, exceptions per second' },
        { label: 'dotnet-trace',    value: 'CPU flamegraph + call stacks',     sub: 'SpeedScope / PerfView visualization' },
        { label: 'dotnet-dump',     value: 'Heap analysis offline',            sub: 'Find memory leaks without stopping process' },
        { label: 'Visual Studio',   value: 'CPU + Memory profiler built-in',   sub: 'Diagnostic Tools window — great for dev' },
        { label: 'Rule #1', red: true, value: 'Measure before optimizing',    sub: 'Optimize the real bottleneck, not your guess' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · optimize the right thing',
      quote_title: 'Premature optimization is the root of evil.<br><span style="color:var(--red);">So is optimizing without measuring.</span>',
      quote_body: 'Most .NET performance problems are not algorithmic — they are a missing index, an N+1 query, a synchronous call on an async path, or allocating too many strings. These show up in traces. They do not show up in code review.',
      left_label: 'Span<T> and Memory<T>',
      left_body: 'For hot paths — string parsing, binary processing — Span<T> avoids heap allocations entirely. Profile first to confirm allocation is the actual bottleneck.',
      right_label: 'ArrayPool and ObjectPool',
      right_body: 'For frequently allocated arrays and objects, pool them. ArrayPool<byte>.Shared is zero-effort. Combine with MemoryDiagnoser to confirm allocation reduction.',
      insight: 'The <strong style="color:#fff;">single most common .NET performance fix</strong> is adding AsNoTracking() to EF Core queries that do not need change tracking. It costs nothing to add — profile your app today.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
