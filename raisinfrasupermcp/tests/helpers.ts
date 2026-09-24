import { createMemoryStore } from "../src/domain/repository/memory";
import { seedDemo, DEMO } from "../src/domain/seed/demo";
import { createSuperMcp, resolveActor, makeContext } from "../src/domain/services";
import type { RequestContext } from "../src/domain/types";

export async function setup() {
  const store = createMemoryStore();
  await seedDemo(store);
  const app = createSuperMcp(store);
  const ctxFor = async (userId: string, orgId = DEMO.orgId, mode: RequestContext["executionMode"] = "HUMAN") => makeContext(await resolveActor(store, userId, orgId), mode);
  return { store, app, ctxFor, ahmad: await ctxFor(DEMO.users.ahmad), sarah: await ctxFor(DEMO.users.sarah), daniel: await ctxFor(DEMO.users.daniel) };
}
export { DEMO };
