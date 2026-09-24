import type * as T from "../types";
import { ServiceBase } from "./context";
import { nextActionForChange, overallProgress, activeStage, derivedStatus } from "../engines/changeLifecycle";
import { canActorDecide } from "../engines/approval";
import { ATTENTION_STATES } from "../engines/taskStateMachine";

export interface Dashboard {
  greeting: string; organization: T.Organization; user: T.User;
  nextAction: T.NextAction; nextActions: T.NextAction[];
  activeChanges: { id: string; key: string; title: string; progress: number; stage: string; pending?: string; status: T.ChangeStatus; risk: T.RiskLevel }[];
  myActions: { approvals: number; blockedTasks: number; uatTasks: number; escalatedTasks: number; blockedChanges: number };
  waitingForOthers: { label: string; detail: string; href: string }[];
  activeDeployments: T.Deployment[];
  agentHealth: { online: number; degraded: number; quarantined: number; pending: number; total: number };
  incidents: T.Incident[];
  metrics: { aiRequestsAvoided: number; selfHealed: number; deploymentsThisMonth: number; changesInFlight: number };
  roleView: "MANAGER" | "DEVELOPER" | "DEVOPS" | "QA" | "SECURITY";
  unreadNotifications: number;
  suggestions: { changeId: string; changeKey: string; message: string }[];
}

