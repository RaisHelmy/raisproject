import { APPS, type Env, hasValidSession, html } from "../_lib";

const SHELL_STYLE = `
  :root{--bg:#0b0d12;--bg-soft:#12151c;--card:#171b24;--border:#262b36;--text:#eef1f6;--text-dim:#9aa3b2;--accent:#6ee7b7;--accent-2:#60a5fa;--danger:#f87171}
  *{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:1100px;margin:0 auto;padding:0 20px}
  header{padding:40px 0 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
  .brand{font-size:13px;font-weight:700;letter-spacing:.08em;color:var(--text-dim);display:flex;align-items:center;gap:8px}
  .brand .dot{width:8px;height:8px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2))}
  h1{margin:8px 0 0;font-size:clamp(24px,4vw,34px);letter-spacing:-.02em}
  h1 span{background:linear-gradient(135deg,var(--accent),var(--accent-2));-webkit-background-clip:text;background-clip:text;color:transparent}
  .sub{color:var(--text-dim);margin:6px 0 0;font-size:14px}
  main{padding:28px 0 60px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
  .card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:10px;transition:transform .15s,border-color .15s}
  .card:hover{transform:translateY(-2px);border-color:#333a48}
  .top{display:flex;align-items:center;gap:10px}
  .icon{width:36px;height:36px;border-radius:9px;background:var(--bg-soft);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px}
  .card h3{margin:0;font-size:16px}.host{font-size:12px;color:var(--text-dim);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
  .go{margin-top:auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:600;padding:9px 14px;border-radius:9px;border:1px solid var(--border);background:var(--bg-soft);cursor:pointer;color:var(--text)}
  .card:hover .go{border-color:var(--accent);color:var(--accent)}
  .go.plain{opacity:.7}.note{font-size:12px;color:var(--text-dim)}
  .btn{font:inherit;font-weight:600;padding:9px 14px;border-radius:9px;border:1px solid var(--border);background:var(--bg-soft);color:var(--text);cursor:pointer}
  .btn:hover{border-color:var(--accent);color:var(--accent)}
  form.login{max-width:380px;margin:80px auto;background:var(--card);border:1px solid var(--border);border-radius:14px;padding:26px;display:flex;flex-direction:column;gap:12px}
  form.login h2{margin:0 0 4px;font-size:20px}form.login p{margin:0 0 8px;color:var(--text-dim);font-size:14px}
  input[type=password]{font:inherit;padding:11px 12px;border-radius:9px;border:1px solid var(--border);background:var(--bg-soft);color:var(--text);width:100%}
  input:focus{outline:none;border-color:var(--accent-2)}
  .err{color:var(--danger);font-size:13px;margin:0}
  footer{border-top:1px solid var(--border);padding:20px 0 30px;color:var(--text-dim);font-size:12px}
  @media (prefers-color-scheme:light){:root{--bg:#f7f8fa;--bg-soft:#eef0f3;--card:#fff;--border:#e3e6ec;--text:#14161a;--text-dim:#5c6470}}
`;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function loginPage(error?: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Admin — Raishelmy</title><link rel="icon" href="/favicon.png"><style>${SHELL_STYLE}</style></head><body>
<div class="wrap">
  <form class="login" method="post" action="/admin/login" autocomplete="off">
    <div class="brand"><span class="dot"></span> RAISHELMY.UK / ADMIN</div>
    <h2>Suite admin</h2>
    <p>Enter the admin password once. Every product then opens already signed in.</p>
    ${error ? `<p class="err">${escapeHtml(error)}</p>` : ""}
    <input type="password" name="password" placeholder="Admin password" required autofocus>
    <button class="btn" type="submit">Continue</button>
  </form>
</div></body></html>`;
}

function dashboardPage(): string {
  const cards = APPS.map((app) => {
    const action = app.sso
      ? `<a class="go" href="/admin/go/${app.id}" rel="noopener">Open admin →</a>`
      : `<a class="go plain" href="https://${app.host}" target="_blank" rel="noopener">Open site ↗</a>`;
    return `<div class="card">
      <div class="top"><div class="icon">${app.icon}</div><div><h3>${escapeHtml(app.name)}</h3><div class="host">${escapeHtml(app.host)}</div></div></div>
      ${app.note ? `<div class="note">${escapeHtml(app.note)}</div>` : `<div class="note">Signs you in as the super-admin account and opens the admin dashboard.</div>`}
      ${action}
    </div>`;
  }).join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Admin — Raishelmy</title><link rel="icon" href="/favicon.png"><style>${SHELL_STYLE}</style></head><body>
<div class="wrap">
  <header>
    <div>
      <div class="brand"><span class="dot"></span> RAISHELMY.UK / ADMIN</div>
      <h1>Suite <span>admin console</span></h1>
      <p class="sub">One click opens each product's admin dashboard, already signed in.</p>
    </div>
    <form method="post" action="/admin/logout"><button class="btn" type="submit">Sign out</button></form>
  </header>
  <main><div class="grid">${cards}</div></main>
  <footer>Sessions last 12 hours. SSO links are single-use for 90 seconds. <a href="/">← Back to the public suite page</a></footer>
</div></body></html>`;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SAAS_SSO_SECRET || !env.ADMIN_PASSWORD) {
    return html("<p>Admin console is not configured: set the SAAS_SSO_SECRET and ADMIN_PASSWORD secrets on this Pages project.</p>", 503);
  }
  if (await hasValidSession(request, env)) return html(dashboardPage());
  const url = new URL(request.url);
  const err = url.searchParams.get("error");
  return html(loginPage(err === "bad" ? "Wrong password." : err === "expired" ? "Session expired — sign in again." : undefined), 401);
};
