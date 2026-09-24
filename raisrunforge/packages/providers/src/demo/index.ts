export * from "./world";
export * from "./seed";
export * from "./compute";
export * from "./application";
export * from "./container";
export * from "./git";
export * from "./database";
export * from "./network";
export * from "./observability";

import type { ProviderSet } from "../registry";
import { ProviderRegistry } from "../registry";
import { DemoWorld } from "./world";
import { createDemoWorld } from "./seed";
import { DemoComputeProvider } from "./compute";
import { DemoApplicationProvider } from "./application";
import { DemoContainerProvider } from "./container";
import { DemoGitProvider } from "./git";
import { DemoDatabaseProvider } from "./database";
import { DemoNetworkProvider } from "./network";
import { DemoLogProvider, DemoMetricsProvider } from "./observability";

export function createDemoProviderSet(world: DemoWorld): ProviderSet {
  return {
    compute: new DemoComputeProvider(world),
    application: new DemoApplicationProvider(world),
    container: new DemoContainerProvider(world),
    git: new DemoGitProvider(world),
    database: new DemoDatabaseProvider(world),
    network: new DemoNetworkProvider(world),
    logs: new DemoLogProvider(world),
    metrics: new DemoMetricsProvider(world),
  };
}

export function createDemoRegistry(world: DemoWorld = createDemoWorld()): ProviderRegistry {
  const set = createDemoProviderSet(world);
  const registry = new ProviderRegistry(set);
  registry.register("demo", set);
  return registry;
}
