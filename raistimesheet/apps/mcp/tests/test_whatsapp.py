from rais_mcp.whatsapp import parse_whatsapp, activity_window
from rais_mcp.models import ToolResponse

SAMPLE = """04/09/2026, 09:15 - Rais: Need to check the API issue
04/09/2026, 09:40 - Rais: Found the problem
continued line
04/09/2026, 10:20 - PIC: Can you deploy the fix?
04/09/2026, 11:05 - Rais: Done, deployed to SIT
04/09/2026, 11:06 - Rais: <Media omitted>
04/09/2026, 11:08 - PIC added Aiman
"""


def test_parse_android_export():
    r = parse_whatsapp(SAMPLE)
    assert len(r["messages"]) == 6
    assert r["messages"][0]["timestamp"] == "2026-09-04T09:15:00+08:00"
    assert "continued line" in r["messages"][1]["message"]
    assert r["messages"][4]["is_attachment"] is True
    assert r["messages"][5]["is_system"] is True
    assert r["participants"] == ["PIC", "Rais"]


def test_us_format_and_ampm():
    r = parse_whatsapp("9/4/26, 2:05 PM - Rais: Afternoon\n9/13/26, 9:15 AM - Rais: Later")
    assert r["date_order"] == "MDY"
    assert r["messages"][0]["timestamp"].startswith("2026-09-04T14:05")


def test_activity_window():
    r = parse_whatsapp(SAMPLE)
    first, last, minutes = activity_window(r["messages"], "Rais")
    assert minutes == 111
    assert first.startswith("2026-09-04T09:15")


def test_tool_response_envelope():
    assert ToolResponse.ok({"a": 1}).model_dump() == {"success": True, "data": {"a": 1}, "warnings": [], "errors": []}
    assert ToolResponse.fail("boom").success is False
