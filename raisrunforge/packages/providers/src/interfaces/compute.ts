import type { Server, ServerMetricsSnapshot, ServiceRecord, ProviderKind } from "@runforge/shared";

export interface CreateServerInput {
  organizationId: string;
  name: string;
  region: string;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  os: string;
}

/**
 * ComputeProvider manages servers (VPS, bare metal, Proxmox VMs, cloud instances).
 * Implementations: DemoComputeProvider, SelfHostedProvider (via agent), HetznerProvider, ...
 */
export interface ComputeProvider {
  readonly kind: ProviderKind;
  listServers(organizationId: string): Promise<Server[]>;
  getServer(organizationId: string, id: string): Promise<Server | null>;
  createServer(input: CreateServerInput): Promise<Server>;
  deleteServer(organizationId: string, id: string): Promise<void>;
  getMetrics(organizationId: string, id: string): Promise<ServerMetricsSnapshot | null>;
  listServices(organizationId: string, serverId: string): Promise<ServiceRecord[]>;
  controlService(
    organizationId: string,
    serviceId: string,
    action: "start" | "stop" | "restart" | "enable" | "disable",
  ): Promise<ServiceRecord>;
  restartAgent(organizationId: string, serverId: string): Promise<void>;
}
