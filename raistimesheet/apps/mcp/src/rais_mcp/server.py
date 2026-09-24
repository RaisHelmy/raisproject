"""Rais Timesheet MCP server (FastMCP, stdio).

Tools mirror the product workflow: import → analyse → review → timesheet → approval → Jira → reports.
All responses are structured `ToolResponse` envelopes. Nothing here bypasses the Worker's
authorisation, audit or human-in-the-loop rules — the MCP simply acts as the signed-in user.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import os
from datetime import date
from pathlib import Path
from typing import Any

import structlog
from mcp.server.fastmcp import FastMCP

from .client import ApiError, RaisClient
from .models import ToolResponse
from .whatsapp import parse_whatsapp

structlog.configure(processors=[structlog.processors.add_log_level, structlog.processors.TimeStamper(fmt="iso"), structlog.processors.JSONRenderer()], wrapper_class=structlog.make_filtering_bound_logger(logging.INFO))
log = structlog.get_logger("rais_mcp")

mcp = FastMCP("rais-timesheet", instructions="Turns WhatsApp work history into approved, auditable timesheets and keeps Jira synchronised. Always show the user inferred values and confidence before creating anything; never create Jira issues without explicit confirmation.")
_client: RaisClient | None = None


def client() -> RaisClient:
    global _client
    if _client is None:
        _client = RaisClient()
    return _client


def _run(coro):
    async def wrapper():
        try:
            data, warnings = await coro
            return ToolResponse.ok(data, warnings).model_dump()
        except ApiError as e:
            msg = f"{e.message}" + (f" (reference {e.reference})" if e.reference else "")
            log.warning("api_error", code=e.code, status=e.status)
            return ToolResponse.fail(f"{e.code}: {msg}").model_dump()
        except Exception as e:  # noqa: BLE001 — surface as structured error
            log.error("tool_error", error=str(e))
            return ToolResponse.fail(f"UNEXPECTED: {e}").model_dump()

    return wrapper()


# ---------------- Import ----------------

@mcp.tool()
async def parse_whatsapp_export(text: str | None = None, path: str | None = None, timezone: str = "Asia/Kuala_Lumpur") -> dict:
    """Parse a WhatsApp export locally (no upload). Provide the export `text` or a file `path`. Returns normalised messages and participants."""
    if path:
        text = Path(path).read_text(encoding="utf-8", errors="replace")
    if not text:
        return ToolResponse.fail("Provide `text` or `path`.").model_dump()
    r = parse_whatsapp(text, tz=timezone)
    return ToolResponse.ok({"message_count": len(r["messages"]), "participants": r["participants"], "date_order": r["date_order"], "messages": r["messages"][:500]}, r["warnings"] + (["Only the first 500 messages are returned inline."] if len(r["messages"]) > 500 else [])).model_dump()


@mcp.tool()
async def analyse_conversation(project_id: str, path: str | None = None, text: str | None = None, filename: str = "whatsapp-export.txt", wait_seconds: int = 60) -> dict:
    """Upload a WhatsApp export to Rais Timesheet and run the AI analysis. Returns the import id, status and extracted work items (with provenance) once ready."""
    async def go():
        content = Path(path).read_bytes() if path else (text or "").encode("utf-8")
        if not content:
            raise ApiError("VALIDATION_ERROR", "Provide `path` or `text`.", 400)
        imp, warnings = await client().request("POST", "/imports", files={"file": (filename, content, "text/plain")}, data={"project_id": project_id})
        import_id = imp["id"]
        for _ in range(max(1, wait_seconds // 2)):
            await asyncio.sleep(2)
            detail, _ = await client().get(f"/imports/{import_id}")
            if detail["import"]["status"] in ("READY_FOR_REVIEW", "COMPLETED", "FAILED"):
                break
        detail, _ = await client().get(f"/imports/{import_id}")
        items, _ = await client().get(f"/imports/{import_id}/tasks")
        return {"import": detail["import"], "analysis": detail["analysis"], "work_items": items}, warnings
    return await _run(go())


@mcp.tool()
async def extract_work_items(import_id: str) -> dict:
    """List the AI-extracted work items of an import, each with value/source/confidence/reason per field and message evidence."""
    return await _run(client().get(f"/imports/{import_id}/tasks"))


@mcp.tool()
async def list_imports(page: int = 1) -> dict:
    """List WhatsApp imports and their pipeline status."""
    return await _run(client().get("/imports", page=page))


# ---------------- Timesheet ----------------

@mcp.tool()
async def create_timesheet_draft(work_item_id: str | None = None, project_id: str | None = None, work_date: str | None = None, title: str | None = None, description: str = "", duration_minutes: int | None = None, start_time: str | None = None, end_time: str | None = None, work_status: str = "COMPLETED") -> dict:
    """Create a DRAFT timesheet: either accept an AI work item (`work_item_id`, with optional overrides) or create manually (project_id, work_date, title, duration)."""
    async def go():
        if work_item_id:
            overrides = {k: v for k, v in {"title": title, "description": description or None, "work_date": work_date, "duration_minutes": duration_minutes, "start_time": start_time, "end_time": end_time}.items() if v is not None}
            return await client().post(f"/imports/work-items/{work_item_id}/accept", json=overrides)
        if not (project_id and work_date and title):
            raise ApiError("VALIDATION_ERROR", "project_id, work_date and title are required for a manual draft.", 400)
        return await client().post("/timesheets", json={"project_id": project_id, "work_date": work_date, "title": title, "description": description, "duration_minutes": duration_minutes, "start_time": start_time, "end_time": end_time, "work_status": work_status})
    return await _run(go())


@mcp.tool()
async def list_timesheets(status: str | None = None, date_from: str | None = None, date_to: str | None = None, project_id: str | None = None, search: str | None = None, scope: str = "mine", page: int = 1) -> dict:
    """List timesheets. status: DRAFT|SUBMITTED|APPROVED|REJECTED (comma-separated allowed). scope=all for approvers. Includes a summary (count, minutes)."""
    return await _run(client().get("/timesheets", status=status, date_from=date_from, date_to=date_to, project_id=project_id, q=search, scope=scope, page=page, page_size=50))


@mcp.tool()
async def get_timesheet(timesheet_id: str) -> dict:
    """Full timesheet detail: work summary, time, AI analysis, source messages, Jira link, approval history and audit trail."""
    return await _run(client().get(f"/timesheets/{timesheet_id}"))


@mcp.tool()
async def update_timesheet(timesheet_id: str, title: str | None = None, description: str | None = None, work_date: str | None = None, duration_minutes: int | None = None, start_time: str | None = None, end_time: str | None = None, work_status: str | None = None, reason: str | None = None) -> dict:
    """Update a timesheet. Approved records require an approver and a `reason` (audited)."""
    patch = {k: v for k, v in {"title": title, "description": description, "work_date": work_date, "duration_minutes": duration_minutes, "start_time": start_time, "end_time": end_time, "work_status": work_status, "reason": reason}.items() if v is not None}
    return await _run(client().patch(f"/timesheets/{timesheet_id}", patch))


@mcp.tool()
async def submit_timesheet(timesheet_ids: list[str]) -> dict:
    """Submit one or more drafts for approval."""
    return await _run(client().post("/timesheets/bulk", json={"action": "submit", "ids": timesheet_ids}))


@mcp.tool()
async def approve_timesheet(timesheet_ids: list[str]) -> dict:
    """Approve submitted timesheets (approver role). Starts Jira reconciliation automatically."""
    return await _run(client().post("/timesheets/bulk", json={"action": "approve", "ids": timesheet_ids}))


@mcp.tool()
async def reject_timesheet(timesheet_ids: list[str], reason: str) -> dict:
    """Reject submitted timesheets with a reason (approver role)."""
    return await _run(client().post("/timesheets/bulk", json={"action": "reject", "ids": timesheet_ids, "reason": reason}))


@mcp.tool()
async def timesheets_waiting_for_approval() -> dict:
    """Timesheets awaiting approval (approver view), with totals."""
    return await _run(client().get("/timesheets", scope="all", status="SUBMITTED", page_size=100))


# ---------------- Jira ----------------

@mcp.tool()
async def search_jira(query: str | None = None, filter: str = "mine", project_key: str | None = None) -> dict:
    """Search cached Jira issues for the user's projects. filter: all|mine|open|completed|delayed|due_soon|missing_timesheet."""
    return await _run(client().get("/jira/issues", q=query, filter=filter, project_key=project_key, page_size=100))


