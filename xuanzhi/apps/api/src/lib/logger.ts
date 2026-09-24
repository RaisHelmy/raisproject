/** Structured JSON logging with correlation ids. Never logs secrets or full conversations. */
export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogContext { request_id?: string; user_id?: string; [k: string]: unknown }
const SENSITIVE = /token|secret|password|authorization|api_key|apikey|cookie|content/i;
function redact(obj?: Record<string, unknown>): Record<string, unknown> {
  if (!obj) return {}; const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = SENSITIVE.test(k) ? "[redacted]" : v instanceof Error ? { name: v.name, message: v.message } : v;
  return out;
}
export class Logger {
  constructor(private readonly ctx: LogContext = {}) {}
  child(extra: LogContext): Logger { return new Logger({ ...this.ctx, ...extra }); }
  private emit(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...this.ctx, ...redact(extra) });
    if (level === "error") console.error(line); else if (level === "warn") console.warn(line); else console.log(line);
  }
  debug(m: string, e?: Record<string, unknown>) { this.emit("debug", m, e); }
  info(m: string, e?: Record<string, unknown>) { this.emit("info", m, e); }
  warn(m: string, e?: Record<string, unknown>) { this.emit("warn", m, e); }
  error(m: string, e?: Record<string, unknown>) { this.emit("error", m, e); }
}
