window.TIP_DATA = {
  id: 'middleware-pipeline-order', title: 'ASP.NET Middleware: Order Matters',
  description: 'The request pipeline is not a random list. Wrong middleware order causes auth bypasses, CORS failures, and broken error handling.',
  category: 'ASP.NET · 7 slides', tags: ['#middleware','#aspnetcore','#dotnet','#security'],
  date: '2026-04-05',
  author: { name: 'Rais Helmy', role: 'Senior .NET · Solution Architect', url: 'https://raishelmy.uk' },
  linkedin_caption: `CORS preflight was failing randomly. Spent half a day debugging.

The issue: UseAuthentication and UseCors were in the wrong order. Some requests hit auth before CORS headers were added. The browser rejected the response. No error in the server logs because the request never reached the handler.

Middleware order in ASP.NET Core is not a suggestion. It is how the pipeline actually executes. Get it wrong and you get auth bypasses, broken CORS, or exception handlers that catch nothing because they are registered after the controllers.

Correct order with annotated code in the slides.

#aspnetcore #dotnet #middleware #backend`,
  slides: [
    { type:'cover', dark:true, label:'a real talk thread · rais helmy',
      title_html:'Middleware Pipeline.<br><span style="color:var(--red);">Wrong order.</span><br><span style="color:#555;font-weight:300;">Real consequences.</span>',
      description:'HTTPS redirect must come before CORS. Auth before routing. Exception handler before everything. Get it wrong and you ship auth bypasses.', tags      description:'HTTPS redirect must ,'#      description:'HTTPS redirect muslabel:'topic 1 · the correct order',
      expect_items:['UseExceptionHandler first — catches all downstream exceptions.','UseHttpsRedirection → UseStaticFiles → UseRouting → UseCors → UseAuthentication → UseAuthorization → MapControllers.','Short-circuit middleware (static files, health checks) placed early to avoid auth overhead.'],
      reality_items:['UseAuthorization before UseAuthentication — every request hits authorization without an identity.','UseExceptionHandler placed after controllers — exceptions from other middleware go unhandled.','CORS middleware placed after auth — CORS preflight gets 401 before headers are set.'],
      code_good:`<span class="cgr">// ✦ Correct ASP.NET Core pipeline order</span>
app.UseExceptionHandler(<span class="cg">"/error"</span>);    <span class="cgr">// 1st</span>
app.UseHsts();
app.UseHttpsRedirection();
app.UseStaticFiles();                   <span class="cgr">// short-circuit</span>
app.UseRouting();
app.UseCors();                          <span class="cgr">// after routing</span>
app.UseAuthentication();               <span class="cgr">// sets identity</span>
app.UseAuthorization();                <span class="cgr">// uses identity</span>
app.UseRateLimiter();
app.MapControllers();`,
      code_bad:`<span class="cgr">// ✗ Common wrong ordering</span>
app.UseRouting();
app.UseAuthorization();    <span class="cgr">// 💀 before Authentication</span>
app.UseCors();             <span class="cgr">// 💀 after auth — preflight fails</span>
app.UseAuthentication();
app.MapControllers();
app.UseExceptionHandler(); <span class="cgr">// 💀 after controllers
                           // exceptions from auth unhandled</span>` },
    { type:'evr', label:'topic 2 · custom middleware gotchas',
      expect_items:['Custom middleware next() calls are mandatory unless short-circuiting intentionally.','Middleware order in the pipeline is the order of execution on the way in, reversed on the way out.','IMiddleware (typed, DI-friendly) preferred over ad-hoc Use() lambdas for complex middleware.'],
      reality_items:['next() forgotten in a custom middleware — all requests hang with no response.','Modifying response headers after response has started — InvalidOperationException.','Middleware registered multiple times accidentally — duplicate logging, double auth checks.'],
      code:`<span class="cgr">// ✦ Proper IMiddleware implementation</span>
<span class="cr">public class</span> <span class="cy">CorrelationIdMiddleware</span> : IMiddleware
{
    <span class="cr">public async</span> Task InvokeAsync(
        HttpContext ctx, RequestDelegate next)
    {
        <span class="cr">var</span> id = ctx.Request.Headers[<span class="cg">"X-Correlation-Id"</span>]
            .FirstOrDefault() ?? Guid.NewGuid().ToString();
        ctx.Items[<span class="cg">"CorrelationId"</span>] = id;
        ctx.Response.Headers[<span class="cg">"X-Correlation-Id"</span>] = id;
        <span class="cr">await</span> next(ctx);  <span class="cgr">// ✦ always call next</span>
    }
}` },
    { type:'nuance', label:'the real lesson · pipeline is not optional reading',
      quote_title:'The pipeline is your app\'s<br><span style="color:var(--red);">first line of defence.</span>',
      quote_body:'Auth bypasses, data leaks, and CSP violations often trace back to a middleware in the wrong position. Read the ASP.NET docs on pipeline order — once.',
      left_label:'Test the pipeline',left_body:'Write integration tests for auth, CORS headers, and error responses. A middleware order bug passes unit tests and fails only in integration.',
      right_label:'Document unusual order',right_body:'When you intentionally deviate from the default order, add a comment explaining why. Future you will thank present you.',
      insight:'In ASP.NET Core, <strong style="color:#fff;">order is configuration</strong>. There is no "default safe order." You choose it, you own it.' },
    { type:'cta' }
  ]
};