@mcp.tool()
async def get_jira_issue(issue_key: str, refresh: bool = False) -> dict:
    """Get a Jira issue with delay assessment and linked timesheets."""
    return await _run(client().get(f"/jira/issues/{issue_key}", refresh=1 if refresh else None))


@mcp.tool()
async def sync_jira() -> dict:
    """Refresh the Jira issue cache and reconcile approved timesheets."""
    return await _run(client().post("/jira/sync"))


@mcp.tool()
async def match_timesheet_to_jira(timesheet_id: str) -> dict:
    """Run reconciliation for one approved timesheet and return match candidates."""
    return await _run(client().post(f"/jira/timesheets/{timesheet_id}/reconcile"))


@mcp.tool()
async def find_missing_jira_tasks() -> dict:
    """Approved timesheets that are not linked to any Jira task (ready to create) plus suggested matches needing review."""
    return await _run(client().get("/jira/reconciliation", view="needs_action", page_size=100))


@mcp.tool()
async def link_timesheet_to_jira(timesheet_id: str, issue_key: str) -> dict:
    """Link an approved timesheet to an existing Jira issue (adds a traceability comment)."""
    return await _run(client().post(f"/jira/timesheets/{timesheet_id}/link", json={"issue_key": issue_key, "match_type": "MANUAL"}))


