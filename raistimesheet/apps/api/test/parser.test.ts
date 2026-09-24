import { describe, expect, it } from "vitest";
import { parseWhatsApp } from "../src/services/whatsapp/parser";

const ANDROID = `04/09/2026, 09:15 - Rais: Need to check the API issue
04/09/2026, 09:40 - Rais: Found the problem
this continues on a second line
04/09/2026, 10:20 - PIC: Can you deploy the fix?
04/09/2026, 11:05 - Rais: Done, deployed to SIT
04/09/2026, 11:06 - Rais: <Media omitted>
04/09/2026, 11:07 - Rais: This message was deleted
04/09/2026, 11:08 - PIC added Aiman`;

const IOS = `[04/09/2026, 09:15:22] Rais: Need to check the API issue
[04/09/2026, 10:20:01] PIC: Can you deploy the fix?`;

const US = `9/4/26, 9:15 AM - Rais: Morning check
9/4/26, 2:05 PM - Rais: Afternoon deploy
9/13/26, 9:15 AM - Rais: Later`;

describe("WhatsApp parser", () => {
  it("parses Android exports with multiline, attachments, deleted and system lines", () => {
    const r = parseWhatsApp(ANDROID, { timezone: "Asia/Kuala_Lumpur" });
    expect(r.messages.length).toBe(7);
    expect(r.messages[0]).toMatchObject({ sender: "Rais", message: "Need to check the API issue", is_system: false });
    expect(r.messages[0]!.timestamp).toBe("2026-09-04T09:15:00+08:00");
    expect(r.messages[1]!.message).toContain("second line");
    expect(r.messages[4]!.is_attachment).toBe(true);
    expect(r.messages[5]!.is_deleted).toBe(true);
    expect(r.messages[6]!.is_system).toBe(true);
    expect(r.participants.sort()).toEqual(["PIC", "Rais"]);
    expect(r.date_order).toBe("DMY");
  });

  it("parses iOS bracket format with seconds", () => {
    const r = parseWhatsApp(IOS);
    expect(r.messages.length).toBe(2);
    expect(r.messages[0]!.timestamp).toBe("2026-09-04T09:15:22+08:00");
    expect(r.messages[1]!.sender).toBe("PIC");
  });

  it("detects US month/day order and 12h clock", () => {
    const r = parseWhatsApp(US);
    expect(r.date_order).toBe("MDY");
    expect(r.messages[1]!.timestamp).toBe("2026-09-04T14:05:00+08:00");
    expect(r.messages[2]!.timestamp.startsWith("2026-09-13")).toBe(true);
  });

  it("returns nothing for unrelated text", () => {
    const r = parseWhatsApp("hello world\nthis is not a chat");
    expect(r.messages.length).toBe(0);
    expect(r.skipped_lines).toBe(2);
  });
});
