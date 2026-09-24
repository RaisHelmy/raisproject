# Esri — Lead Software Developer Interview Prep

*Tailored to your background: 6+ yrs C#/.NET Core/EF Core, Angular, SQL Server & Oracle, Clean Architecture + CQRS/MediatR, and real production Esri ArcGIS experience from PDRM C4i (see [Interview.md](Interview.md#L73)).*

---

## 1. The Job Is Integration, Not Building Esri's Product

This is the framing to hold onto: you are **not** contributing to ArcGIS's own codebase (you're not writing WPF internals for ArcGIS Pro or shipping features inside ArcGIS Enterprise). The Lead Dev role is about **taking Esri's platform as a given, packaged tool and wiring it into a client's existing application** — same posture as integrating Stripe, Auth0, or SAP: you consume their SDKs/APIs, you don't modify their internals. This matches exactly what you already did at PDRM: the C4i backend was your code, ArcGIS was the mapping surface you fed data into.

The pieces of Esri you'll actually touch as an integrator:

- **ArcGIS Maps SDK for JavaScript** (npm package `@arcgis/core`) — the front-end library you embed in the client's existing web app (Angular, in your case) to render a map and draw the client's data on it.
- **ArcGIS REST API / Feature Services** — the HTTP interface for reading/writing geospatial data hosted on Esri's platform, if the architecture calls for publishing data *into* ArcGIS rather than just rendering your own.
- **ArcGIS GeoEvent Server** — a managed real-time ingestion service (streaming feeds like GPS pings → live map layers). Relevant as a "would we let Esri own this instead of our own consumer" option — **you already built the DIY version of this at PDRM** (queue → custom consumer → map).
- **Geodatabases** — spatial data living in the client's own SQL Server/Oracle (spatial column types), which ArcGIS can connect to directly or which you sync from — this is the part closest to your existing DB work.

You're not expected to know Esri's product internals. You're expected to know: *given a client's existing app and data, how do I get their data onto a map and keep it in sync, using Esri's SDKs as building blocks.*

**Action item:** skim the ArcGIS Maps SDK for JavaScript "get started" page (5 min) — enough to recognize the API shape (`Map`, `MapView`, `GraphicsLayer`) referenced below. Nothing deeper is needed.

---

## 2. What "Lead" Changes About the Bar

| Signal | What they're watching for |
|---|---|
| Communication while coding | Narrate approach before typing; check edge cases out loud |
| Design judgment | Pick a reasonable approach fast; discuss trade-offs explicitly |
| Code quality under pressure | Small functions, clear names — your Clean Architecture instincts |
| Ownership language | "I'd test X", "I'd flag this to the team", "here's how this scales" |
| Mentoring signal | Explain reasoning as if teaching, not just solving |

---

## 3. Core DSA Refresh (Physical/Whiteboard)

### Tier 1 — must be fluent
Arrays/strings (two pointers, sliding window), hash maps, recursion/backtracking, sorting/searching, Big-O reasoning stated unprompted.

### Tier 2 — likely given GIS domain
Trees (BST, traversal), Graphs (BFS/DFS, Dijkstra basics, grid-as-graph — islands/flood-fill), **spatial/geometry problems** (closest pair of points, point-in-polygon, rectangle overlap) — strong domain signal even at a basic level.

### Tier 3 — good to have
DP (2-3 solid patterns), linked lists, heaps/priority queues (k-nearest problems especially — directly spatial).

