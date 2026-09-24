/** Structured JSON logging with correlation ids. Never log secrets or full conversations. */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  request_id?: string;
  import_id?: string;
  timesheet_id?: string;
  sync_job_id?: string;
  jira_issue_key?: string;
  user_id?: string;
  [k: string]: unknown;
}

export class Logger {
  constructor(private readonly ctx: LogContext = {}) {}

  child(extra: LogContext): Logger {
    return new Logger({ ...this.ctx, ...extra });
  }

  private emit(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...this.ctx, ...redact(extra) });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  debug(msg: string, extra?: Record<string, unknown>) { this.emit("debug", msg, extra); }
  info(msg: string, extra?: Record<string, unknown>) { this.emit("info", msg, extra); }
  warn(msg: string, extra?: Record<string, unknown>) { this.emit("warn", msg, extra); }
  error(msg: string, extra?: Record<string, unknown>) { this.emit("error", msg, extra); }
}

const SENSITIVE = /token|secret|password|authorization|api_key|apikey|cookie/i;

function redact(obj?: Record<string, unknown>): Record<string, unknown> {
  if (!obj) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE.test(k)) out[k] = "[redacted]";
    else if (v instanceof Error) out[k] = { name: v.name, message: v.message };
    else out[k] = v;
  }
  return out;
}
