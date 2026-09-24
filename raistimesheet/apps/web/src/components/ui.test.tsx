import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConfidenceBadge, ConfirmModal, DataTable, EmptyState, SourceBadge, StatusBadge, type Column } from "./ui";
import { formatMinutes, dateShortcut } from "@/services/format";

describe("status and confidence badges", () => {
  it("always renders a text label (never colour alone)", () => {
    render(<><StatusBadge value="MATCH_SUGGESTED" /><StatusBadge value="SYNC_FAILED" /><StatusBadge value="APPROVED" /></>);
    expect(screen.getByText("Match suggested")).toBeInTheDocument();
    expect(screen.getByText("Sync failed")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });
  it("buckets confidence into High / Medium / Low with the percentage", () => {
    render(<><ConfidenceBadge value={0.86} /><ConfidenceBadge value={0.6} /><ConfidenceBadge value={0.3} /></>);
    expect(screen.getByText("High · 86%")).toBeInTheDocument();
    expect(screen.getByText("Medium · 60%")).toBeInTheDocument();
    expect(screen.getByText("Low · 30%")).toBeInTheDocument();
  });
  it("labels AI provenance", () => {
    render(<><SourceBadge source="explicit" /><SourceBadge source="inferred" /><SourceBadge source="assumed" /></>);
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Inferred")).toBeInTheDocument();
    expect(screen.getByText("Assumed")).toBeInTheDocument();
  });
});

describe("DataTable", () => {
  const cols: Column<{ id: string; title: string }>[] = [{ key: "t", header: "Task", render: (r) => r.title, priority: 1 }];
  it("renders rows in a table and as cards, supports selection", () => {
    const onToggle = vi.fn();
    render(<MemoryRouter><DataTable columns={cols} rows={[{ id: "1", title: "Fix API" }, { id: "2", title: "Deploy" }]} keyOf={(r) => r.id} selectable selected={new Set()} onToggle={onToggle} onToggleAll={() => undefined} /></MemoryRouter>);
    expect(screen.getAllByText("Fix API").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByLabelText("Select row")[0]!);
    expect(onToggle).toHaveBeenCalledWith("1");
  });
  it("shows an empty state when there are no rows", () => {
    render(<MemoryRouter><DataTable columns={cols} rows={[]} keyOf={(r) => r.id} empty={<EmptyState title="You're all caught up." />} /></MemoryRouter>);
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });
});

describe("ConfirmModal", () => {
  it("requires a reason before rejecting", () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal open title="Reject" body="Why?" confirmLabel="Reject" requireReason onConfirm={onConfirm} onClose={() => undefined} />);
    const btn = screen.getByRole("button", { name: "Reject" });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Please split the tasks" } });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledWith("Please split the tasks");
  });
});

describe("formatting helpers", () => {
  it("formats minutes as hours and minutes", () => {
    expect(formatMinutes(135)).toBe("2h 15m");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(null)).toBe("—");
  });
  it("computes date shortcuts as ranges", () => {
    const m = dateShortcut("this_month");
    expect(m.from.endsWith("-01")).toBe(true);
    expect(m.from <= m.to).toBe(true);
    const w = dateShortcut("last_week");
    expect(w.from < w.to).toBe(true);
  });
});