@mcp.tool()
async def preview_jira_issue(timesheet_id: str) -> dict:
    """Show what would be created in Jira for a timesheet, including potential duplicates. Call before push_timesheet_to_jira."""
    return await _run(client().get(f"/jira/timesheets/{timesheet_id}/create-preview"))


@mcp.tool()
async def push_timesheet_to_jira(timesheet_id: str, confirm: bool = False, force_despite_duplicates: bool = False, summary: str | None = None, assignee_account_id: str | None = None) -> dict:
    """Create a Jira issue for an approved timesheet. Requires confirm=true (human confirmation). Idempotent. Refuses when duplicates exist unless force_despite_duplicates=true."""
    if not confirm:
        return ToolResponse.fail("Jira issue creation requires explicit confirmation: call again with confirm=true after showing the preview to the user.").model_dump()
    body: dict[str, Any] = {"force": force_despite_duplicates}
    if summary:
        body["summary"] = summary
    if assignee_account_id is not None:
        body["assignee_account_id"] = assignee_account_id
    return await _run(client().post(f"/jira/timesheets/{timesheet_id}/create", json=body))


@mcp.tool()
async def create_jira_issues_for_missing_work(timesheet_ids: list[str], confirm: bool = False) -> dict:
    """Bulk-create Jira issues for approved timesheets with no Jira task. Requires confirm=true. Possible duplicates are skipped for individual review."""
    if not confirm:
        return ToolResponse.fail("Bulk creation requires confirm=true after the user has reviewed the list.").model_dump()
    return await _run(client().post("/jira/create", json={"timesheet_ids": timesheet_ids}))


@mcp.tool()
async def retry_jira_sync(timesheet_id: str) -> dict:
    """Retry a failed Jira synchronisation."""
    return await _run(client().post(f"/jira/timesheets/{timesheet_id}/retry"))


@mcp.tool()
async def jira_sync_errors() -> dict:
    """Open Jira synchronisation errors with references."""
    return await _run(client().get("/jira/errors", page_size=100))


# ---------------- Reports ----------------

@mcp.tool()
async def get_dashboard_summary() -> dict:
    """Dashboard KPIs and the list of items needing attention."""
    return await _run(client().get("/dashboard"))


@mcp.tool()
async def report_preview(report_type: str = "TIMESHEET_SUMMARY", date_from: str | None = None, date_to: str | None = None, project_id: str | None = None, client_id: str | None = None) -> dict:
    """Preview report figures (entries, hours, delayed, Jira pending) for a period. Defaults to the current month."""
    f, t = _default_period(date_from, date_to)
    return await _run(client().get("/reports/preview", type=report_type, date_from=f, date_to=t, project_id=project_id, client_id=client_id))


