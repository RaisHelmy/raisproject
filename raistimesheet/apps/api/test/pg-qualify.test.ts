import { describe, expect, it } from "vitest";
import { qualifySql } from "../src/db/pg-adapter";

describe("qualifySql", () => {
  it("qualifies every table reference form used by the repositories", () => {
    expect(qualifySql("SELECT t.*, p.code FROM timesheets t JOIN projects p ON p.id = t.project_id LEFT JOIN timesheet_jira_links l ON l.timesheet_id = t.id WHERE t.status = ?"))
      .toBe("SELECT t.*, p.code FROM raistimesheet.timesheets t JOIN raistimesheet.projects p ON p.id = t.project_id LEFT JOIN raistimesheet.timesheet_jira_links l ON l.timesheet_id = t.id WHERE t.status = ?");
    expect(qualifySql("INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET email = excluded.email")).toBe("INSERT INTO raistimesheet.users (id, email) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET email = excluded.email");
    expect(qualifySql("UPDATE timesheets SET status = ? WHERE id = ?")).toBe("UPDATE raistimesheet.timesheets SET status = ? WHERE id = ?");
    expect(qualifySql("DELETE FROM timesheet_jira_links WHERE timesheet_id = ?")).toBe("DELETE FROM raistimesheet.timesheet_jira_links WHERE timesheet_id = ?");
    expect(qualifySql("SELECT count(*) AS c FROM jira_issues\n  WHERE project_key IN (?, ?)")).toBe("SELECT count(*) AS c FROM raistimesheet.jira_issues\n  WHERE project_key IN (?, ?)");
  });
  it("leaves non-table words, columns and already-qualified names alone", () => {
    expect(qualifySql("SELECT 1")).toBe("SELECT 1");
    expect(qualifySql("SELECT * FROM raistimesheet.users")).toBe("SELECT * FROM raistimesheet.users");
    expect(qualifySql("SELECT u.roles, x.settings FROM users u")).toBe("SELECT u.roles, x.settings FROM raistimesheet.users u");
    expect(qualifySql("SELECT * FROM users_archive")).toBe("SELECT * FROM users_archive");
  });
});
