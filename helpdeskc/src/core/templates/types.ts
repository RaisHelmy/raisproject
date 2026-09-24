export const FIELD_TYPES = [
  "text",
  "textarea",
  "select",
  "multiselect",
  "date",
  "number",
  "checkbox",
  "file",
  "email",
  "url",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface ConditionalVisibility {
  whenFieldKey: string;
  equals: string | number | boolean;
}

export interface TemplateField {
  key: string;
  label: string;
  type: FieldType;
  helpText?: string;
  required: boolean;
  /** select/multiselect only */
  options?: string[];
  /** e.g. { min, max, minLength, maxLength, pattern } depending on type */
  validation?: Record<string, string | number>;
  visibleWhen?: ConditionalVisibility;
  filterable?: boolean;
}

export interface TemplateDefaults {
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  assigneeAgentId?: string;
  queue?: string;
  slaPolicyId?: string;
}

export type TemplateFieldValues = Record<string, string | number | boolean | string[] | null>;
