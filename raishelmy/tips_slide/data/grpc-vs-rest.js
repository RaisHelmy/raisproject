/* ── gRPC vs REST: The Real Tradeoffs ───────────────────────────── */
window.TIP_DATA = {
  id: 'grpc-vs-rest',
  title: 'gRPC vs REST: The Real Tradeoffs',
  description: 'Protobuf contracts, streaming, browser compatibility, Protobuf vs JSON — the honest tradeoff analysis.',
  category: 'Architecture · 7 slides',
  tags: ['#grpc', '#rest', '#api', '#architecture'],
  date: '2026-04-17',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Team rewrote all internal service communication to gRPC.

Performance numbers improved. Engineers were happy. We shipped it.

Three weeks later the mobile team needed to call the same services. Then the web frontend too. gRPC-Web works but adds complexity. REST would have been fine for half of these services from the start.

gRPC is excellent for the right use case. The mistake is adopting it as a blanket default without thinking through who the actual consumers are.

Honest tradeoff breakdown in the slides.

#grpc #rest #microservices #softwarearchitecture`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'gRPC vs REST.<br><span style="color:var(--red);">Microservices in gRPC.</span><br><span style="color:#555;font-weight:300;">Mobile clients cannot connect.</span>',
      description: 'Team rewrites all microservice communication to gRPC for performance. Then discovers mobile and web browser clients cannot call gRPC directly. Half the system needs a REST facade. Architecture decision not thought through.',
      tags: ['#grpc', '#rest', '#api', '#architecture']
    },

    /* 02 gRPC Setup */
    {
      type: 'evr-code',
      label: 'topic 1 · grpc in aspnetcore',
      expect_items: [
        'gRPC: Protobuf contracts, HTTP/2, bidirectional streaming — perfect for internal microservice communication.',
        'Strongly typed: .proto defines the contract, code is generated — no runtime serialization errors.',
        'gRPC-Web or gRPC-Gateway for browser clients — gRPC-HTTP/2 is not natively supported in browsers.'
      ],
      reality_items: [
        'Using gRPC for all APIs including public-facing — browser clients cannot call it without grpc-web proxy.',
        'Protobuf schema changes without backward compatibility — field removal breaks old clients silently.',
        '"gRPC is always faster" — for small payloads on the same machine, the difference is negligible.'
      ],
      code_good: `<span class="cgr">// ✦ .proto contract definition</span>
<span class="cgr">// orders.proto</span>
service OrderService {
    rpc GetOrder (GetOrderRequest) returns (OrderResponse);
    rpc StreamOrders (StreamRequest) returns (stream OrderResponse);
}
message GetOrderRequest { int32 id = 1; }
message OrderResponse {
    int32 id = 1; string customer_id = 2;
    double total = 3;
    <span class="cgr">// ✦ field 4 reserved for future — backward compat</span>
    reserved 4; reserved <span class="cg">"deprecated_field"</span>;
}`,
      code_bad: `<span class="cgr">// ✗ Protobuf without backward compat strategy</span>
message OrderResponse {
    int32 id = 1;
    string customer_id = 2;
    <span class="cgr">// Removed: double price = 3;  ← old clients break</span>
    <span class="cgr">// Not reserved — field number reused:</span>
    string status = 3;   <span class="cgr">// ← silent data corruption for old clients</span>
}`
    },

    /* 03 When to Use Each */
    {
      type: 'evr',
      label: 'topic 2 · grpc vs rest decision',
      expect_items: [
        'gRPC: internal service-to-service, real-time streaming, low latency internal network.',
        'REST: public APIs, browser/mobile clients, third-party integrations, human-readable.',
        'Hybrid: gRPC internally between services, REST gateway for external clients (gRPC-Gateway).'
      ],
      reality_items: [
        'All-in on gRPC including public API — external clients cannot consume it without proxy.',
        'All REST for microservices — misses streaming and the typed contract guarantees of Protobuf.',
        'Debating gRPC vs REST for six weeks instead of building — both can work, pick based on consumers.'
      ],
      code: `<span class="cgr">// ✦ ASP.NET Core gRPC service setup</span>
builder.Services.AddGrpc(o => {
    o.EnableDetailedErrors = app.Environment.IsDevelopment();
});

app.MapGrpcService&lt;<span class="cy">OrderGrpcService</span>&gt;();

<span class="cgr">// ✦ gRPC-Web for browser support</span>
builder.Services.AddGrpcWeb();
app.UseGrpcWeb();
app.MapGrpcService&lt;<span class="cy">OrderGrpcService</span>&gt;().EnableGrpcWeb();

<span class="cgr">// ✦ Typed client in another service</span>
builder.Services.AddGrpcClient&lt;<span class="cy">OrderService.OrderServiceClient</span>&gt;(o =>
    o.Address = <span class="cr">new</span> Uri(<span class="cg">"https://order-svc:5001"</span>));`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · grpc vs rest matrix',
      cells: [
        { label: 'Use gRPC',         value: 'Internal svc-to-svc',            sub: 'Low latency, typed contract, streaming needed' },
        { label: 'Use REST',         value: 'Public APIs, browser, mobile',   sub: 'Human readable, cacheable, universal support' },
        { label: 'Streaming',        value: 'gRPC server/bidirectional',      sub: 'SignalR for browser, gRPC for internal streams' },
        { label: 'Protobuf',         value: '3–10× smaller than JSON',        sub: 'Binary — not human-readable in flight' },
        { label: 'Contract',         value: '.proto = source of truth',        sub: 'Both sides generated from same .proto file' },
        { label: 'Browser', red: true, value: 'Not native gRPC support',     sub: 'Requires gRPC-Web proxy or REST HTTP/1.1 facade' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · right tool, right boundary',
      quote_title: 'gRPC and REST solve<br>problems at <span style="color:var(--red);">different boundaries.</span>',
      quote_body: 'gRPC excels at the service-to-service boundary — typed, versioned, streaming, efficient. REST excels at the service-to-consumer boundary — universal, cacheable, human-debuggable. They are not competitors, they are complements.',
      left_label: 'Protobuf backward compat',
      left_body: 'Never remove a field — mark it reserved. Never reuse a field number. Add new optional fields only. These rules are non-negotiable for running multiple service versions simultaneously.',
      right_label: 'Performance context',
      right_body: 'The gRPC performance advantage is significant for high-frequency internal calls with large message volumes. For 10 req/s internal calls, the difference is unmeasurable. Do not over-engineer.',
      insight: '<strong style="color:#fff;">Start with REST, migrate to gRPC</strong> at the internal boundaries where you have evidence of performance or streaming requirements. Architecture decisions need evidence, not hype.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
