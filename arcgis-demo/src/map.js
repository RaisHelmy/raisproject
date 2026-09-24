import { INCIDENTS, RESOURCES, INCIDENT_TYPES } from "./data.js";

const KL = [101.715, 3.14];

function load(mods) {
  return new Promise((resolve, reject) => window.require(mods, (...m) => resolve(m), reject));
}

const STATUS_COLOR = { Ronda: "#5ad35a", Standby: "#ffd166", Aktif: "#37b6ff", Pasif: "#a26bff", Gantung: "#8aa4c8" };

export async function createMap(container, opts = {}) {
  const [Map, MapView, FeatureLayer, GraphicsLayer, Graphic, Home, ScaleBar, BasemapToggle, Legend, Expand] = await load([
    "esri/Map", "esri/views/MapView", "esri/layers/FeatureLayer", "esri/layers/GraphicsLayer", "esri/Graphic",
    "esri/widgets/Home", "esri/widgets/ScaleBar", "esri/widgets/BasemapToggle", "esri/widgets/Legend", "esri/widgets/Expand",
  ]);

  const map = new Map({ basemap: opts.basemap || "dark-gray-vector" });
  const view = new MapView({
    container, map, center: opts.center || KL, zoom: opts.zoom || 13,
    popup: { dockEnabled: false, dockOptions: { buttonEnabled: false } },
    ui: { components: ["zoom", "attribution"] },
  });

  // ---- Incident layer (client-side FeatureLayer so renderer/legend/heatmap work) ----
  const incidentGraphics = (opts.incidents || INCIDENTS).map((x, i) => new Graphic({
    geometry: { type: "point", longitude: x.lon, latitude: x.lat },
    attributes: { ObjectID: i + 1, id: x.id, code: x.code, type: x.type, subtype: x.subtype, status: x.status, priority: x.priority, callsign: x.callsign, place: x.place, time: x.time, desc: x.desc },
  }));

  const pointRenderer = {
    type: "unique-value", field: "code",
    uniqueValueInfos: INCIDENT_TYPES.map((t) => ({
      value: t.code, label: t.name,
      symbol: { type: "simple-marker", color: t.color, size: 10, outline: { color: [255, 255, 255, .6], width: 1 } },
    })),
  };
  const heatRenderer = {
    type: "heatmap", radius: 22, maxDensity: .012, minDensity: 0,
    colorStops: [
      { ratio: 0, color: "rgba(0,0,0,0)" }, { ratio: .2, color: "#2b1d8f" }, { ratio: .45, color: "#8a2be2" },
      { ratio: .7, color: "#ff5e5e" }, { ratio: 1, color: "#ffd166" },
    ],
  };

  const incidents = new FeatureLayer({
    title: "Insiden", source: incidentGraphics, objectIdField: "ObjectID", geometryType: "point",
    fields: [
      { name: "ObjectID", type: "oid" }, { name: "id", type: "string" }, { name: "code", type: "integer" },
      { name: "type", type: "string" }, { name: "subtype", type: "string" }, { name: "status", type: "string" },
      { name: "priority", type: "string" }, { name: "callsign", type: "string" }, { name: "place", type: "string" },
      { name: "time", type: "string" }, { name: "desc", type: "string" },
    ],
    renderer: pointRenderer,
    popupTemplate: {
      title: "{id} · {type}",
      content: [{ type: "fields", fieldInfos: [
        { fieldName: "subtype", label: "Jenis" }, { fieldName: "status", label: "Status" }, { fieldName: "priority", label: "Keutamaan" },
        { fieldName: "callsign", label: "Call Sign" }, { fieldName: "place", label: "Lokasi" }, { fieldName: "time", label: "Masa" },
      ] }, { type: "text", text: "{desc}" }],
    },
  });

  // ---- Resource (patrol unit) layer ----
  const resources = new GraphicsLayer({ title: "Sumber" });
  (opts.resources || RESOURCES).forEach((r) => {
    resources.add(new Graphic({
      geometry: { type: "point", longitude: r.lon, latitude: r.lat },
      attributes: r,
      symbol: {
        type: "simple-marker", style: "square", size: 13, color: STATUS_COLOR[r.status] || "#fff",
        outline: { color: "#041022", width: 1.5 },
      },
      popupTemplate: { title: "{callsign}", content: "<b>{officer}</b><br>{station}<br>Status: {status}<br>Kenderaan: {vehicle}<br>Sejak: {since}" },
    }));
  });

  const layers = [];
  if (incidentGraphics.length) layers.push(incidents);
  if (resources.graphics.length) layers.push(resources);
  map.addMany(layers);
  await view.when();

  view.ui.add(new Home({ view }), "top-left");
  view.ui.add(new ScaleBar({ view, unit: "metric" }), "bottom-right");
  view.ui.add(new BasemapToggle({ view, nextBasemap: "hybrid" }), "bottom-right");
  if (opts.legend !== false) {
    view.ui.add(new Expand({ view, content: new Legend({ view, layerInfos: [{ layer: incidents }] }), expandIcon: "legend", expanded: false }), "top-left");
  }

  return {
    view, map, incidents, resources,
    setHeatmap(on) { incidents.renderer = on ? heatRenderer : pointRenderer; },
    showResources(on) { resources.visible = on; },
    goTo(lon, lat, zoom = 16) { return view.goTo({ center: [lon, lat], zoom }, { duration: 800 }); },
    async openIncident(id) {
      const g = incidentGraphics.find((g) => g.attributes.id === id);
      if (!g) return;
      await view.goTo({ target: g.geometry, zoom: 16 }, { duration: 800 });
      view.openPopup({ features: [g], location: g.geometry });
    },
    openResource(callsign) {
      const g = resources.graphics.find((g) => g.attributes.callsign === callsign);
      if (!g) return;
      view.goTo({ target: g.geometry, zoom: 16 }, { duration: 800 });
      view.openPopup({ features: [g], location: g.geometry });
    },
  };
}
