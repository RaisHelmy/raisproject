import { describe, expect, test } from "bun:test";
import { validateTemplateValues, isFieldVisible } from "../../src/core/templates/validate";
import type { TemplateField } from "../../src/core/templates/types";

const fields: TemplateField[] = [
  { key: "summary", label: "Summary", type: "text", required: true, validation: { minLength: 3 } },
  { key: "severity", label: "Severity", type: "select", required: true, options: ["low", "high"] },
  { key: "other_reason", label: "Reason", type: "text", required: true, visibleWhen: { whenFieldKey: "severity", equals: "other" } },
  { key: "email", label: "Email", type: "email", required: false },
];

describe("validateTemplateValues", () => {
  test("passes with valid values", () => {
    const errors = validateTemplateValues(fields, { summary: "Something broke", severity: "high" });
    expect(errors).toEqual([]);
  });

  test("flags missing required fields", () => {
    const errors = validateTemplateValues(fields, {});
    expect(errors.map((e) => e.key).sort()).toEqual(["severity", "summary"]);
  });

  test("flags a select value outside its options", () => {
    const errors = validateTemplateValues(fields, { summary: "ok value", severity: "medium" });
    expect(errors).toEqual([{ key: "severity", message: "is not a valid option" }]);
  });

  test("enforces minLength on text fields", () => {
    const errors = validateTemplateValues(fields, { summary: "ab", severity: "low" });
    expect(errors).toEqual([{ key: "summary", message: "must be at least 3 characters" }]);
  });

  test("rejects an invalid email", () => {
    const errors = validateTemplateValues(fields, { summary: "valid summary", severity: "low", email: "not-an-email" });
    expect(errors).toEqual([{ key: "email", message: "must be a valid email" }]);
  });

  test("a hidden conditional field is not required", () => {
    const errors = validateTemplateValues(fields, { summary: "valid summary", severity: "low" });
    expect(errors).toEqual([]);
  });

  test("a visible conditional field is required", () => {
    const errors = validateTemplateValues(fields, { summary: "valid summary", severity: "other" });
    expect(errors.map((e) => e.key)).toContain("other_reason");
  });
});

describe("isFieldVisible", () => {
  test("true when there is no condition", () => {
    expect(isFieldVisible(fields[0]!, {})).toBe(true);
  });
  test("false when the condition does not match", () => {
    expect(isFieldVisible(fields[2]!, { severity: "low" })).toBe(false);
  });
  test("true when the condition matches", () => {
    expect(isFieldVisible(fields[2]!, { severity: "other" })).toBe(true);
  });
});