export class DashboardService extends ServiceBase {
  async get(ctx: T.RequestContext): Promise<Dashboard> {
    const org = this.assertOrg(ctx, await this.store.organizations.get(ctx.actor.organizationId));
    const user = (await this.store.users.get(ctx.actor.userId))!;
    const groupIds = (await this.store.memberships.get(ctx.actor.membershipId))?.groupIds ?? [];
    const [changesRaw, approvals, tasks, deployments, agents, incidents, users, notifications, runs] = await Promise.all([
      this.store.changes.list({ organizationId: org.id }), this.store.approvals.list({ organizationId: org.id }), this.store.tasks.list({ organizationId: org.id }), this.store.deployments.list({ organizationId: org.id }),
      this.store.agents.list({ organizationId: org.id }), this.store.incidents.list({ organizationId: org.id }), this.store.users.list(), this.store.notifications.list({ organizationId: org.id, userId: ctx.actor.userId }), this.store.aiRuns.list({ organizationId: org.id }),
    ]);
    const changes = changesRaw.map((c) => ({ ...c, status: derivedStatus(c, approvals) }));
    const userNames = Object.fromEntries(users.map((u) => [u.id, u.name]));
    const open = changes.filter((c) => c.status !== "COMPLETED" && c.status !== "CANCELLED");
    const severityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 };
    const actions = open.map((c) => nextActionForChange(c, approvals, ctx.actor, userNames)).sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
    const escalated = tasks.filter((t) => t.status === "ESCALATED");
    for (const t of escalated) actions.push({ severity: "HIGH", title: `Task escalated: ${t.name}`, description: t.summary ?? t.error ?? "Needs a human decision", taskId: t.id, risk: t.risk, actionLabel: "Review Task", href: `/tasks/${t.id}`, safe: true });
    const degraded = agents.filter((a) => a.status === "DEGRADED" || a.status === "PENDING_APPROVAL");
    for (const a of degraded) actions.push({ severity: "MEDIUM", title: a.status === "DEGRADED" ? `Agent degraded: ${a.name}` : `Agent awaiting approval: ${a.name}`, description: a.status === "DEGRADED" ? `Memory ${a.health.memory}%, latency ${a.health.latencyMs}ms` : "Review identity and capabilities before activating.", actionLabel: "View Agent", href: `/agents/${a.id}`, safe: true });
    actions.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
    const nextAction = actions[0] ?? { severity: "NONE" as const, title: "You're all caught up", description: "No pending actions. Start a new Change to get going.", actionLabel: "Start a Change", href: "/changes/new", safe: true };
    const myApprovals = approvals.filter((a) => a.status === "PENDING" && canActorDecide(a, ctx.actor, groupIds));
    const hour = new Date().getHours();
    const roleView: Dashboard["roleView"] = ctx.actor.roleKeys.includes("security_admin") ? "SECURITY" : ctx.actor.roleKeys.includes("qa") ? "QA" : ctx.actor.roleKeys.includes("devops") ? "DEVOPS" : ctx.actor.roleKeys.includes("developer") ? "DEVELOPER" : "MANAGER";
    const month = ctx.now().slice(0, 7);
    return {
      greeting: `Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, ${user.name.split(" ")[0]}`, organization: org, user,
      nextAction, nextActions: actions.slice(0, 6),
      activeChanges: open.filter((c) => c.ownerId === ctx.actor.userId || c.requestedById === ctx.actor.userId || roleView === "MANAGER" || roleView === "SECURITY").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5).map((c) => { const blocker = c.blockers.find((b) => !b.resolvedAt); const pending = approvals.find((a) => a.changeId === c.id && a.status === "PENDING"); return { id: c.id, key: c.key, title: c.title, progress: overallProgress(c), stage: activeStage(c)?.name ?? "—", pending: blocker?.missing[0] ?? (pending ? pending.title : undefined), status: c.status, risk: c.risk }; }),
      myActions: { approvals: myApprovals.length, blockedTasks: tasks.filter((t) => ATTENTION_STATES.includes(t.status) && t.requestedById === ctx.actor.userId).length, uatTasks: open.filter((c) => c.currentStageKey === "UAT").length, escalatedTasks: escalated.length, blockedChanges: open.filter((c) => c.status === "BLOCKED").length },
      waitingForOthers: [
        ...approvals.filter((a) => a.status === "PENDING" && !myApprovals.includes(a)).map((a) => ({ label: a.title, detail: `Waiting: ${a.slots.filter((s) => s.status === "PENDING").map((s) => s.approver.label).join(", ")}`, href: `/approvals/${a.id}` })),
        ...open.filter((c) => c.currentStageKey === "UAT" && c.ownerId !== ctx.actor.userId).map((c) => ({ label: `${c.key} UAT validation`, detail: `Owner: ${userNames[c.ownerId]}`, href: `/changes/${c.id}` })),
      ].slice(0, 5),
      activeDeployments: deployments.filter((d) => !["HEALTHY", "ROLLED_BACK", "FAILED"].includes(d.status) || (d.finishedAt && Date.now() - new Date(d.finishedAt).getTime() < 12 * 3600_000)).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 4),
      agentHealth: { online: agents.filter((a) => a.status === "ACTIVE").length, degraded: agents.filter((a) => a.status === "DEGRADED").length, quarantined: agents.filter((a) => a.status === "QUARANTINED").length, pending: agents.filter((a) => a.status === "PENDING_APPROVAL").length, total: agents.length },
      incidents: incidents.filter((i) => i.status !== "CLOSED" && i.status !== "RESOLVED").sort((a, b) => a.severity.localeCompare(b.severity)).slice(0, 4),
      metrics: { aiRequestsAvoided: runs.filter((r) => r.startTime.slice(0, 7) === month).reduce((a, r) => a + r.aiRequestsAvoided, 0), selfHealed: incidents.filter((i) => i.selfHealed).length + tasks.filter((t) => t.status === "COMPLETED" && t.recoveryCount > 0).length, deploymentsThisMonth: deployments.filter((d) => d.startedAt.slice(0, 7) === month).length, changesInFlight: open.length },
      roleView, unreadNotifications: notifications.filter((n) => !n.read).length,
      suggestions: changes.filter((c) => c.git.pullRequest?.state === "MERGED" && c.git.ciStatus === "PASSED" && c.jira.some((j) => j.status !== "Done" && j.type !== "Epic") && c.status !== "COMPLETED").map((c) => ({ changeId: c.id, changeKey: c.key, message: `${c.key} appears to have completed development. Update Jira?` })),
    };
  }
}