**Quick-fire practice set (do these first, in C#, out loud, timed):**
1. Two Sum / Group Anagrams
2. Number of Islands (grid BFS/DFS)
3. Merge Intervals
4. Binary Tree Level Order Traversal
5. **K Closest Points to Origin** — directly spatial, near-guaranteed relevance
6. Course Schedule (topological sort)
7. LRU Cache — design + data structure, lead-level favorite
8. Rotting Oranges / Word Ladder — multi-source BFS

---

## 4. C#/.NET-Specific Prep

- Collections complexity (`List<T>`, `Dictionary`, `HashSet`, `Queue`, `Stack`) — know it cold.
- LINQ: write it idiomatically *and* know when to avoid it (hot-path perf, deferred execution gotchas).
- `struct` vs `class` — a spatial `Point { double X, Y }` is the textbook case for `struct`; be ready to justify.
- EF Core pitfalls: N+1, `AsNoTracking()`, projection — ties directly to daily work.
- **NetTopologySuite** — the library EF Core uses for spatial types (`Point`, `Polygon`, `LineString`) mapped to SQL Server `geography`/`geometry` columns. Worth knowing the name even if you haven't used it directly — it's the standard .NET bridge into geospatial data.

---

## 5. Likely Interview Structure

1. **Coding round(s)** — 1-2 DSA problems, ~45 min each.
2. **System/technical design round** — likely GIS-flavored, see §6/§7 below.
3. **Live demo / build exercise** — "integrate Esri mapping into an existing client app" (see §7 — this is the one worth rehearsing hands-on).
4. **Behavioral/leadership round** — use your existing STAR stories from [Interview.md](Interview.md).
5. **Domain/experience discussion** — walk through your PDRM ArcGIS work in depth; it's your strongest card here.

---

## 6. System Design Archetype: "Nearby Search"

The single most common GIS-flavored system design question, disguised many ways ("find nearby stores", "find nearest available unit"):

- **Naive**: linear scan + Haversine distance formula.
- **Better**: spatial index — grid buckets, quadtree, R-tree, or geohash bucketing.
- **At scale**: precomputed tiling, caching, read replicas. Tie back to real DB features: SQL Server `SPATIAL` index type, Oracle `SDO_GEOMETRY` — genuinely strong if you can name these unprompted.

---

## 7. Scenario: "Integrate Esri Mapping Into a Client's Existing Application"

This is the one to actually rehearse hands-on, not just read. Likely framing: *"Client X has an existing [web app / field-service app / asset-management system]. They want to visualize [assets/incidents/vehicles] on a map and let users interact with them. How would you architect this, and can you show a small working piece?"*

### 7.1 Clarifying questions to ask first (do this out loud — it's a lead-level signal)
- Where does the location data live today? Already has lat/lng columns, or does it need geocoding?
- Static data (assets, stores) or **real-time/streaming** (vehicles, live incidents)?
- Read-only visualization, or does the client need to **edit** features on the map (draw zones, move pins)?
- Existing frontend stack? (You'd assume Angular — matches your experience — but ask.)
- Expected data volume — hundreds of points, or hundreds of thousands (changes whether you cluster/tile)?
- On-prem/regulatory constraints (ArcGIS Enterprise on-prem vs. ArcGIS Online SaaS)? This matters a lot for insurance/gov clients like the ones on your resume.

### 7.2 Reference architecture to propose

```
Existing Client App (Angular/React)
        │
        ├── Map Component (new) ── @arcgis/core (ArcGIS Maps SDK for JS)
        │         │
        │         └── renders Esri basemap + feature/graphics layers
        │
Existing Client Backend (.NET Core Web API)
        │
        ├── Existing domain data (SQL Server/Oracle) ── add geography/geometry columns
        │         (NetTopologySuite types via EF Core)
        │
        ├── New endpoint: GET /api/assets/geojson
        │         → projects domain entities to GeoJSON FeatureCollection
        │         → map component consumes this directly as a client-side layer
        │
        └── (if real-time) message queue (as in your PDRM design)
                  → consumer updates positions
                  → either (a) pushed to client via SignalR/WebSocket and
                    redrawn on the ArcGIS graphics layer, or
                  → (b) published into ArcGIS GeoEvent Server, which
                    manages the live feature layer itself
```

**Two integration patterns to present as a trade-off (this is the "architecture suggestion" moment):**

| Pattern | When to use | Trade-off |
|---|---|---|
| **A. App owns the data, ArcGIS is "just a rendering surface"** — your API serves GeoJSON, ArcGIS Maps SDK draws it client-side | Client wants to keep full control of their data model, minimal Esri licensing footprint, moderate data volume | You own scaling/tiling yourself; fine up to tens of thousands of features, not built for huge datasets |
| **B. Data published into ArcGIS as a hosted Feature Service / GeoEvent stream**, client app just embeds the map and queries ArcGIS's own layer | Large datasets, need ArcGIS's built-in spatial analysis/tiling/clustering, multiple consuming apps beyond just this one | More Esri platform lock-in and licensing cost; requires a sync/publish pipeline from source-of-truth DB into ArcGIS |

Your real answer: **"I've actually built pattern-A-adjacent before at PDRM — GPS units publishing to a queue, a consumer updating an ArcGIS layer — so I'd start there for a first cut, then evaluate GeoEvent Server if the client needs Esri to own more of the real-time pipeline."** This is a strong, honest, experience-backed answer — use it.

### 7.3 Code you should be able to produce live

**Angular: embedding a map and plotting points from your own API**

```ts
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';

@Component({
  selector: 'app-asset-map',
  template: `<div #mapDiv style="height:600px;width:100%"></div>`
})
export class AssetMapComponent implements OnInit {
  @ViewChild('mapDiv', { static: true }) mapDiv!: ElementRef;
  private graphicsLayer = new GraphicsLayer();

