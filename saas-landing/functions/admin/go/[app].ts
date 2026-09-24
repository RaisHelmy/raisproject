import { APPS, type Env, hasValidSession, mintSsoToken } from "../../_lib";

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!env.SAAS_SSO_SECRET) return new Response("Admin console not configured", { status: 503 });
  if (!(await hasValidSession(request, env))) {
    return Response.redirect(new URL("/admin?error=expired", request.url).toString(), 303);
  }
  const app = APPS.find((a) => a.id === params.app);
  if (!app) return new Response("Unknown app", { status: 404 });
  if (!app.sso) return Response.redirect(`https://${app.host}/`, 302);

  const token = await mintSsoToken(env.SAAS_SSO_SECRET, app.id);
  const target = new URL(app.sso);
  target.searchParams.set("token", token);
  return new Response(null, {
    status: 302,
    headers: { Location: target.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
};
