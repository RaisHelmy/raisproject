import type { ProviderKind } from "@runforge/shared";
import type {
  ApplicationProvider,
  ComputeProvider,
  ContainerProvider,
  DatabaseProvider,
  GitProvider,
  LogProvider,
  MetricsProvider,
  NetworkProvider,
} from "./interfaces";

export interface ProviderSet {
  compute: ComputeProvider;
  application: ApplicationProvider;
  container: ContainerProvider;
  git: GitProvider;
  database: DatabaseProvider;
  network: NetworkProvider;
  logs: LogProvider;
  metrics: MetricsProvider;
}

/**
 * The ProviderRegistry is how the domain layer reaches infrastructure without
 * knowing whether it is talking to the Demo Provider, Docker via the agent,
 * Cloud Run or Cloudflare. Resources carry a `provider` kind; the registry
 * resolves the adapter. Unknown kinds fall back to the default set.
 */
export class ProviderRegistry {
  private readonly sets = new Map<ProviderKind, Partial<ProviderSet>>();

  constructor(private readonly defaults: ProviderSet) {}

  register(kind: ProviderKind, set: Partial<ProviderSet>): void {
    this.sets.set(kind, set);
  }

  resolve(kind?: ProviderKind): ProviderSet {
    if (!kind) return this.defaults;
    const overrides = this.sets.get(kind);
    return overrides ? { ...this.defaults, ...overrides } : this.defaults;
  }

  compute(kind?: ProviderKind): ComputeProvider {
    return this.resolve(kind).compute;
  }
  application(kind?: ProviderKind): ApplicationProvider {
    return this.resolve(kind).application;
  }
  container(kind?: ProviderKind): ContainerProvider {
    return this.resolve(kind).container;
  }
  git(kind?: ProviderKind): GitProvider {
    return this.resolve(kind).git;
  }
  database(kind?: ProviderKind): DatabaseProvider {
    return this.resolve(kind).database;
  }
  network(kind?: ProviderKind): NetworkProvider {
    return this.resolve(kind).network;
  }
  logs(kind?: ProviderKind): LogProvider {
    return this.resolve(kind).logs;
  }
  metrics(kind?: ProviderKind): MetricsProvider {
    return this.resolve(kind).metrics;
  }
}
