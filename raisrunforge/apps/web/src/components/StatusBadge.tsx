const LABELS: Record<string, string> = {
  healthy: "Healthy", degraded: "Degraded", failed: "Failed", building: "Building",
  deploying: "Deploying", starting: "Starting", stopped: "Stopped", offline: "Offline",
  unknown: "Unknown", online: "Online", active: "Active", running: "Running",
  queued: "Queued", cloning: "Cloning", packaging: "Packaging", health_checking: "Health Checking",
  switching_traffic: "Switching Traffic", completed: "Completed", cancelled: "Cancelled",
  rolled_back: "Rolled Back", paused: "Paused", exited: "Exited", restarting: "Restarting",
  inactive: "Inactive", provisioning: "Provisioning", pending: "Pending", error: "Error",
  verified: "Verified", open: "Open", investigating: "Investigating", mitigated: "Mitigated",
  resolved: "Resolved", connected: "Connected", disconnected: "Disconnected", none: "None",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`rf-badge rf-badge-${status}`}>
      <span className="dot" />
      {label ?? LABELS[status] ?? status}
    </span>
  );
}
