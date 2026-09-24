import type { DnsRecord, Domain, Port, ProviderKind, Route, Tunnel } from "@runforge/shared";

export interface CreateDomainInput {
  organizationId: string;
  projectId?: string;
  name: string;
  applicationId?: string;
  provider?: Domain["provider"];
}

export interface CreateRouteInput {
  organizationId: string;
  domain: string;
  path?: string;
  applicationId: string;
  internalPort: number;
  protocol?: Route["protocol"];
  websocket?: boolean;
  healthPath?: string;
  proxy?: Route["proxy"];
  viaTunnel?: boolean;
}

export interface NetworkProvider {
  readonly kind: ProviderKind;
  listDomains(organizationId: string): Promise<Domain[]>;
  createDomain(input: CreateDomainInput): Promise<Domain>;
  deleteDomain(organizationId: string, id: string): Promise<void>;
  listDnsRecords(organizationId: string, domainId?: string): Promise<DnsRecord[]>;
  listRoutes(organizationId: string): Promise<Route[]>;
  createRoute(input: CreateRouteInput): Promise<Route>;
  deleteRoute(organizationId: string, id: string): Promise<void>;
  listPorts(organizationId: string, serverId?: string): Promise<Port[]>;
  setPortExposure(organizationId: string, id: string, exposure: Port["exposure"]): Promise<Port>;
  listTunnels(organizationId: string): Promise<Tunnel[]>;
}
