import { registerAgent } from "./identity";
import { startHeartbeat } from "./heartbeat";
import { CommandExecutor } from "./command-policy";
import { UnixSocketDockerClient } from "./docker";

/**
 * Local development entrypoint for the RunForge Agent. Registers against the
 * local API (falling back to a simulated identity if it's not running),
 * then starts sending heartbeats. This is the process the install script
 * (`curl -fsSL https://install.runforge.dev | sh`) would run as a systemd
 * service in production.
 */
async function main() {
  const controlPlaneUrl = process.env.RUNFORGE_PUBLIC_URL ?? "http://localhost:8787";
  console.log(`[runforge-agent] registering with ${controlPlaneUrl}...`);

  const identity = await registerAgent(controlPlaneUrl, {
    enrollmentToken: process.env.RUNFORGE_AGENT_TOKEN ?? "dev-enrollment-token",
    hostname: process.env.HOSTNAME ?? "local-dev-machine",
    os: process.platform,
    cpuCores: navigator.hardwareConcurrency ?? 4,
    memoryMb: 8192,
    diskGb: 100,
  });
  console.log(`[runforge-agent] registered as ${identity.serverId}`);

  const executor = new CommandExecutor(new UnixSocketDockerClient(), identity.agentToken);
  void executor; // wired up once the control plane pushes commands over the outbound channel.

  const stop = startHeartbeat(identity, 10_000);
  console.log("[runforge-agent] heartbeat started (every 10s). Press Ctrl+C to stop.");

  process.on("SIGINT", () => { stop(); process.exit(0); });
}

main().catch((err) => {
  console.error("[runforge-agent] fatal error", err);
  process.exit(1);
});
