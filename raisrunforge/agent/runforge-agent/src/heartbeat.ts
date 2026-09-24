import type { AgentIdentity } from "./identity";
import { collectMetrics } from "./metrics";

/**
 * Sends periodic heartbeats with live metrics (spec §12: "Server metrics").
 * The control plane uses missed heartbeats to mark a server offline and open
 * an incident (spec §40).
 */
export function startHeartbeat(identity: AgentIdentity, intervalMs = 10_000): () => void {
  const send = async () => {
    const metrics = await collectMetrics();
    try {
      await fetch(`${identity.controlPlaneUrl}/api/agents/${identity.serverId}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${identity.agentToken}` },
        body: JSON.stringify(metrics),
      });
    } catch (err) {
      console.warn(`[runforge-agent] heartbeat failed: ${(err as Error).message}`);
    }
  };
  const id = setInterval(send, intervalMs);
  send();
  return () => clearInterval(id);
}
