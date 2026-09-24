"""Local WhatsApp export parser (mirrors the Worker parser) for offline `parse_whatsapp`."""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from .models import ParsedMessage

LINE_RE = re.compile(
    r"^‎?\[?(\d{1,4})[/.\-](\d{1,2})[/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap]\.?[Mm]\.?)?\]?\s*(?:-\s*)?(.*)$"
)
SYSTEM = [
    re.compile(p, re.I)
    for p in [
        r"messages and calls are end-to-end encrypted", r"created group", r"added you", r"\badded\b.*\bto the group", r"\bleft$",
        r"changed the subject", r"changed this group's icon", r"changed the group description", r"joined using this group's invite link",
        r"security code changed", r"you're now an admin", r"removed\s", r"pinned a message", r"missed voice call", r"missed video call",
    ]
]
ATTACHMENT = [re.compile(p, re.I) for p in [r"<media omitted>", r"\(file attached\)", r"<attached:.*>", r"image omitted", r"video omitted", r"audio omitted", r"document omitted", r"sticker omitted", r"gif omitted"]]
DELETED = [re.compile(p, re.I) for p in [r"this message was deleted", r"you deleted this message", r"message deleted"]]


def parse_whatsapp(text: str, tz: str = "Asia/Kuala_Lumpur", date_order: str = "auto") -> dict:
    """Parse a WhatsApp export into normalised messages. Returns dict with messages, participants, warnings."""
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    raw: list[tuple[list, list[str]]] = []
    skipped = 0
    for line in lines:
        m = LINE_RE.match(line.lstrip("﻿"))
        if m:
            a, b, c = int(m.group(1)), int(m.group(2)), int(m.group(3))
            iso = a > 31
            year = a if iso else (c + 2000 if c < 100 else c)
            d1, d2 = (b, c) if iso else (a, b)
            raw.append(([d1, d2, year, int(m.group(4)), int(m.group(5)), int(m.group(6) or 0), m.group(7), m.group(8) or ""], []))
        elif raw:
            raw[-1][1].append(line)
        elif line.strip():
            skipped += 1

    warnings: list[str] = []
    order = date_order if date_order in ("DMY", "MDY") else "DMY"
    if date_order == "auto":
        first_over = any(r[0][0] > 12 for r in raw)
        second_over = any(r[0][1] > 12 for r in raw)
        if second_over and not first_over:
            order = "MDY"
        elif not first_over and raw:
            warnings.append("Date order was ambiguous; interpreted as day/month/year.")

    zone = ZoneInfo(tz)
    messages: list[ParsedMessage] = []
    participants: set[str] = set()
    for seq, (parts, extra) in enumerate(raw):
        d1, d2, year, h, mi, s, ampm, rest = parts
        day, month = (d1, d2) if order == "DMY" else (d2, d1)
        if ampm:
            pm = "p" in ampm.lower()
            if pm and h < 12:
                h += 12
            if not pm and h == 12:
                h = 0
        try:
            ts = datetime(year, month, day, h, mi, s, tzinfo=zone)
        except ValueError:
            continue
        body = "\n".join([rest, *extra]).replace("‎", "").rstrip()
        idx = body.find(": ")
        sender, message = ("", body)
        if 0 < idx < 80 and not body.lower().startswith("http"):
            sender, message = body[:idx].strip(), body[idx + 2 :]
        is_system = sender == "" or any(p.search(message) for p in SYSTEM)
        is_attachment = any(p.search(message) for p in ATTACHMENT)
        is_deleted = any(p.search(message) for p in DELETED)
        if not is_system and sender:
            participants.add(sender)
        messages.append(ParsedMessage(seq=seq, timestamp=ts.isoformat(), sender=sender or "System", message=message.strip(), is_system=is_system, is_attachment=is_attachment, is_deleted=is_deleted))
    return {"messages": [m.model_dump() for m in messages], "participants": sorted(participants), "date_order": order, "skipped_lines": skipped, "warnings": warnings}


def activity_window(messages: list[dict], sender: str) -> tuple[str | None, str | None, int]:
    """Return (first, last, minutes) for a sender's messages."""
    ts = [datetime.fromisoformat(m["timestamp"]) for m in messages if m["sender"] == sender]
    if not ts:
        return None, None, 0
    first, last = min(ts), max(ts)
    return first.isoformat(), last.isoformat(), int((last - first) / timedelta(minutes=1))


UTC = timezone.utc
