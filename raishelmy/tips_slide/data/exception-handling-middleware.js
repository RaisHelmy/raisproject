/* ── Global Exception Handling & ProblemDetails ──────────────────── */
window.TIP_DATA = {
  id: 'exception-handling-middleware',
  title: 'Global Exception Handling & ProblemDetails',
  description: 'IExceptionHandler, ProblemDetails RFC 9457, custom exceptions — stop leaking stack traces to clients.',
  category: 'ASP.NET · 7 slides',
  tags: ['#exceptions', '#errorhandling', '#aspnetcore', '#dotnet'],
  date: '2026-04-11',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `Seen a production app return this to the browser:

System.NullReferenceException: Object reference not set to an instance of an object. at MyApp.Controllers.OrderController.GetOrder in /app/Controllers/OrderController.cs:line 47

Full stack trace. File paths. Line numbers. Publicly visible to anyone using the app.

An exception handler middleware is not optional. ProblemDetails is not optional. This is a security concern, not just bad UX.

Slides on setting it up properly in ASP.NET Core with RFC 9457.

#aspnetcore #dotnet #security #errorhandling`,

  slides: [
    /* 01 COVER */
    {
      type: 'cover', dark: true,
      label: 'a real talk thread · rais helmy',
      title_html: 'Exception Handling.<br><span style="color:var(--red);">Stack traces.</span><br><span style="color:#555;font-weight:300;">In your API response.</span>',
      description: 'Your API returns a 500 with a full C# stack trace including database connection string. The client-side developer copies it into Slack. Your production internals are now public. This is still happening in 2026.',
      tags: ['#exceptions', '#errorhandling', '#aspnetcore', '#dotnet']
    },

    /* 02 ProblemDetails */
    {
      type: 'evr-code',
      label: 'topic 1 · problemdetails rfc 9457',
      expect_items: [
        'ProblemDetails: RFC 9457 standard — type, title, status, detail, instance fields.',
        'AddProblemDetails() + UseExceptionHandler() in .NET 7+ — one-line global handler.',
        'All error responses follow the same shape — clients parse one format, not ten.'
      ],
      reality_items: [
        'Custom error objects per controller — every endpoint returns a different error shape.',
        'Returning raw exception messages to clients — stack traces, connection strings, internal paths.',
        'HTTP 200 with {success: false} body — client has to parse body to detect errors.'
      ],
      code_good: `<span class="cgr">// ✦ Global ProblemDetails — .NET 7+</span>
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler&lt;<span class="cy">AppExceptionHandler</span>&gt;();

app.UseExceptionHandler();
app.UseStatusCodePages();    <span class="cgr">// ✦ handles 404, 405 etc.</span>

<span class="cgr">// ✦ Custom IExceptionHandler</span>
<span class="cr">public class</span> <span class="cy">AppExceptionHandler</span> : IExceptionHandler
{
    <span class="cr">public async</span> ValueTask&lt;bool&gt; TryHandleAsync(HttpContext ctx,
        Exception ex, CancellationToken ct)
    {
        ctx.Response.StatusCode = ex <span class="cr">is</span> NotFoundException ? <span class="cb">404</span> : <span class="cb">500</span>;
        <span class="cr">await</span> ctx.Response.WriteAsJsonAsync(
            <span class="cr">new</span> ProblemDetails { Title = ex.Message }, ct);
        <span class="cr">return true</span>;
    }
}`,
      code_bad: `<span class="cgr">// ✗ Stack trace leaked per controller</span>
<span class="cr">try</span>
{
    <span class="cr">var</span> order = <span class="cr">await</span> _svc.GetOrderAsync(id);
    <span class="cr">return</span> Ok(order);
}
<span class="cr">catch</span> (Exception ex)
{
    <span class="cr">return</span> StatusCode(<span class="cb">500</span>, <span class="cr">new</span> {
        Error = ex.Message,
        Stack = ex.StackTrace   <span class="cgr">// 💀 leaked to client</span>
    });
}`
    },

    /* 03 Domain Exceptions */
    {
      type: 'evr',
      label: 'topic 2 · domain exception hierarchy',
      expect_items: [
        'Domain exceptions: NotFoundException, ValidationException, ConflictException — each maps to an HTTP status.',
        'Global handler checks exception type and sets correct HTTP status code automatically.',
        'Validation exceptions carry error details — FluentValidation integrates with ProblemDetails.'
      ],
      reality_items: [
        'Throwing Exception directly everywhere — no way to distinguish user error from server error.',
        'Catching all exceptions at every method — noise drowns out real errors in logs.',
        'HTTP 400 vs 422 vs 500 decided randomly per developer per feature.'
      ],
      code: `<span class="cgr">// ✦ Domain exception hierarchy</span>
<span class="cr">public abstract class</span> <span class="cy">AppException</span>(string msg) : Exception(msg);
<span class="cr">public class</span> <span class="cy">NotFoundException</span>(string msg) : AppException(msg);
<span class="cr">public class</span> <span class="cy">ConflictException</span>(string msg) : AppException(msg);
<span class="cr">public class</span> <span class="cy">ValidationException</span>(IDictionary&lt;string,string[]&gt; errors)
    : AppException(<span class="cg">"Validation failed"</span>) {
    <span class="cr">public</span> IDictionary&lt;string,string[]&gt; Errors { get; } = errors;
}

<span class="cgr">// ✦ Handler maps type → HTTP status</span>
<span class="cr">var</span> status = ex <span class="cr">switch</span> {
    NotFoundException   =&gt; StatusCodes.Status404NotFound,
    ConflictException   =&gt; StatusCodes.Status409Conflict,
    ValidationException =&gt; StatusCodes.Status422UnprocessableEntity,
    _                   =&gt; StatusCodes.Status500InternalServerError
};`
    },

    /* 04 Framework Grid */
    {
      type: 'framework',
      label: 'practical guide · error handling matrix',
      cells: [
        { label: 'ProblemDetails',    value: 'RFC 9457 standard shape',      sub: 'type, title, status, detail, instance' },
        { label: 'IExceptionHandler', value: 'Global catch-all .NET 7+',     sub: 'Chain multiple handlers — order matters' },
        { label: '404/405/etc',       value: 'UseStatusCodePages()',         sub: 'Returns ProblemDetails for non-exception status codes' },
        { label: 'Validation 422',    value: 'FluentValidation + PD',        sub: 'ValidationProblemDetails with Errors dict' },
        { label: 'Never Expose',   red: true, value: 'Stack traces in prod', sub: 'Log internally, return generic message to client' },
        { label: 'Correlation ID',    value: 'Add to ProblemDetails.Instance', sub: 'Client sends it with support ticket — traceable' }
      ]
    },

    /* 05 Nuance */
    {
      type: 'nuance',
      label: 'the real lesson · errors are ux',
      quote_title: 'Your error response<br>is part of your <span style="color:var(--red);">API contract.</span>',
      quote_body: 'Client developers have to handle your error responses in code. If every endpoint returns a different error shape, every handler is custom. ProblemDetails is not about RFC compliance — it is about treating error responses as a first-class API feature.',
      left_label: 'Log full detail internally',
      left_body: 'Log the full exception with context (user ID, request ID, inputs) to your logging platform. Return a minimal, safe message to the client. These are two separate concerns.',
      right_label: 'Correlation ID is mandatory',
      right_body: 'Include a correlation ID in every ProblemDetails instance. When a client reports a bug, they give you the ID. You search logs. You find the full context within seconds.',
      insight: 'In production, <strong style="color:#fff;">never return exception.Message to clients</strong>. It may contain table names, column names, or internal paths. Log everything, expose nothing.'
    },

    /* 06 CTA */
    { type: 'cta' }
  ]
};
