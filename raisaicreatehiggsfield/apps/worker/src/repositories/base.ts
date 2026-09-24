import type { Env } from "../env";
import type { PgDatabase } from "../db/client";

export abstract class BaseRepository {
  protected readonly db: PgDatabase;
  constructor(env: Pick<Env, "DB">) {
    this.db = env.DB;
  }
}
