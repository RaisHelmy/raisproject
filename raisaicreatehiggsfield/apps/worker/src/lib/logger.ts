export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  requestId?: string;
  userId?: string;
  orgId?: string;
  workflowRunId?: string;
  nodeRunId?: string;
  generationId?: string;
  [k: string]: unknown;
}

export class Logger {
  constructor(private readonly base: LogFields = {}) {}
  child(fields: LogFields): Logger {
    return new Logger({ ...this.base, ...fields });
  }
  log(level: LogLevel, event: string, fields: LogFields = {}): void {
    const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...this.base, ...fields });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }
  debug(event: string, f?: LogFields) { this.log("debug", event, f); }
  info(event: string, f?: LogFields) { this.log("info", event, f); }
  warn(event: string, f?: LogFields) { this.log("warn", event, f); }
  error(event: string, f?: LogFields) { this.log("error", event, f); }
}
