import type { Id } from "./ids";

export interface Domain {
  id: Id;
  organizationId: Id;
  projectId?: Id;
  name: string;
  applicationId?: Id;
  provider: "cloudflare" | "manual";
  ssl: "active" | "pending" | "expired" | "none";
  sslExpiresAt?: string;
  status: "active" | "pending" | "error";
  createdAt: string;
  updatedAt: string;
}

export interface DnsRecord {
  id: Id;
  organizationId: Id;
  domainId: Id;
  zone: string;
  type: "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "SRV";
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Route {
  id: Id;
  organizationId: Id;
  domainId?: Id;
  domain: string;
  path: string;
  applicationId: Id;
  applicationName: string;
  serverId?: Id;
  internalPort: number;
  protocol: "http" | "https";
  websocket: boolean;
  healthPath?: string;
  proxy: "nginx" | "caddy" | "cloudflare" | "docker";
  viaTunnel: boolean;
  status: "active" | "pending" | "error";
  createdAt: string;
  updatedAt: string;
}

export interface Port {
  id: Id;
  organizationId: Id;
  serverId: Id;
  port: number;
  protocol: "tcp" | "udp";
  service: string;
  containerId?: Id;
  exposure: "internal" | "public" | "restricted";
  status: "active" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface Tunnel {
  id: Id;
  organizationId: Id;
  serverId: Id;
  name: string;
  status: "healthy" | "degraded" | "down" | "inactive";
  connectors: number;
  ingress: Array<{ hostname: string; service: string }>;
  createdAt: string;
  updatedAt: string;
}

/** Nodes/edges of the infrastructure dependency graph (spec §47). */
export interface GraphNode {
  id: string;
  type:
    | "domain"
    | "cloudflare"
    | "tunnel"
    | "server"
    | "proxy"
    | "container"
    | "application"
    | "database"
    | "storage"
    | "cache";
  label: string;
  sublabel?: string;
  status?: string;
  /** Client route to open when clicked. */
  href?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

export interface InfrastructureGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
