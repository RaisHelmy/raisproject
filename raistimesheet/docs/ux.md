# UX

## Principles

1. **Automate the boring work, ask only about exceptions.** The dashboard and Jira Sync Center lead with "requires your attention"; successful items are summarised in one line.
2. **Every screen answers**: Where am I? (breadcrumb + title) · What is happening? (status badges, workflow steps) · What needs my attention? (attention list, KPI tones) · What should I do next? (primary action top-right, empty states with actions).
3. **No AI black box.** Every AI value shows *Confirmed / Inferred / Assumed / Unknown*, a confidence, and a "Why?" with the reasoning. Evidence messages are highlighted in the source conversation. Users can accept, edit, split, merge or ignore.
4. **Human control.** AI never creates official records; Jira issues are created only after a confirmation dialog that shows exactly what will be created and flags potential duplicates.
5. **Progressive disclosure.** Simple values first; reasoning, descriptions and audit diffs behind "Why?" / details.
6. **Text + colour, never colour alone.** Status badges always carry a label; icons carry `aria-hidden`; focus rings are visible; forms have labels; tables become cards on small screens.

## Information architecture (two levels)

```
Dashboard
My Work         My Timesheets · Drafts · Submitted · Approved · Rejected
Import Work     WhatsApp Import · Import History
Approvals       Pending Approval · Approval History            (approvers)
Jira            Sync Center · My Jira Tasks · Reconciliation · Ready to Sync · Synced · Sync Errors
Reports         Report Center (builder, preview, history, print view)
Settings        Profile · Jira Connection · Projects (admin) · Administration (users, settings, audit, health)
```

Global: search (timesheet id, title, description, Jira key, project, date, file), notification centre (deep links), demo-mode banner, user menu, onboarding (6 steps).

## Screens

| Screen | Highlights |
|---|---|
| Login | Demo accounts listed for evaluation |
| Dashboard | Greeting, 4 KPIs, attention list, Jira sync donut, hours by day / by project, task status, delayed tasks (Highcharts) |
| WhatsApp Import | Project selector, drag-and-drop, export instructions, what-the-assistant-does, workflow steps |
| Import Detail | Live progress ("Messages processed 842 / 1,203 · Tasks detected 17"), participants and roles, warnings |
| AI Review | Two-pane: conversation (evidence highlighted, day separators) ↔ work items (fields with source badges, assumptions panel, Jira suggestion, Accept / Edit & accept / Split / Ignore, merge selection, Accept-all) |
| Timesheet list | Date · Task · Project · Duration · Status · Approval · Jira · Confidence · Actions; filters; bulk submit; responsive cards |
| Timesheet detail | Work summary · Time (backdated flag) · AI analysis · Source conversation · Jira · Approval history · Audit trail (before/after diffs) |
| Pending Approval | Totals (entries, hours, projects), select-all, bulk approve/reject with a confirmation that states totals, projects, date range and people; reject requires reason |
| Jira Sync Center | Approved · Already linked · Needs review · Ready to create · Sync errors; exception list; "Everything is synchronised" empty state |
| Reconciliation | Per row: timesheet ↔ match (confidence + reason) with Link / Create new / Other… / Ignore / Retry; bulk create with confirmation |
| Create Jira task dialog | Defaults (project, type, summary, description, effort, assignee), duplicate warning with *Use existing* / *Create anyway*, DEMO notice |
| Sync Errors | Reference, error code, retries, Retry |
| Jira Tasks | Filters My/Open/Completed/Delayed/Due soon/Missing timesheet; delay column with days |
| Report Center | Type cards, period shortcuts (Today … Quarter, Custom), filters, live preview (period, entries, hours, projects, delayed, Jira pending), Generate PDF / Export Excel / Print view, recent reports |
| Print view | Report header, KPI tiles, sections with repeated table headers, footer; print CSS hides chrome, landscape A4 |
| Admin | Users & roles, retention settings, demo controls, integration status, audit log with before/after, health matrix |

## Design system

Bootstrap 5 with a small token layer (`apps/web/src/styles/app.css`): navy primary `#1f4e79`, calm grey background, 10 px radius cards, uppercase muted labels, consistent status palette (draft grey · submitted navy · approved/synced green · rejected/failed red · warning amber · info blue). No gradients beyond the login backdrop, no animation beyond spinners/progress. Microcopy uses plain verbs: "Analyse conversation", "Sync now", "No Jira task found".
