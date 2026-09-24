import type { Database, ProviderKind } from "@runforge/shared";
import { newId, nowIso } from "@runforge/shared";
import type { CreateDatabaseInput, DatabaseHealth, DatabaseProvider } from "../interfaces";
import type { DemoWorld } from "./world";
import { wobble } from "./compute";

export class DemoDatabaseProvider implements DatabaseProvider {
  readonly kind: ProviderKind = "demo";
  constructor(private readonly world: DemoWorld) {}

  async listDatabases(organizationId: string): Promise<Database[]> {
    return this.world.databases.filter((d) => d.organizationId === organizationId).map((d) => this.live(d));
  }

  async getDatabase(organizationId: string, id: string): Promise<Database | null> {
    const d = this.world.databases.find((x) => x.id === id && x.organizationId === organizationId);
    return d ? this.live(d) : null;
  }

  async createDatabase(input: CreateDatabaseInput): Promise<Database> {
    const ts = nowIso();
    const defaults: Record<string, { version: string; port: number; max: number }> = {
      postgresql: { version: "17.2", port: 5432, max: 100 },
      mysql: { version: "8.4", port: 3306, max: 151 },
      sqlserver: { version: "2022", port: 1433, max: 32767 },
      sqlite: { version: "3.46", port: 0, max: 1 },
      redis: { version: "7.4", port: 6379, max: 10000 },
    };
    const d = defaults[input.engine];
    const db: Database = {
      id: newId("db"),
      organizationId: input.organizationId,
      projectId: input.projectId,
      serverId: input.serverId,
      name: input.name,
      engine: input.engine,
      version: input.version ?? d.version,
      status: "healthy",
      sizeBytes: 8 * 1024 ** 2,
      connections: 0,
      maxConnections: d.max,
      queriesPerSecond: 0,
      host: input.serverId ? "10.20.0.11" : "localhost",
      port: d.port,
      createdAt: ts,
      updatedAt: ts,
    };
    this.world.databases.push(db);
    return db;
  }

  async deleteDatabase(organizationId: string, id: string): Promise<void> {
    const idx = this.world.databases.findIndex((x) => x.id === id && x.organizationId === organizationId);
    if (idx < 0) throw new Error(`Database ${id} not found`);
    this.world.databases.splice(idx, 1);
  }

  async getHealth(organizationId: string, id: string): Promise<DatabaseHealth> {
    const db = await this.getDatabase(organizationId, id);
    if (!db) throw new Error(`Database ${id} not found`);
    return {
      status: db.status,
      connections: db.connections,
      maxConnections: db.maxConnections,
      queriesPerSecond: db.queriesPerSecond,
      slowQueries: db.status === "degraded" ? 14 : 1,
      sizeBytes: db.sizeBytes,
      replicationLagMs: db.engine === "postgresql" ? 0 : undefined,
      lastCheckAt: new Date(this.world.now()).toISOString(),
    };
  }

  async runQuery(organizationId: string, id: string, sql: string) {
    const db = await this.getDatabase(organizationId, id);
    if (!db) throw new Error(`Database ${id} not found`);
    const lower = sql.trim().toLowerCase();
    if (!lower.startsWith("select") && !lower.startsWith("show") && !lower.startsWith("explain")) {
      throw new Error("Demo Provider only simulates read-only queries");
    }
    return {
      columns: ["table_name", "row_estimate", "size"],
      rows: [
        ["orders", 1_204_512, "3.1 GB"],
        ["customers", 88_210, "410 MB"],
        ["invoices", 402_118, "1.2 GB"],
        ["audit_log", 5_120_004, "2.9 GB"],
      ],
      durationMs: 12,
      simulated: true,
    };
  }

  private live(d: Database): Database {
    const now = this.world.now();
    const degraded = d.status === "degraded";
    return {
      ...d,
      connections: Math.min(d.maxConnections, Math.round(wobble(`${d.id}:conn`, d.connections, degraded ? 2 : 6, now))),
      queriesPerSecond: Math.round(wobble(`${d.id}:qps`, d.queriesPerSecond, d.queriesPerSecond * 0.15, now)),
    };
  }
}
