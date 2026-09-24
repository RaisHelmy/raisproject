import type { Database, DatabaseEngine, ProviderKind } from "@runforge/shared";

export interface CreateDatabaseInput {
  organizationId: string;
  projectId: string;
  serverId?: string;
  name: string;
  engine: DatabaseEngine;
  version?: string;
}

export interface DatabaseHealth {
  status: Database["status"];
  connections: number;
  maxConnections: number;
  queriesPerSecond: number;
  slowQueries: number;
  sizeBytes: number;
  replicationLagMs?: number;
  lastCheckAt: string;
}

export interface DatabaseProvider {
  readonly kind: ProviderKind;
  listDatabases(organizationId: string): Promise<Database[]>;
  getDatabase(organizationId: string, id: string): Promise<Database | null>;
  createDatabase(input: CreateDatabaseInput): Promise<Database>;
  deleteDatabase(organizationId: string, id: string): Promise<void>;
  getHealth(organizationId: string, id: string): Promise<DatabaseHealth>;
  runQuery(
    organizationId: string,
    id: string,
    sql: string,
  ): Promise<{ columns: string[]; rows: unknown[][]; durationMs: number; simulated: boolean }>;
}
