interface Env { ORIGIN: string; EDGE_SECRET?: string }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const target = new URL(env.ORIGIN);
    target.pathname = url.pathname;
    target.search = url.search;
    const headers = new Headers(request.headers);
    headers.set("x-rais-edge", env.EDGE_SECRET ?? "");
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", "https");
    const res = await fetch(target.toString(), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });
    // Pass through untouched (streams included); relative Location/Set-Cookie headers already fit this host.
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers });
  },
} satisfies ExportedHandler<Env>;
