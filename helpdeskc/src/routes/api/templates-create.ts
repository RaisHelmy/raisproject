import { tenantDb } from "../../db/client";
import { uuidv7 } from "../../core/id/uuid7";
import { FIELD_TYPES, type TemplateField, type TemplateDefaults } from "../../core/templates/types";
import { ValidationError } from "../../core/errors";
import { jsonResponse } from "../cookies";
import { requireAgentPermission } from "../require-agent";
import type { RouteHandler } from "../router";

function validateFields(fields: unknown): TemplateField[] {
  if (!Array.isArray(fields) || fields.length === 0) throw new ValidationError("fields must be a non-empty array");
  for (const f of fields as Record<string, unknown>[]) {
    if (!f.key || !f.label || typeof f.type !== "string" || !(FIELD_TYPES as readonly string[]).includes(f.type)) {
      throw new ValidationError(`invalid field definition: ${JSON.stringify(f)}`);
    }
  }
  return fields as TemplateField[];
}

function validateDefaults(defaults: unknown): TemplateDefaults {
  const d = defaults as Partial<TemplateDefaults> | undefined;
  if (!d?.category || !d.priority) throw new ValidationError("defaults.category and defaults.priority are required");
  return d as TemplateDefaults;
}

export const createTemplate: RouteHandler = async (request, env, _ctx, _params, data) => {
  await requireAgentPermission(env, data, "template.manage");

  const body = (await request.json()) as { name?: string; description?: string; isDefault?: boolean; fields?: unknown; defaults?: unknown };
  if (!body.name) throw new ValidationError("name is required");
  const fields = validateFields(body.fields);
  const defaults = validateDefaults(body.defaults);

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const now = new Date().toISOString();
  const templateId = uuidv7();

  await db.templates.create({
    id: templateId,
    name: body.name,
    description: body.description ?? null,
    isDefault: Boolean(body.isDefault),
    accountId: null,
    teamId: null,
    createdAt: now,
    deletedAt: null,
  });

  const versionId = uuidv7();
  await db.templateVersions.create({
    id: versionId,
    templateId,
    version: 1,
    fields: JSON.stringify(fields),
    defaults: JSON.stringify(defaults),
    createdAt: now,
  });

  return jsonResponse({ id: templateId, versionId }, { status: 201 });
};
