import { constantTimeEqual, type Env, issueSessionCookie } from "../_lib";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SAAS_SSO_SECRET || !env.ADMIN_PASSWORD) return new Response("Admin console not configured", { status: 503 });

  const form = await request.formData().catch(() => null);
  const password = form?.get("password");
  const ok = typeof password === "string" && (await constantTimeEqual(password, env.ADMIN_PASSWORD));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800));
    return Response.redirect(new URL("/admin?error=bad", request.url).toString(), 303);
  }
  return new Response(null, {
    status: 303,
    headers: { Location: "/admin", "Set-Cookie": await issueSessionCookie(env.SAAS_SSO_SECRET), "Cache-Control": "no-store" },
  });
};
