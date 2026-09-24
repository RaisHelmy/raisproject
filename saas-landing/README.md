# saas-landing

Static gallery landing page for the Raishelmy product suite. Pure HTML/CSS/JS,
no build step — meant to be deployed as a Cloudflare Pages project at
`saas.raishelmy.uk`.

## Edit content

All app cards live in the `apps` array in `index.html` (name, icon, description,
tags, status, and `url`). Edit that array and redeploy — no build step needed.

Update `status` per app as things go live: `"live"`, `"beta"`, or `"internal"`.

## Admin console (`/admin`)

`functions/` holds Cloudflare Pages Functions that serve a password-gated
admin console at `/admin`. Signing in once (12 h cookie) shows every product;
"Open admin" on a card hits `/admin/go/<id>`, which mints a 90-second
HMAC-signed token and redirects to that app's `…/auth/sso?token=` endpoint.
The app verifies the token with the same shared secret, starts its normal
session for `raishelmy97@gmail.com`, and lands on its admin dashboard.

The app table (id, host, SSO URL) lives in `functions/_lib.ts`.

Two secrets must be set on the Pages project — the console returns 503 until
they are:

```bash
npx wrangler pages secret put SAAS_SSO_SECRET --project-name saas-landing   # same value as every app's SAAS_SSO_SECRET
npx wrangler pages secret put ADMIN_PASSWORD  --project-name saas-landing   # password for the /admin login form
```

## Local preview

```bash
npm run dev
```

## Deploy

```bash
npm run deploy
```

First deploy will ask you to create the Pages project (`saas-landing`) if it
doesn't exist yet, or you can create it up front:

```bash
npx wrangler pages project create saas-landing
```

## Point saas.raishelmy.uk at it

In the Cloudflare dashboard → Workers & Pages → `saas-landing` → Custom domains
→ add `saas.raishelmy.uk`. Cloudflare creates the DNS record automatically if
the zone `raishelmy.uk` is on the same account.

## Subdomains referenced on the page

The card links assume each product will eventually live on its own subdomain
(`hrms.`, `helpdesk.`, `rms.`, `pantas.`, `eat.`, `travel.`, `fintech.`,
`timesheet.`, `create.`, `runforge.`, `mcp.` — all `.raishelmy.uk`). Adjust the
`url` field per app if you use different names, and set up each one as a
Custom Domain on its respective Worker/Pages project the same way.
