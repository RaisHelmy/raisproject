import { clearSessionCookie, type Env } from "../_lib";

export const onRequestPost: PagesFunction<Env> = async () =>
  new Response(null, { status: 303, headers: { Location: "/admin", "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