  constructor(private assetsApi: AssetsApiService) {}

  async ngOnInit() {
    const map = new Map({ basemap: 'streets-navigation-vector', layers: [this.graphicsLayer] });

    const view = new MapView({
      container: this.mapDiv.nativeElement,
      map,
      center: [103.8198, 1.3521], // e.g. client's operating region
      zoom: 11
    });

    const assets = await this.assetsApi.getAssetLocations(); // your existing REST API
    this.plotAssets(assets);
  }

  private plotAssets(assets: { id: string; lng: number; lat: number; label: string }[]) {
    this.graphicsLayer.removeAll();
    for (const a of assets) {
      this.graphicsLayer.add(new Graphic({
        geometry: new Point({ longitude: a.lng, latitude: a.lat }),
        symbol: { type: 'simple-marker', color: [0, 90, 158], size: 8 },
        attributes: { id: a.id, label: a.label },
        popupTemplate: { title: '{label}' }
      }));
    }
  }
}
```

**.NET: exposing existing domain data as GeoJSON (the piece the map above consumes)**

```csharp
// Domain entity already has NetTopologySuite Point column mapped via EF Core
public class Asset
{
    public Guid Id { get; set; }
    public string Label { get; set; } = "";
    public Point Location { get; set; } = null!; // SQL Server 'geography' column
}

[HttpGet("api/assets/geojson")]
public async Task<IActionResult> GetAssetsAsGeoJson()
{
    var assets = await _dbContext.Assets.AsNoTracking().ToListAsync();

    var features = assets.Select(a => new
    {
        type = "Feature",
        geometry = new { type = "Point", coordinates = new[] { a.Location.X, a.Location.Y } },
        properties = new { a.Id, a.Label }
    });

    return Ok(new { type = "FeatureCollection", features });
}
```

If asked to extend this live: add clustering (`FeatureReductionCluster` on the layer), a live SignalR push for real-time updates, or a spatial query (`WHERE geography::Point(lat,lng,4326).STDistance(a.Location) < @radius`) for a "nearby assets" endpoint — all natural extensions of the code above and good follow-up material.

### 7.4 Things to say explicitly during the demo (lead-level signal)
- State your assumptions before coding ("I'm assuming lat/lng already exist on the domain model — if not, step one is a geocoding pass").
- Mention **coordinate reference systems** at least once — WGS84 (EPSG:4326) is the default for lat/lng; if the client's existing data uses a projected CRS, that's a real gotcha worth flagging.
- Mention **licensing/cost** as an architecture factor — ArcGIS has per-seat/consumption pricing; a lead should factor that into the "how much do we lean on the Esri platform vs. build ourselves" trade-off.
- If time allows, mention **testing** — you'd unit test the GeoJSON projection logic and mock the map rendering in an Angular test, consistent with your existing xUnit/Moq/FluentAssertions habits.

---

## 8. Behavioral Prep — Reuse What You Already Have

Your existing [Interview.md](Interview.md) STAR stories (Etiqa AMLA/BNM turnaround, TNB/JuruQuest SAP rescue, PDRM C4i legacy system survival) all still apply — **PDRM is now doubly relevant** since it's also your ArcGIS story. Practice presenting it from *both* angles: as a "legacy system survival" story for behavioral rounds, and as a "real-time GIS integration" story for technical/architecture rounds.

---

## 9. Logistics Checklist

- [ ] Confirm format in advance: whiteboard vs. laptop/shared editor vs. live demo expectations
- [ ] If a live demo is expected, consider spinning up a tiny Angular + `@arcgis/core` sandbox beforehand to have muscle memory for the API (free ArcGIS developer account + API key needed)
- [ ] Practice talking while coding out loud this week (not silently)
- [ ] Always ask clarifying questions before designing/coding
- [ ] State complexity/trade-offs unprompted after finishing
- [ ] Prepare 2-3 questions about the Lead role — team structure, how many client integration projects run in parallel, whether "lead" includes people management or is purely technical/architectural
