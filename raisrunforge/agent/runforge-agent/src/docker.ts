/**
 * Docker abstraction (spec §12/§21). Wraps the Docker Engine API (via the
 * local UNIX socket) so ContainerProvider-compatible adapters can list,
 * start, stop and restart containers without the control plane ever
 * executing raw shell commands on the host.
 */
export interface DockerContainerSummary {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

export interface DockerClient {
  listContainers(): Promise<DockerContainerSummary[]>;
  startContainer(id: string): Promise<void>;
  stopContainer(id: string): Promise<void>;
  restartContainer(id: string): Promise<void>;
}

/** Talks to the Docker Engine API over its UNIX socket at /var/run/docker.sock. */
export class UnixSocketDockerClient implements DockerClient {
  constructor(private readonly socketPath = "/var/run/docker.sock") {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    // Bun supports `unix` socket fetch via the `unix` option (Bun-specific extension).
    return fetch(`http://localhost${path}`, { ...init, unix: this.socketPath } as RequestInit & { unix: string });
  }

  async listContainers(): Promise<DockerContainerSummary[]> {
    const res = await this.request("/containers/json?all=true");
    const raw = (await res.json()) as Array<{ Id: string; Names: string[]; Image: string; State: string; Status: string }>;
    return raw.map((c) => ({ id: c.Id, name: c.Names[0]?.replace(/^\//, "") ?? c.Id, image: c.Image, state: c.State, status: c.Status }));
  }

  async startContainer(id: string): Promise<void> {
    await this.request(`/containers/${id}/start`, { method: "POST" });
  }
  async stopContainer(id: string): Promise<void> {
    await this.request(`/containers/${id}/stop`, { method: "POST" });
  }
  async restartContainer(id: string): Promise<void> {
    await this.request(`/containers/${id}/restart`, { method: "POST" });
  }
}