@mcp.tool()
async def generate_timesheet_report(report_type: str = "TIMESHEET_SUMMARY", format: str = "PDF", date_from: str | None = None, date_to: str | None = None, project_id: str | None = None, client_id: str | None = None, save_to: str | None = None) -> dict:
    """Generate a professional PDF or XLSX report. report_type: TIMESHEET_SUMMARY|DETAILED_TIMESHEET|JIRA_RECONCILIATION|DELAYED_TASKS|PROJECT_WORKLOAD. Optionally save to `save_to` path; otherwise returns base64 content."""
    async def go():
        f, t = _default_period(date_from, date_to)
        job, warnings = await client().post("/reports", json={"type": report_type, "format": format.upper(), "date_from": f, "date_to": t, "project_id": project_id, "client_id": client_id})
        content = await client().download(f"/reports/{job['id']}/download")
        if save_to:
            Path(save_to).write_bytes(content)
            return {"report": job, "saved_to": save_to, "bytes": len(content)}, warnings
        return {"report": job, "content_base64": base64.b64encode(content).decode("ascii"), "bytes": len(content)}, warnings
    return await _run(go())


@mcp.tool()
async def generate_jira_report(date_from: str | None = None, date_to: str | None = None, project_id: str | None = None, format: str = "XLSX", save_to: str | None = None) -> dict:
    """Jira reconciliation report (approved work vs Jira)."""
    return await generate_timesheet_report("JIRA_RECONCILIATION", format, date_from, date_to, project_id, None, save_to)


@mcp.tool()
async def generate_productivity_report(date_from: str | None = None, date_to: str | None = None, format: str = "PDF", save_to: str | None = None) -> dict:
    """Project workload / productivity report (tasks, hours, completion rate per project)."""
    return await generate_timesheet_report("PROJECT_WORKLOAD", format, date_from, date_to, None, None, save_to)


@mcp.tool()
async def what_did_i_work_on(date_from: str | None = None, date_to: str | None = None, project_id: str | None = None) -> dict:
    """Natural-language helper: summarise the user's timesheets for a period (hours, per-day and per-project totals, entries)."""
    async def go():
        f, t = _default_period(date_from, date_to)
        data, warnings = await client().get("/timesheets", date_from=f, date_to=t, project_id=project_id, page_size=200, sort="work_date", dir="asc")
        by_day: dict[str, int] = {}
        by_project: dict[str, int] = {}
        for x in data["items"]:
            by_day[x["work_date"]] = by_day.get(x["work_date"], 0) + x["duration_minutes"]
            by_project[x["project_code"]] = by_project.get(x["project_code"], 0) + x["duration_minutes"]
        return {"period": {"from": f, "to": t}, "total_minutes": data["summary"]["minutes"], "entries": data["summary"]["count"], "by_day": by_day, "by_project": by_project, "items": [{"date": x["work_date"], "title": x["title"], "minutes": x["duration_minutes"], "status": x["status"], "jira": x["jira_issue_key"]} for x in data["items"]]}, warnings
    return await _run(go())


@mcp.tool()
async def list_projects() -> dict:
    """Projects the user can record work against (id, code, client, Jira key)."""
    return await _run(client().get("/projects"))


def _default_period(date_from: str | None, date_to: str | None) -> tuple[str, str]:
    today = date.today()
    f = date_from or today.replace(day=1).isoformat()
    if date_to:
        t = date_to
    else:
        nxt = (today.replace(day=28) + __import__("datetime").timedelta(days=4)).replace(day=1)
        t = (nxt - __import__("datetime").timedelta(days=1)).isoformat()
    return f, t


def main() -> None:
    transport = os.environ.get("RAIS_MCP_TRANSPORT", "stdio")
    log.info("rais_mcp_starting", transport=transport, api=os.environ.get("RAIS_API_URL", "http://localhost:8787"))
    mcp.run(transport=transport)  # type: ignore[arg-type]


if __name__ == "__main__":
    main()
