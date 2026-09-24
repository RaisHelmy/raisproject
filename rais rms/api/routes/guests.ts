import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { zValidator, getValidated } from "../middleware/validate";
import { requireRole } from "../middleware/rbac";
import { ROLE_GROUPS } from "../lib/roleGroups";
import { createGuestSchema, updateGuestSchema } from "../../shared/schemas";
import {
  addGuestNote,
  createGuest,
  getGuest,
  getGuestTags,
  listGuestNotes,
  listGuestVisits,
  listGuests,
  updateGuest,
} from "../db/guests";
import { notFound } from "../lib/errors";
import type { CreateGuestInput } from "../../shared/schemas";

export const guestRoutes = new Hono<AppEnv>();

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().max(200).optional(),
});

guestRoutes.get("/", zValidator("query", listQuerySchema), async (c) => {
  const tenantId = c.get("tenantId");
  const q = getValidated<z.infer<typeof listQuerySchema>>(c, "query");
  const { items, total } = await listGuests(c.env.DB, tenantId, q);
  return c.json({ ok: true, data: items, meta: { page: q.page, pageSize: q.pageSize, total } });
});

guestRoutes.post("/", requireRole(ROLE_GROUPS.GUEST_WRITE), zValidator("json", createGuestSchema), async (c) => {
  const tenantId = c.get("tenantId");
  const input = getValidated<CreateGuestInput>(c, "json");
  const guest = await createGuest(c.env.DB, tenantId, {
    name: input.name,
    email: input.email,
    phone: input.phone,
    marketingConsent: input.marketingConsent,
    dob: input.dob,
    tags: input.tags,
  });
  return c.json({ ok: true, data: guest }, 201);
});

guestRoutes.get("/:guestId", async (c) => {
  const tenantId = c.get("tenantId");
  const guestId = c.req.param("guestId");
  const guest = await getGuest(c.env.DB, tenantId, guestId);
  if (!guest) throw notFound();
  const tags = await getGuestTags(c.env.DB, tenantId, guestId);
  return c.json({ ok: true, data: { ...guest, tags } });
});

guestRoutes.patch(
  "/:guestId",
  requireRole(ROLE_GROUPS.GUEST_WRITE),
  zValidator("json", updateGuestSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const guestId = c.req.param("guestId");
    const input = getValidated<Partial<CreateGuestInput>>(c, "json");
    const updated = await updateGuest(c.env.DB, tenantId, guestId, {
      name: input.name,
      email: input.email,
      phone: input.phone,
      marketingConsent: input.marketingConsent,
      dob: input.dob,
    });
    if (!updated) throw notFound();
    return c.json({ ok: true, data: updated });
  },
);

guestRoutes.get("/:guestId/visits", async (c) => {
  const tenantId = c.get("tenantId");
  const guestId = c.req.param("guestId");
  const guest = await getGuest(c.env.DB, tenantId, guestId);
  if (!guest) throw notFound();
  const visits = await listGuestVisits(c.env.DB, tenantId, guestId);
  return c.json({ ok: true, data: visits });
});

guestRoutes.get("/:guestId/notes", async (c) => {
  const tenantId = c.get("tenantId");
  const guestId = c.req.param("guestId");
  const guest = await getGuest(c.env.DB, tenantId, guestId);
  if (!guest) throw notFound();
  const notes = await listGuestNotes(c.env.DB, tenantId, guestId);
  return c.json({ ok: true, data: notes });
});

const createNoteSchema = z.object({ note: z.string().min(1).max(4000) });

guestRoutes.post(
  "/:guestId/notes",
  requireRole(ROLE_GROUPS.GUEST_WRITE),
  zValidator("json", createNoteSchema),
  async (c) => {
    const tenantId = c.get("tenantId");
    const guestId = c.req.param("guestId");
    const guest = await getGuest(c.env.DB, tenantId, guestId);
    if (!guest) throw notFound();
    const input = getValidated<z.infer<typeof createNoteSchema>>(c, "json");
    const auth = c.get("auth");
    const note = await addGuestNote(c.env.DB, tenantId, guestId, { authorId: auth.userId, note: input.note });
    return c.json({ ok: true, data: note }, 201);
  },
);
