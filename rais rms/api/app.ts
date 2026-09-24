import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./types";
import { requestId } from "./middleware/requestId";
import { errorHandler } from "./middleware/error";
import { securityHeaders } from "./middleware/securityHeaders";
import { requireAuth } from "./middleware/auth";
import { resolveTenant } from "./middleware/tenant";
import { authRoutes } from "./routes/auth";
import { outletRoutes } from "./routes/outlets";
import { guestRoutes } from "./routes/guests";
import { floorRoutes } from "./routes/floor";
import { reservationRoutes } from "./routes/reservations";
import { waitlistRoutes } from "./routes/waitlist";
import { analyticsRoutes } from "./routes/analytics";
import { userRoutes } from "./routes/users";
import { publicRoutes } from "./routes/public";
import { webhookRoutes } from "./routes/webhooks";
import { cronRoutes } from "./routes/cron";
import { menuRoutes } from "./routes/menu";
import { orderRoutes } from "./routes/orders";
import { ticketRoutes } from "./routes/tickets";
import { feedbackRoutes } from "./routes/feedback";
import { inventoryRoutes } from "./routes/inventory";
import { staffShiftRoutes } from "./routes/staffShifts";
import { campaignRoutes } from "./routes/campaigns";
import { loyaltyRoutes } from "./routes/loyalty";

export const app = new Hono<AppEnv>().basePath("/api");

app.use("*", requestId);
app.use("*", securityHeaders);
app.onError(errorHandler);

app.get("/health", (c) => c.json({ ok: true, data: { status: "healthy" } }));

// Public auth endpoints (registration/login issue the session cookie).
app.route("/auth", authRoutes);

// Public guest-facing endpoints (booking widget, QR ordering, feedback) — no session
// required, tenant resolved from the URL's tenant slug instead (see routes/public.ts).
// These never read cookies, so a permissive CORS is safe and lets a tenant embed
// their white-label booking widget on their own external website.
app.use("/public/*", cors({ origin: "*", allowMethods: ["GET", "POST"] }));
app.route("/public", publicRoutes);

// Stripe webhook — no session, signature-verified instead. See routes/webhooks.ts.
app.route("/webhooks", webhookRoutes);

// System/cron endpoints — no session, shared-secret header instead. See routes/cron.ts.
app.route("/cron", cronRoutes);

// Everything below requires an authenticated session, tenant-scoped.
app.use("/outlets/*", requireAuth, resolveTenant);
app.use("/guests/*", requireAuth, resolveTenant);
app.use("/reservations/*", requireAuth, resolveTenant);
app.use("/waitlist/*", requireAuth, resolveTenant);
app.use("/analytics/*", requireAuth, resolveTenant);
app.use("/users/*", requireAuth, resolveTenant);
app.use("/campaigns/*", requireAuth, resolveTenant);
app.use("/loyalty/*", requireAuth, resolveTenant);

app.route("/outlets", outletRoutes);
app.route("/guests", guestRoutes);
app.route("/outlets", floorRoutes);
app.route("/outlets", menuRoutes);
app.route("/outlets", orderRoutes);
app.route("/outlets", ticketRoutes);
app.route("/outlets", feedbackRoutes);
app.route("/outlets", inventoryRoutes);
app.route("/outlets", staffShiftRoutes);
app.route("/reservations", reservationRoutes);
app.route("/waitlist", waitlistRoutes);
app.route("/analytics", analyticsRoutes);
app.route("/users", userRoutes);
app.route("/campaigns", campaignRoutes);
app.route("/loyalty", loyaltyRoutes);

export default app;
