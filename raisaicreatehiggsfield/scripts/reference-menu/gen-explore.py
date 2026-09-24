#!/usr/bin/env python3
"""Generate apps/web/src/features/explore/exploreData.ts from a dumped reference Explore page.

Inputs (all in <dumpDir>): explore-data.json, image-map.json, video-map.json, sec/15.html
Produced earlier in the session by the extraction + download scripts; the maps translate
remote media URLs to files under apps/web/public/explore.

Usage: python3 scripts/reference-menu/gen-explore.py <dumpDir>
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/web/src/features/explore/exploreData.ts"
D = Path(sys.argv[1])
data = json.load(open(D / "explore-data.json"))
imap = json.load(open(D / "image-map.json"))
vmap = json.load(open(D / "video-map.json"))


def rename(t):
    return re.sub(r"higgsfield", lambda m: "RAISAI" if m.group(0).isupper() else ("RaisAI" if m.group(0)[0].isupper() else "raisai"), t or "", flags=re.I)


def img(u):
    if not u:
        return None
    return imap.get(u) or imap.get(u.replace("&amp;", "&")) or None


def vid(u):
    return vmap.get(u) if u else None


def href(u):
    if not u:
        return "/"
    u = re.sub(r"^https?://higgsfield\.ai", "", u)
    m = re.match(r"^/ai/video\?model=([^&]+)", u)
    if m:
        return f"/create/video?model={m.group(1)}"
    m = re.match(r"^/ai/image\?model=([^&]+)", u)
    if m:
        return f"/create/image?model={m.group(1)}"
    table = {"/ai/video": "/create/video", "/ai/image": "/create/image", "/generate": "/movies", "/generate?mode=video": "/movies",
             "/canvas": "/workflows", "/canvas-intro": "/workflows", "/mcp": "/developer/mcp", "/supercomputer": "/workflows",
             "/nano-banana-pro": "/create/image?model=nano-banana-pro", "/upscale": "/create/studio/ai.upscale",
             "/pricing": "/pricing", "/community": "/templates?scope=public"}
    return table.get(u, u)


hero = [{"href": href(h["href"]), "title": rename(h["title"]), "desc": rename(h["desc"]), "img": img(h["img"]), "video": vid(h["video"])} for h in data["hero"]]
promo = {"poster": img(data["promo"]["poster"]), "video": vid(data["promo"]["video"])}
tiles = []
for t in data["tiles"]:
    icon = None
    if not t["logo"]:
        icon = "banana" if "Banana" in t["title"] else "academy"
    tiles.append({"href": href(t["href"]), "title": rename(t["title"]), "desc": rename(t["desc"]), "logo": img(t["logo"]), "icon": icon, "badge": t["badge"], "kind": t["kind"]})

g = data["genjutsu"]
genjutsu = {
    "title": rename(g["title"]), "subtitle": g["subtitle"],
    "buttons": [{"href": href(h), "label": l} for h, l in g["buttons"] if "View all" not in l],
    "viewAll": {"href": href(g["viewAll"][0][0]), "label": g["viewAll"][0][1]} if g["viewAll"] else None,
    "columns": [[{"img": img(a["img"]), "label": a["label"], "thumbs": [img(x) for x in a["thumbs"] if img(x)]} for a in col] for col in g["columns"]],
}

grids = []
for key in ["seedance25", "gptimage2", "marketing", "seedance20", "soulcinema", "soul2"]:
    s = data[key]
    grids.append({
        "id": s["id"], "title": rename(s["title"]), "href": s["href"], "subtitle": rename(s["subtitle"]),
        "viewAll": {"href": s["viewAll"]["href"], "label": rename(s["viewAll"]["label"])} if s["viewAll"] else None,
        "columns": [[{"aspect": round(c["aspect"], 4), "img": img(c["img"]), "video": vid(c["video"]), "prompt": re.sub(r"\s+", " ", c["prompt"])[:200], "author": rename(c["author"]), "avatar": img(c["avatar"]), "likes": c["likes"]} for c in col] for col in s["columns"]],
    })

# projects: names + covers from the ld+json block
sec15 = open(D / "sec/15.html").read()
ld = re.search(r'<script type="application/ld\+json">(\{"@context".*?"Explore the inside.*?\})</script>', sec15, re.S)
items = []
if ld:
    for it in json.loads(ld.group(1))["itemListElement"]:
        w = it["item"]
        cover = None
        for k, v in imap.items():
            if w["image"].split("/")[-1] in k:
                cover = v
                break
        items.append({"href": href(w["url"]), "name": w["name"], "author": rename(w["author"]["name"]), "img": cover})
projects = {"title": data["projects"]["title"], "subtitle": data["projects"]["subtitle"], "items": items,
            "viewAll": {"href": href(data["projects"]["viewAll"][0][0]), "label": data["projects"]["viewAll"][0][1]} if data["projects"]["viewAll"] else None}

explore_more = [{"href": href(h), "label": rename(l)} for h, l in data["exploreMore"]]
footer = [{"heading": s["heading"], "links": [{"href": href(h), "label": rename(l)} for h, l in s["links"]]} for s in data["footer"]]


def find_static(name):
    for k, v in imap.items():
        if name in k:
            return v
    return None


static = {
    "mcpBg": find_static("bg-mcp.png"), "spcBg": find_static("bg-spc-banner"), "spcLogo": find_static("spc-banner-logo"),
    "spcCreative": find_static("spc-banner-creative"), "spcVisualizing": find_static("spc-banner-visualiz"), "spcMarketing": find_static("spc-banner-marketin"),
    "spcProduction": find_static("spc-banner-producti"), "canvasBg": find_static("canvas-banner-bg-desktop"), "canvasArt": find_static("canvas-banner-desktop.webp") or find_static("canvas-banner-mobile.webp"),
    "canvasBgMobile": find_static("canvas-banner-bg-mobile"), "canvasArtMobile": find_static("canvas-banner-mobile.webp"),
    "photodumpDesktop": find_static("cta-desktop"), "photodumpMobile": find_static("cta-mobile"),
}

ts = json.dumps
out = f"""/**
 * Explore page content, generated from the reference Explore page by
 * scripts/reference-menu/gen-explore.py. Media paths point at files under
 * public/explore (downloaded copies; swap them for your own assets later).
 * Brand names in copy were changed from the reference to RaisAI; model names
 * are kept as-is.
 */
