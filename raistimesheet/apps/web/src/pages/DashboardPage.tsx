import { Link, useOutletContext } from "react-router-dom";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import type { DashboardDTO } from "@rais/shared-types";
import type { ApiState } from "@/hooks/useApi";
import { Card, EmptyState, ErrorAlert, Spinner, StatCard } from "@/components/ui";
import { formatMinutes, humanize } from "@/services/format";
import { useAuth } from "@/services/auth";

const PALETTE = ["#1f4e79", "#2b8a3e", "#f59e0b", "#dc2626", "#6366f1", "#0ea5e9", "#64748b"];
const base: Highcharts.Options = { credits: { enabled: false }, title: { text: undefined }, chart: { height: 260, style: { fontFamily: "inherit" } }, colors: PALETTE, legend: { itemStyle: { fontSize: "12px" } }, accessibility: { enabled: true } };

function greeting() { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }

export default function DashboardPage() {
  const { dashboard } = useOutletContext<{ dashboard: ApiState<DashboardDTO> }>();
  const { isApprover } = useAuth();
  const d = dashboard.data;
  if (dashboard.error && !d) return <ErrorAlert error={dashboard.error} onRetry={dashboard.reload} />;
  if (!d) return <Spinner label="Loading your dashboard…" />;
  const k = d.kpis;

  return (
    <div>
      <div className="mb-4">
        <h1 className="h3 mb-1">{greeting()}, {d.greeting_name}</h1>
        <p className="text-secondary mb-0">{d.attention.length ? "Here's what needs your attention." : "You're all caught up."}</p>
      </div>

      <div className="row g-3 mb-4">
        {isApprover ? <div className="col-6 col-xl-3"><StatCard label="Pending approval" value={k.pending_approval} hint={formatMinutes(k.pending_hours_minutes)} to="/approvals" tone={k.pending_approval ? "warning" : "default"} icon="inbox" /></div>
          : <div className="col-6 col-xl-3"><StatCard label="Awaiting approval" value={k.pending_approval} hint={formatMinutes(k.pending_hours_minutes)} to="/timesheets/submitted" icon="send" /></div>}
        <div className="col-6 col-xl-3"><StatCard label="Jira pending" value={k.jira_pending} hint={k.jira_pending ? "approved work not in Jira" : "all approved work linked"} to="/jira/reconciliation" tone={k.jira_pending ? "warning" : "success"} icon="arrow-repeat" /></div>
        <div className="col-6 col-xl-3"><StatCard label="Delayed tasks" value={k.delayed_tasks} hint={k.delayed_tasks ? "past their Jira due date" : "nothing overdue"} to="/jira/tasks?filter=delayed" tone={k.delayed_tasks ? "danger" : "success"} icon="hourglass-split" /></div>
        <div className="col-6 col-xl-3"><StatCard label="Hours this month" value={formatMinutes(k.hours_this_month_minutes)} hint="your recorded work" to="/timesheets" icon="clock" /></div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-7">
          <Card title={<><i className="bi bi-flag me-2 text-warning" />Requires your attention</>}>
            {d.attention.length === 0 ? <EmptyState title="You're all caught up." body="No timesheets, Jira tasks or imports need action right now." /> : (
              <div className="attention-list">
                {d.attention.map((a) => (
                  <div key={a.key} className={`attention-item attention-${a.severity}`}>
                    <div className="d-flex align-items-center gap-3"><span className="attention-dot" /><span>{a.title}</span></div>
                    <Link to={a.link} className="btn btn-sm btn-outline-primary">{a.action_label}</Link>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
        <div className="col-lg-5">
          <Card title="Jira synchronisation">
            {d.all_synced ? <EmptyState icon="cloud-check" title="All approved work is synchronised." body="No approved timesheets are waiting to be pushed to Jira." /> : (
              <HighchartsReact highcharts={Highcharts} options={{ ...base, chart: { ...base.chart, type: "pie", height: 240 }, tooltip: { pointFormat: "<b>{point.y}</b> timesheets" }, plotOptions: { pie: { innerSize: "60%", dataLabels: { enabled: true, format: "{point.name}: {point.y}", style: { fontSize: "11px" } } } }, series: [{ type: "pie", name: "Approved work", data: d.charts.jira_sync_status.map((s) => ({ name: humanize(s.status === "NOT_LINKED" ? "No Jira" : s.status), y: s.count, color: s.status === "SYNCED" || s.status === "LINKED" ? "#2b8a3e" : s.status === "SYNC_FAILED" ? "#dc2626" : "#f59e0b" })) }] } satisfies Highcharts.Options} />
            )}
          </Card>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <Card title="Work hours by day (this month)">
            {d.charts.hours_by_day.length === 0 ? <div className="text-secondary py-4 text-center">No work recorded this month yet.</div> : (
              <HighchartsReact highcharts={Highcharts} options={{ ...base, chart: { ...base.chart, type: "column" }, xAxis: { categories: d.charts.hours_by_day.map((x) => x.date.slice(8, 10) + "/" + x.date.slice(5, 7)), title: { text: undefined } }, yAxis: { title: { text: "Hours" }, allowDecimals: false }, tooltip: { formatter() { return `<b>${this.x}</b><br/>${formatMinutes((this.y ?? 0) * 60)}`; } }, legend: { enabled: false }, series: [{ type: "column", name: "Hours", data: d.charts.hours_by_day.map((x) => Math.round((x.minutes / 60) * 100) / 100), color: "#1f4e79" }] } satisfies Highcharts.Options} />
            )}
          </Card>
        </div>
        <div className="col-lg-5">
          <Card title="Work hours by project (this month)">
            {d.charts.hours_by_project.length === 0 ? <div className="text-secondary py-4 text-center">No work recorded this month yet.</div> : (
              <HighchartsReact highcharts={Highcharts} options={{ ...base, chart: { ...base.chart, type: "bar" }, xAxis: { categories: d.charts.hours_by_project.map((x) => x.project) }, yAxis: { title: { text: "Hours" } }, legend: { enabled: false }, tooltip: { formatter() { return `<b>${this.x}</b><br/>${formatMinutes((this.y ?? 0) * 60)}`; } }, series: [{ type: "bar", name: "Hours", data: d.charts.hours_by_project.map((x) => Math.round((x.minutes / 60) * 100) / 100), color: "#2b6cb0" }] } satisfies Highcharts.Options} />
            )}
          </Card>
        </div>
        <div className="col-lg-5">
          <Card title="Task status (this month)">
            {d.charts.task_status.length === 0 ? <div className="text-secondary py-4 text-center">No timesheets this month.</div> : (
              <HighchartsReact highcharts={Highcharts} options={{ ...base, chart: { ...base.chart, type: "pie", height: 240 }, plotOptions: { pie: { innerSize: "55%", dataLabels: { enabled: true, format: "{point.name}: {point.y}", style: { fontSize: "11px" } } } }, series: [{ type: "pie", name: "Timesheets", data: d.charts.task_status.map((s) => ({ name: humanize(s.status), y: s.count, color: s.status === "APPROVED" ? "#2b8a3e" : s.status === "SUBMITTED" ? "#1f4e79" : s.status === "REJECTED" ? "#dc2626" : "#94a3b8" })) }] } satisfies Highcharts.Options} />
            )}
          </Card>
        </div>
        <div className="col-lg-7">
          <Card title="Delayed tasks" actions={<Link to="/jira/tasks?filter=delayed" className="btn btn-sm btn-outline-secondary">View all</Link>}>
            {d.charts.delayed_tasks.length === 0 ? <EmptyState icon="check2-circle" title="No delayed tasks." body="Every task with a due date is on time." /> : (
              <HighchartsReact highcharts={Highcharts} options={{ ...base, chart: { ...base.chart, type: "bar", height: Math.max(180, 40 * d.charts.delayed_tasks.length + 60) }, xAxis: { categories: d.charts.delayed_tasks.map((x) => x.key) }, yAxis: { title: { text: "Days late" }, allowDecimals: false }, legend: { enabled: false }, tooltip: { formatter() { const t = d.charts.delayed_tasks[this.index]; return `<b>${t?.key}</b> ${t?.summary}<br/>${this.y} day(s) late`; } }, series: [{ type: "bar", name: "Days late", data: d.charts.delayed_tasks.map((x) => x.days), color: "#dc2626" }] } satisfies Highcharts.Options} />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
