import { tenantDb } from "../../db/client";
import { uuidv7 } from "../../core/id/uuid7";
import { FIELD_TYPES, type TemplateField, type TemplateDefaults } from "../../core/templates/types";
import { NotFoundError, ValidationError } from "../../core/errors";
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

/**
 * Editing a template never changes existing tickets (CLAUDE.md §9) —
 * this always appends a new version rather than mutating the last one.
 */
export const createTemplateVersion: RouteHandler = async (request, env, _ctx, params, data) => {
  await requireAgentPermission(env, data, "template.manage");

  const body = (await request.json()) as { fields?: unknown; defaults?: unknown; name?: string; description?: string };
  const fields = validateFields(body.fields);
  const defaults = validateDefaults(body.defaults);

  const db = tenantDb(env.HYPERDRIVE, data.tenantId);
  const template = await db.templates.get(params.id!);
  if (!template) throw new NotFoundError("Template");

  const latest = await db.templateVersions.latest(template.id);
  const nextVersion = (latest?.version ?? 0) + 1;

  const versionId = uuidv7();
  await db.templateVersions.create({
    id: versionId,
    templateId: template.id,
    version: nextVersion,
    fields: JSON.stringify(fields),
    defaults: JSON.stringify(defaults),
    createdAt: new Date().toISOString(),
  });

  if (body.name !== undefined || body.description !== undefined) {
    await db.templates.update(template.id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
    });
  }

  return jsonResponse({ versionId, version: nextVersion }, { status: 201 });
};
