import type { LogEntry, LogQuery, MetricQuery, MetricSeries, ProviderKind } from "@runforge/shared";

export interface LogProvider {
  readonly kind: ProviderKind;
  query(organizationId: string, query: LogQuery): Promise<LogEntry[]>;
  /** Append a log line produced by a control-plane operation (deploy, restart...). */
  append(entry: Omit<LogEntry, "id">): Promise<LogEntry>;
  listServices(organizationId: string): Promise<string[]>;
}

export interface MetricsProvider {
  readonly kind: ProviderKind;
  query(organizationId: string, query: MetricQuery): Promise<MetricSeries[]>;
}
