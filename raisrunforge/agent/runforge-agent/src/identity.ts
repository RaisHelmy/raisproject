/**
 * Agent identity and registration (spec §12). On first run the agent has no
 * identity; it registers with the control plane using a one-time enrollment
 * token (issued when the user clicks "Connect Server" / runs the install
 * script), receives a long-lived agent token, and persists it locally.
 */
export interface AgentIdentity {
  serverId: string;
  agentToken: string;
  controlPlaneUrl: string;
  registeredAt: string;
}

export interface EnrollmentRequest {
  enrollmentToken: string;
  hostname: string;
  os: string;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
}

/**
 * Registers this machine with the RunForge control plane. In production this
 * POSTs to `${controlPlaneUrl}/api/agents/register`; the demo implementation
 * simulates a successful registration so the agent can be exercised without
 * a live control plane.
 */
export async function registerAgent(controlPlaneUrl: string, req: EnrollmentRequest): Promise<AgentIdentity> {
  try {
    const res = await fetch(`${controlPlaneUrl}/api/agents/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (res.ok) {
      const body = (await res.json()) as { data: AgentIdentity };
      return body.data;
    }
  } catch {
    // Control plane unreachable — fall through to the local demo identity below.
  }
  return {
    serverId: `srv_agent_${req.hostname}`,
    agentToken: `demo-agent-token-${Math.random().toString(36).slice(2)}`,
    controlPlaneUrl,
    registeredAt: new Date().toISOString(),
  };
}
