import { tenantDb } from "../../db/client";
import { platformDb } from "../../db/platform-client";
import { uuidv7 } from "../../core/id/uuid7";
import { validateTemplateValues } from "../../core/templates/validate";
import type { TemplateField, TemplateDefaults, TemplateFieldValues } from "../../core/templates/types";
import { addBusinessMinutes, type BusinessHoursWeek } from "../../core/sla/business-hours";
import { requirePermission } from "../../core/authz";
import { NotFoundError, UnauthenticatedError, ValidationError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { buildAuthContext } from "../build-auth-context";
import type { RouteHandler } from "../router";

interface CreateTicketBody {
  templateId: string;
  subject: string;
  fieldValues: TemplateFieldValues;
  // Only honoured for agent-authenticated requests raising on behalf of a Contact.
  contactId?: string;
}

export const createTicket: RouteHandler = async (request, env, _ctx, _params, data) => {
  if (!data.session) throw new UnauthenticatedError();
  const authCtx = await buildAuthContext(env.HYPERDRIVE, data);
  if (!authCtx) throw new UnauthenticatedError();

  const body = (await request.json()) as CreateTicketBody;
  if (!body.templateId || !body.subject || !body.fieldValues) {
    throw new ValidationError("templateId, subject and fieldValues are required");
  }

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);

  let accountId: string;
  let teamId: string | null;
  let contactId: string;

  if (authCtx.subjectType === "contact") {
    const contact = await db.contacts.get(authCtx.subjectId);
    if (!contact) throw new NotFoundError("Contact");
    accountId = contact.accountId;
    teamId = contact.teamId;
    contactId = contact.id;
  } else {
    requirePermission(authCtx, "ticket.create");
    if (!body.contactId) throw new ValidationError("contactId is required when an agent raises a ticket");
    const contact = await db.contacts.get(body.contactId);
    if (!contact) throw new NotFoundError("Contact");
    accountId = contact.accountId;
    teamId = contact.teamId;
    contactId = contact.id;
  }

  const template = await db.templates.get(body.templateId);
  if (!template) throw new NotFoundError("Template");
  const templateVersion = await db.templateVersions.latest(template.id);
  if (!templateVersion) throw new NotFoundError("Template version");

  const fields = JSON.parse(templateVersion.fields) as TemplateField[];
  const defaults = JSON.parse(templateVersion.defaults) as TemplateDefaults;

  const fieldErrors = validateTemplateValues(fields, body.fieldValues);
  if (fieldErrors.length > 0) throw new ValidationError("Invalid field values", fieldErrors);

  const now = new Date().toISOString();
  const ticketId = uuidv7();

  let slaFirstResponseDueAt: string | null = null;
  let slaResolutionDueAt: string | null = null;
  if (defaults.slaPolicyId) {
    const policy = await db.slaPolicies.get(defaults.slaPolicyId);
    if (policy) {
      const businessHours = JSON.parse(policy.businessHours) as BusinessHoursWeek;
      const holidays = JSON.parse(policy.holidays) as string[];
      const targets = JSON.parse(policy.targets) as Record<string, { firstResponseMinutes: number; resolutionMinutes: number }>;
      const target = targets[defaults.priority];
      if (target) {
        slaFirstResponseDueAt = addBusinessMinutes(now, target.firstResponseMinutes, policy.timezone, businessHours, holidays);
        slaResolutionDueAt = addBusinessMinutes(now, target.resolutionMinutes, policy.timezone, businessHours, holidays);
      }
    }
  }

  // Ticket numbers are minted by a per-tenant Durable Object — MAX(number)+1
  // on D1 would race under concurrency (CLAUDE.md §10).
  const seqStub = env.TICKET_SEQUENCE.getByName(data.tenantId);
  const number = await seqStub.next();

  await db.tickets.create({
    id: ticketId,
    number,
    accountId,
    teamId,
    contactId,
    templateId: template.id,
    templateVersionId: templateVersion.id,
    status: "new",
    priority: defaults.priority,
    category: defaults.category,
    subject: body.subject,
    assigneeAgentId: defaults.assigneeAgentId ?? null,
    queue: defaults.queue ?? null,
    fieldValues: JSON.stringify(body.fieldValues),
    slaPolicyId: defaults.slaPolicyId ?? null,
    slaFirstResponseDueAt,
    slaResolutionDueAt,
    createdAt: now,
    updatedAt: now,
  });

  await db.tenantUsage.incrementTicketCount();

  const filterableKeys = fields.filter((f) => f.filterable).map((f) => f.key);
  await db.ticketFieldValues.bulkCreate(
    filterableKeys
      .filter((key) => body.fieldValues[key] !== undefined && body.fieldValues[key] !== null)
      .map((key) => ({
        id: uuidv7(),
        ticketId,
        fieldKey: key,
        value: String(body.fieldValues[key]),
      })),
  );

  await db.ticketEvents.create({
    id: uuidv7(),
    ticketId,
    type: "status_change",
    actorType: authCtx.subjectType,
    actorId: authCtx.subjectId,
    data: JSON.stringify({ from: null, to: "new" }),
    createdAt: now,
  });

  return jsonResponse({ id: ticketId, number }, { status: 201 });
};