export interface HeroItem {{ href: string; title: string; desc: string; img: string | null; video: string | null }}
export interface Tile {{ href: string; title: string; desc: string; logo: string | null; icon: "banana" | "academy" | null; badge: string | null; kind: string | null }}
export interface PresetCard {{ img: string | null; label: string; thumbs: string[] }}
export interface GridCard {{ aspect: number; img: string | null; video: string | null; prompt: string; author: string; avatar: string | null; likes: string }}
export interface GridSection {{ id: string; title: string; href: string; subtitle: string; viewAll: {{ href: string; label: string }} | null; columns: GridCard[][] }}
export interface ProjectItem {{ href: string; name: string; author: string; img: string | null }}
export interface LinkItem {{ href: string; label: string }}

export const HERO: HeroItem[] = {ts(hero, ensure_ascii=False)};
export const PROMO = {ts(promo)};
export const TILES: Tile[] = {ts(tiles, ensure_ascii=False)};
export const GENJUTSU = {ts(genjutsu, ensure_ascii=False)};
export const GRIDS: GridSection[] = {ts(grids, ensure_ascii=False)};
export const PROJECTS = {ts(projects, ensure_ascii=False)};
export const EXPLORE_MORE: LinkItem[] = {ts(explore_more, ensure_ascii=False)};
export const FOOTER_COLUMNS: {{ heading: string; links: LinkItem[] }}[] = {ts(footer, ensure_ascii=False)};
export const STATIC = {ts(static)};
"""
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(out)
missing = [k for k, v in static.items() if not v]
print(f"wrote {OUT} hero={len(hero)} tiles={len(tiles)} grids={len(grids)} projects={len(items)} footer={len(footer)} missing static={missing}")
