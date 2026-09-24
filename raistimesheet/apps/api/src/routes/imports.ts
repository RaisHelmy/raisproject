import { Hono } from "hono";
import { z } from "zod";
import type { HonoEnv } from "../middleware";
import { rateLimit, requireAuth } from "../middleware";
import { ok, parsePage } from "../lib/http";
import { Errors } from "../lib/errors";
import { isApprover } from "../services/context";
import { acceptAllPending, acceptWorkItem, createImport, getImport, ignoreWorkItem, markImportCompleteIfDone, mergeWorkItems, reanalyse, restoreWorkItem, splitWorkItem } from "../services/imports";
import { safeJson, toImportDTO, toMessageDTO, toWorkItemDTO } from "../services/mappers";
import type { AnalysisSummaryDTO } from "@rais/shared-types";
import { aiIsDemo } from "../services/ai";

const router = new Hono<HonoEnv>();
router.use("*", requireAuth);

router.post("/", rateLimit(20, 3600, "upload"), async (c) => {
  const ctx = c.get("ctx");
  const form = await c.req.formData().catch(() => null);
  if (!form) throw Errors.validation("Expected a multipart form with a file and project_id.");
  const file = form.get("file");
  const projectId = String(form.get("project_id") ?? "");
  if (!(file instanceof File)) throw Errors.validation("Please choose a WhatsApp export file.");
  if (!projectId) throw Errors.validation("Please choose a project.");
  const imp = await createImport(ctx, file, projectId);
  return ok(c, toImportDTO(imp), aiIsDemo(ctx.env) ? ["AI demo mode is active (heuristic provider). Configure ANTHROPIC_API_KEY for Claude-based analysis."] : undefined, 201);
});

router.get("/", async (c) => {
  const ctx = c.get("ctx");
  const page = parsePage(c.req.query());
  const r = await ctx.repos.imports.list(isApprover(ctx.user) && c.req.query("all") === "1" ? {} : { user_id: ctx.user!.id }, { offset: page.offset, limit: page.page_size });
  return ok(c, { items: r.items.map(toImportDTO), total: r.total, page: page.page, page_size: page.page_size });
});

router.get("/:id", async (c) => {
  const ctx = c.get("ctx");
  const imp = await getImport(ctx, c.req.param("id"));
  const analysis = await ctx.repos.analyses.latestForImport(imp.id);
  const summary = analysis ? safeJson<AnalysisSummaryDTO | null>(analysis.summary_json, null) : null;
  return ok(c, { import: toImportDTO(imp), analysis: analysis ? { id: analysis.id, status: analysis.status, provider: analysis.provider, model: analysis.model, is_demo: !!analysis.is_demo, started_at: analysis.started_at, completed_at: analysis.completed_at, error: analysis.error_message, summary } : null });
});

router.get("/:id/messages", async (c) => {
  const ctx = c.get("ctx");
  const imp = await getImport(ctx, c.req.param("id"));
  const msgs = await ctx.repos.imports.messages(imp.id);
  return ok(c, msgs.map(toMessageDTO));
});

router.get("/:id/tasks", async (c) => {
  const ctx = c.get("ctx");
  const imp = await getImport(ctx, c.req.param("id"));
  const items = await ctx.repos.analyses.workItems(imp.id);
  return ok(c, items.map(toWorkItemDTO));
});

router.post("/:id/analyse", rateLimit(10, 600, "analyse"), async (c) => {
  await reanalyse(c.get("ctx"), c.req.param("id"));
  return ok(c, { queued: true }, undefined, 202);
});

router.post("/:id/accept-all", async (c) => {
  const r = await acceptAllPending(c.get("ctx"), c.req.param("id"));
  return ok(c, r);
});

const AcceptSchema = z.object({ title: z.string().min(3).max(200).optional(), description: z.string().max(5000).optional(), work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), duration_minutes: z.number().int().min(0).max(1440).optional(), start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), end_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), work_status: z.enum(["COMPLETED", "IN_PROGRESS", "BLOCKED", "UNKNOWN"]).optional() });

router.post("/work-items/:id/accept", async (c) => {
  const ctx = c.get("ctx");
  const body = AcceptSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Invalid values.", body.error.issues);
  const r = await acceptWorkItem(ctx, c.req.param("id"), body.data);
  const w = await ctx.repos.analyses.workItem(c.req.param("id"));
  if (w) await markImportCompleteIfDone(ctx, w.import_id);
  return ok(c, r, undefined, 201);
});

router.post("/work-items/:id/ignore", async (c) => {
  const ctx = c.get("ctx");
  const body = z.object({ reason: z.string().max(300).optional() }).safeParse(await c.req.json().catch(() => ({})));
  await ignoreWorkItem(ctx, c.req.param("id"), body.success ? body.data.reason : undefined);
  const w = await ctx.repos.analyses.workItem(c.req.param("id"));
  if (w) await markImportCompleteIfDone(ctx, w.import_id);
  return ok(c, { ignored: true });
});

router.post("/work-items/:id/restore", async (c) => {
  await restoreWorkItem(c.get("ctx"), c.req.param("id"));
  return ok(c, { restored: true });
});

router.post("/work-items/:id/split", async (c) => {
  const body = z.object({ parts: z.array(z.object({ title: z.string().max(200).optional(), message_ids: z.array(z.string()).min(1) })).min(2).max(10) }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Provide at least two groups of message ids.");
  const ids = await splitWorkItem(c.get("ctx"), c.req.param("id"), body.data.parts);
  return ok(c, { work_item_ids: ids }, undefined, 201);
});

router.post("/work-items/merge", async (c) => {
  const body = z.object({ ids: z.array(z.string()).min(2).max(20), title: z.string().max(200).optional() }).safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Choose at least two items to merge.");
  const id = await mergeWorkItems(c.get("ctx"), body.data.ids, body.data.title);
  return ok(c, { work_item_id: id }, undefined, 201);
});

export default router;
