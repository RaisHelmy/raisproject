/**
 * Privacy filter applied before anything reaches telemetry, audit or AI context.
 *   Raw Input → Secret Detection → PII Detection → Redaction → Structured Telemetry
 */
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  { name: "gitlab-token", re: /\bglpat-[A-Za-z0-9\-_]{20,}\b/g },
  { name: "aws-key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "openai-key", re: /\bsk-[A-Za-z0-9\-_]{20,}\b/g },
  { name: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/g },
  { name: "jwt", re: /\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b/g },
  { name: "private-key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: "connection-string", re: /\b(postgres(ql)?|mysql|mongodb(\+srv)?|redis|mssql|sqlserver):\/\/[^\s'"]+/gi },
  { name: "password-assignment", re: /\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)\s*[=:]\s*["']?[^\s"',;]{4,}/gi },
  { name: "bearer", re: /\bBearer\s+[A-Za-z0-9\-_.=]{16,}/g },
];

const PII_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { name: "phone-my", re: /\b(\+?60|0)1[0-9]-?[0-9]{7,8}\b/g },
  { name: "nric-my", re: /\b\d{6}-\d{2}-\d{4}\b/g },
  { name: "credit-card", re: /\b(?:\d[ -]?){13,16}\b/g },
];

export interface RedactionResult { text: string; redactions: { name: string; count: number }[]; containsSecrets: boolean; containsPii: boolean }

export function redact(input: string, opts: { pii?: boolean } = { pii: true }): RedactionResult {
  let text = input;
  const redactions: { name: string; count: number }[] = [];
  let containsSecrets = false, containsPii = false;
  for (const p of SECRET_PATTERNS) {
    const matches = text.match(p.re);
    if (matches?.length) {
      containsSecrets = true;
      redactions.push({ name: p.name, count: matches.length });
      text = text.replace(p.re, (m) => p.name === "password-assignment" ? m.replace(/([=:]\s*["']?)[^\s"',;]+/, "$1[REDACTED]") : "[REDACTED:" + p.name + "]");
    }
  }
  if (opts.pii !== false) {
    for (const p of PII_PATTERNS) {
      const matches = text.match(p.re);
      if (matches?.length) {
        containsPii = true;
        redactions.push({ name: p.name, count: matches.length });
        text = text.replace(p.re, "[PII:" + p.name + "]");
      }
    }
  }
  return { text, redactions, containsSecrets, containsPii };
}

export function containsSecret(input: string): boolean {
  return SECRET_PATTERNS.some((p) => { p.re.lastIndex = 0; return p.re.test(input); });
}

/** Deep-redact any string fields in an object (used before telemetry/export). */
export function redactObject<T>(obj: T): T {
  if (typeof obj === "string") return redact(obj, { pii: false }).text as unknown as T;
  if (Array.isArray(obj)) return obj.map(redactObject) as unknown as T;
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (/(password|secret|token|apikey|api_key|privatekey|private_key|credential(?!Ref))/i.test(k)) out[k] = "[REDACTED]";
      else out[k] = redactObject(v);
    }
    return out as T;
  }
  return obj;
}
