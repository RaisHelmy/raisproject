#!/usr/bin/env python3
"""Regenerate apps/web/src/app/header/menuIcons.ts and the *_SECTIONS in menuData.ts
from dumped reference dropdown panels.

Usage:
  1. From raisdownloadscreenshotautomate:  bun run ../raisaicreatehiggsfield/scripts/reference-menu/dump-panels.ts <dumpDir>
  2. From raisaicreatehiggsfield:          python3 scripts/reference-menu/gen-menu.py <dumpDir>

The dump dir must contain create-image-tab.html, create-video-tab.html, audio-tab.html, plugins.html.
Only the generated sections block of menuData.ts is rewritten; HEADER_ITEMS and helpers are kept.
"""
import html as H
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HEADER_DIR = ROOT / "apps/web/src/app/header"
dump = Path(sys.argv[1])

BADGE_RE = re.compile(r'<span class="absolute -top-3 left-1/2 -translate-x-1/2"><p class="([^"]*)">\s*(\w+)\s*</p></span>', re.S)


def badge_color(boxcls: str, pcls: str) -> str:
    if "border-surface-brand-secondary-alpha-1" in boxcls or "bg-font-brand-secondary" in pcls:
        return "secondary"
    if "border-[#3CD8FF]" in boxcls or "rgb(50,89,180)" in pcls:
        return "seedance"
    return "primary"


def rename(t: str) -> str:
    return t.replace("Higgsfield", "RaisAI")


def map_href(tab: str, title: str, href: str) -> str:
    """Point reference URLs at our screens where one exists; unknown paths hit the placeholder page."""
    if tab == "image":
        if title == "Create Image":
            return "/create/image"
        if title == "Photodump":
            return "/create/image?model=soul-v2&photodump=true"
        if href == "/canvas":
            return "/workflows"
        if href.startswith("/layers"):
            return "/create/studio/ai.inpaint"
        if href == "/upscale":
            return "/create/studio/ai.upscale"
        m = re.match(r"/ai/image\?model=([^&]+)$", href)
        return f"/create/image?model={m.group(1)}" if m else href
    if tab == "video":
        if href == "/ai/video":
            return "/create/video"
        if href == "/generate?mode=video":
            return "/movies"
        if href == "/canvas":
            return "/workflows"
        if href == "/ai/video/motion":
            return "/create/studio/ai.motion"
        if href == "/upscale":
            return "/create/studio/ai.video.upscale"
        m = re.match(r"/ai/video\?model=([^&]+)$", href)
        return f"/create/video?model={m.group(1)}" if m else href
    if tab == "audio":
        if href == "/audio?voiceMode=voiceover":
            return "/create/audio"
        if href == "/audio?voiceMode=change-voice":
            return "/create/audio?mode=change-voice"
        if href == "/audio?voiceMode=translate":
            return "/create/audio?mode=translate"
        m = re.match(r"/audio\?voiceMode=voiceover&audioModel=([^&]+)$", href)
        return f"/create/audio?model={m.group(1)}" if m else href
    return href


icons: dict[str, str] = {}
tabs: dict[str, list] = {}
for tab, f in [("image", "create-image-tab.html"), ("video", "create-video-tab.html"), ("audio", "audio-tab.html"), ("plugins", "plugins.html")]:
    h = (dump / f).read_text()
    sections = []
    for s in re.split(r'<div class="min-w-\[18rem\][^"]*">', h)[1:]:
        heading = re.search(r'<p class="px-2 text-sm text-font-secondary">(.*?)</p>', s).group(1)
        items = []
        for a in re.finditer(r"<a ([^>]*)>(.*?)</a>", s, re.S):
            attrs, body = a.group(1), a.group(2)
            href = H.unescape(re.search(r'href="([^"]*)"', attrs).group(1))
            box = re.search(r'<div class="(relative grid size-12[^"]*)">(.*?)</div>\s*<div class="grid auto-rows-min', body, re.S)
            boxcls, iconhtml = box.group(1), box.group(2).strip()
            title = H.unescape(re.search(r'<p class="text-caption-l[^"]*">(.*?)</p>', body, re.S).group(1).strip())
            sub = H.unescape(re.search(r'<p class="text-sm text-font-secondary">(.*?)</p>', body, re.S).group(1).strip())
            badge = None
            bm = BADGE_RE.search(iconhtml)
            if bm:
                badge = {"label": bm.group(2).upper(), "color": badge_color(boxcls, bm.group(1))}
                iconhtml = iconhtml.replace(bm.group(0), "").strip()
            tm = re.match(r"^<span[^>]*>(\w+)</span>$", iconhtml)
            if tm:
                iconhtml = f'<span class="hfnav-entry-glyph">{tm.group(1)}</span>'
            iconhtml = re.sub(r"\s+", " ", H.unescape(iconhtml).replace("&amp;", "&"))
            key = f"{tab}/{title}"
            icons[key] = iconhtml
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
            items.append({"id": f"{tab}-{slug}", "title": rename(title), "subtitle": rename(sub), "href": map_href(tab, title, href), "icon": key, "badge": badge})
        sections.append({"id": f"{tab}-{heading.lower()}", "heading": heading, "items": items})
    tabs[tab] = sections

with open(HEADER_DIR / "menuIcons.ts", "w") as f:
    f.write('// Generated from the reference dropdown panels. Keys are "<tab>/<title>".\n')
    f.write("// Inline SVG markup rendered by MenuEntryIcon; edit with care, or regenerate.\n")
    f.write("export const MENU_ICONS: Record<string, string> = {\n")
    for k, v in icons.items():
        f.write(f"  {json.dumps(k)}: {json.dumps(v)},\n")
    f.write("};\n")

data_path = HEADER_DIR / "menuData.ts"
src = data_path.read_text()
start = src.index("export const IMAGE_SECTIONS")
end = src.index("export const HEADER_ITEMS")
block = "".join(f"export const {t.upper()}_SECTIONS: MenuSection[] = {json.dumps(tabs[t], ensure_ascii=False)};\n\n" for t in ["image", "video", "audio", "plugins"])
data_path.write_text(src[:start] + block + src[end:])
print(f"wrote {len(icons)} icons; sections: " + ", ".join(f"{t}={sum(len(s['items']) for s in tabs[t])}" for t in tabs))
print("now run: bunx prettier --write apps/web/src/app/header/menuData.ts")
