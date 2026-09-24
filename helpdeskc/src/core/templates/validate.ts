import type { TemplateField, TemplateFieldValues } from "./types";

export interface FieldError {
  key: string;
  message: string;
}

/** Is `field` currently shown, given the other submitted values? */
export function isFieldVisible(field: TemplateField, values: TemplateFieldValues): boolean {
  if (!field.visibleWhen) return true;
  return values[field.visibleWhen.whenFieldKey] === field.visibleWhen.equals;
}

/**
 * Validates submitted field values against a template version's fields.
 * Runs identically on client (UX) and server (truth) — the server call is
 * authoritative (CLAUDE.md §9). Hidden fields (conditional visibility false)
 * are not required and their submitted value is ignored.
 */
export function validateTemplateValues(
  fields: TemplateField[],
  values: TemplateFieldValues,
): FieldError[] {
  const errors: FieldError[] = [];

  for (const field of fields) {
    if (!isFieldVisible(field, values)) continue;

    const value = values[field.key];
    const isEmpty = value === undefined || value === null || value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (field.required && isEmpty) {
      errors.push({ key: field.key, message: "is required" });
      continue;
    }
    if (isEmpty) continue;

    errors.push(...validateFieldValue(field, value));
  }

  return errors;
}

function validateFieldValue(field: TemplateField, value: NonNullable<TemplateFieldValues[string]>): FieldError[] {
  const errors: FieldError[] = [];
  const v = field.validation ?? {};

  switch (field.type) {
    case "text":
    case "textarea":
    case "email":
    case "url": {
      if (typeof value !== "string") {
        errors.push({ key: field.key, message: "must be text" });
        break;
      }
      if (typeof v.minLength === "number" && value.length < v.minLength) {
        errors.push({ key: field.key, message: `must be at least ${v.minLength} characters` });
      }
      if (typeof v.maxLength === "number" && value.length > v.maxLength) {
        errors.push({ key: field.key, message: `must be at most ${v.maxLength} characters` });
      }
      if (typeof v.pattern === "string" && !new RegExp(v.pattern).test(value)) {
        errors.push({ key: field.key, message: "is not in the expected format" });
      }
      if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push({ key: field.key, message: "must be a valid email" });
      }
      if (field.type === "url") {
        try {
          new URL(value);
        } catch {
          errors.push({ key: field.key, message: "must be a valid URL" });
        }
      }
      break;
    }
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isNaN(n)) {
        errors.push({ key: field.key, message: "must be a number" });
        break;
      }
      if (typeof v.min === "number" && n < v.min) {
        errors.push({ key: field.key, message: `must be at least ${v.min}` });
      }
      if (typeof v.max === "number" && n > v.max) {
        errors.push({ key: field.key, message: `must be at most ${v.max}` });
      }
      break;
    }
    case "date": {
      if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
        errors.push({ key: field.key, message: "must be a valid date" });
      }
      break;
    }
    case "checkbox": {
      if (typeof value !== "boolean") {
        errors.push({ key: field.key, message: "must be true or false" });
      }
      break;
    }
    case "select": {
      if (typeof value !== "string" || (field.options && !field.options.includes(value))) {
        errors.push({ key: field.key, message: "is not a valid option" });
      }
      break;
    }
    case "multiselect": {
      if (!Array.isArray(value) || (field.options && value.some((v2) => !field.options!.includes(String(v2))))) {
        errors.push({ key: field.key, message: "contains an invalid option" });
      }
      break;
    }
    case "file": {
      // File presence/validity is enforced at upload time (CLAUDE.md §11);
      // here we only check that a reference (attachment id) was supplied.
      if (typeof value !== "string") {
        errors.push({ key: field.key, message: "must reference an uploaded file" });
      }
      break;
    }
  }

  return errors;
}
