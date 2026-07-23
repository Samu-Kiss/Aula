"use client";

import { useEffect, useRef, useState, useCallback, useTransition } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { publishContentAction } from "@/app/dashboard/clases/[id]/actions";
import { accentHex } from "@/lib/accentColors";
import { AULA_MAP_STYLE } from "@/lib/mapStyle";
import { MapCardEditor, MAP_PALETTE } from "./MapCardEditor";
import type { MapCard } from "./MapCardEditor";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MapMarker { id: string; lng: number; lat: number; color?: string; card: MapCard; }
interface MapRoute  { id: string; points: [number, number][]; color?: string; card: MapCard; }
interface MapArea   { id: string; points: [number, number][]; color?: string; card: MapCard; }
type Selection = { type: "marker" | "route" | "area"; id: string } | null;
type Mode = "marker" | "route" | "area";
type SaveStatus = "saved" | "saving" | "unsaved";

interface Props {
  contentId: string; classId: string;
  initialDraft: Record<string, unknown>; isPublished: boolean;
  accent?: string | null;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const MAP_STYLE = process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL || AULA_MAP_STYLE;
const DEFAULT_CENTER: [number, number] = [-74.0721, 4.711];
const DEFAULT_ZOOM = 11;

function uid() { return crypto.randomUUID(); }
function emptyCard(): MapCard { return { title: "", body: {} }; }

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
function normColor(c: unknown): string | undefined {
  return typeof c === "string" && HEX_RE.test(c.trim()) ? c.trim() : undefined;
}

// Wrap plain text (with optional line breaks) into the Tiptap doc shape the
// card editor/renderer expect: { doc: { type: "doc", content: [...] } }.
function textToCardBody(text: unknown): Record<string, unknown> {
  if (typeof text !== "string" || !text.trim()) return {};
  const paragraphs = text.split(/\n{2,}/).map((p) => ({
    type: "paragraph",
    content: p.trim() ? [{ type: "text", text: p.trim() }] : [],
  }));
  return { doc: { type: "doc", content: paragraphs } };
}

// ─── File import ────────────────────────────────────────────────────────────
interface ImportResult { markers: MapMarker[]; routes: MapRoute[]; areas: MapArea[]; }

function cardFromProps(props: Record<string, unknown>): MapCard {
  const title = (props.title ?? props.name ?? props.label ?? "") as string;
  const bodyText = props.description ?? props.body ?? props.desc ?? props.text;
  return { title: typeof title === "string" ? title : "", body: textToCardBody(bodyText) };
}

// Parse a GeoJSON FeatureCollection (Point→marker, LineString→route, Polygon→area).
function parseGeoJSON(fc: Record<string, unknown>): ImportResult {
  const out: ImportResult = { markers: [], routes: [], areas: [] };
  const features = (fc.features as Record<string, unknown>[] | undefined) ?? [];
  for (const f of features) {
    const geom = f.geometry as Record<string, unknown> | undefined;
    if (!geom) continue;
    const props = (f.properties as Record<string, unknown>) ?? {};
    const color = normColor(props.color ?? props["marker-color"] ?? props.stroke ?? props.fill);
    const card = cardFromProps(props);
    const coords = geom.coordinates as unknown;
    switch (geom.type) {
      case "Point": {
        const [lng, lat] = coords as [number, number];
        out.markers.push({ id: uid(), lng, lat, color, card });
        break;
      }
      case "MultiPoint":
        for (const [lng, lat] of coords as [number, number][])
          out.markers.push({ id: uid(), lng, lat, color, card: { ...card } });
        break;
      case "LineString":
        out.routes.push({ id: uid(), points: coords as [number, number][], color, card });
        break;
      case "MultiLineString":
        for (const line of coords as [number, number][][])
          out.routes.push({ id: uid(), points: line, color, card: { ...card } });
        break;
      case "Polygon":
        out.areas.push({ id: uid(), points: (coords as [number, number][][])[0], color, card });
        break;
      case "MultiPolygon":
        for (const poly of coords as [number, number][][][])
          out.areas.push({ id: uid(), points: poly[0], color, card: { ...card } });
        break;
    }
  }
  return out;
}

// Parse the native Aula map export shape ({ markers, routes, areas }).
function parseNative(data: Record<string, unknown>): ImportResult {
  const m = migrate(data);
  const rawAreas = (data.areas as unknown[]) ?? [];
  const areas: MapArea[] = rawAreas.map((a) => {
    const o = a as Record<string, unknown>;
    return {
      id: uid(),
      points: o.points as [number, number][],
      color: normColor(o.color),
      card: (o.card as MapCard | undefined) ?? { title: (o.name as string) ?? "", body: {} },
    };
  });
  return {
    markers: m.markers.map((x) => ({ ...x, id: uid() })),
    routes: m.routes.map((x) => ({ ...x, id: uid() })),
    areas,
  };
}

function parseImport(raw: string): ImportResult {
  const data = JSON.parse(raw) as Record<string, unknown>;
  if (data.type === "FeatureCollection" || Array.isArray(data.features)) return parseGeoJSON(data);
  return parseNative(data);
}

// ─── Migration ────────────────────────────────────────────────────────────────
function migrate(draft: Record<string, unknown>) {
  // Old format had categoryId + markerCategories/routeCategories arrays
  type OldCat = { id: string; label?: string; color: string };
  const oldMCats = (draft?.markerCategories as OldCat[] | undefined) ?? [];
  const oldRCats = (draft?.routeCategories  as OldCat[] | undefined) ?? [];
  const catColors = new Map([...oldMCats, ...oldRCats].map((c) => [c.id, c.color]));

  // Build initial colorLabels from old categories (if they had custom labels)
  const migratedLabels: Record<string, string> = {};
  [...oldMCats, ...oldRCats].forEach((c) => {
    if (c.label && !["Nueva categoría","Tipo de punto","Tipo de ruta"].includes(c.label)) {
      migratedLabels[c.color] = c.label;
    }
  });

  const rawMarkers = (draft?.markers as unknown[]) ?? [];
  const markers: MapMarker[] = rawMarkers.map((m) => {
    const r = m as Record<string, unknown>;
    return {
      id:    (r.id as string)    ?? uid(),
      lng:   r.lng as number,
      lat:   r.lat as number,
      color: (r.color as string | undefined) ?? (r.categoryId ? catColors.get(r.categoryId as string) : undefined),
      card:  (r.card as MapCard  | undefined)
        ?? (r.label ? { title: r.label as string, body: {} } : emptyCard()),
    };
  });

  const rawRoutes = (draft?.routes as unknown[]) ?? [];
  const routes: MapRoute[] = rawRoutes.map((r) => {
    const o = r as Record<string, unknown>;
    return {
      id:    (o.id as string)    ?? uid(),
      points: o.points as [number, number][],
      color: (o.color as string | undefined) ?? (o.categoryId ? catColors.get(o.categoryId as string) : undefined),
      card:  (o.card as MapCard  | undefined) ?? { title: (o.name as string) ?? "", body: {} },
    };
  });

  const rawAreas = (draft?.areas as unknown[]) ?? [];
  const areas: MapArea[] = rawAreas.map((a) => {
    const o = a as Record<string, unknown>;
    return {
      id:     (o.id as string) ?? uid(),
      points: o.points as [number, number][],
      color:  (o.color as string | undefined),
      card:   (o.card as MapCard | undefined) ?? { title: (o.name as string) ?? "", body: {} },
    };
  });

  const colorLabels: Record<string, string> = {
    ...migratedLabels,
    ...(draft?.colorLabels as Record<string, string> | undefined),
  };

  return {
    center: (draft?.center as [number, number] | undefined) ?? DEFAULT_CENTER,
    zoom:   (draft?.zoom   as number            | undefined) ?? DEFAULT_ZOOM,
    markers,
    routes,
    areas,
    colorLabels,
  };
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MapEditorInner({ contentId, classId, initialDraft, isPublished, accent }: Props) {
  const containerRef     = useRef<HTMLDivElement>(null);
  const mapRef           = useRef<mapboxgl.Map | null>(null);
  const markerEls        = useRef<mapboxgl.Marker[]>([]);
  const routeLayerIds    = useRef<string[]>([]);
  const routeWaypointEls = useRef<mapboxgl.Marker[]>([]);
  const areaLayerIds     = useRef<string[]>([]);
  const drawingEls       = useRef<mapboxgl.Marker[]>([]);
  const fileInputRef     = useRef<HTMLInputElement>(null);

  const initial = migrate(initialDraft);

  const [markers,     setMarkers]     = useState<MapMarker[]>(initial.markers);
  const [routes,      setRoutes]      = useState<MapRoute[]>(initial.routes);
  const [areas,       setAreas]       = useState<MapArea[]>(initial.areas);
  const [colorLabels, setColorLabels] = useState<Record<string, string>>(initial.colorLabels);
  const [importError, setImportError] = useState<string | null>(null);
  const [mode,        setMode]        = useState<Mode>("marker");
  const [mapReady,    setMapReady]    = useState(false);
  const [selectedId,  setSelectedId]  = useState<Selection>(null);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [saveStatus,  setSaveStatus]  = useState<SaveStatus>(
    initialDraft && Object.keys(initialDraft).length > 0 ? "saved" : "unsaved"
  );
  const [published,  setPublished]   = useState(isPublished);
  const [isPending,  startTransition] = useTransition();

  const accentColor = accentHex(accent) ?? "#1A1814";

  // ── History (undo / redo) ─────────────────────────────────────────────────
  type HistoryEntry = { markers: MapMarker[]; routes: MapRoute[]; areas: MapArea[] };
  const historyRef    = useRef<HistoryEntry[]>([{ markers: initial.markers, routes: initial.routes, areas: initial.areas }]);
  const historyIdxRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const MAX_HISTORY = 60;
  // Stable refs so event listeners never hold stale closures
  const pushHistoryRef = useRef<(m: MapMarker[], r: MapRoute[], a: MapArea[]) => void>(() => {});
  const undoRef        = useRef<() => void>(() => {});
  const redoRef        = useRef<() => void>(() => {});

  // State ref for stale-closure–safe map handlers
  const stateRef = useRef({ mode, markers, routes, areas, colorLabels });
  useEffect(() => { stateRef.current = { mode, markers, routes, areas, colorLabels }; });

  // ── Save ──────────────────────────────────────────────────────────────────
  const saveRef = useRef<((overrides?: Record<string, unknown>) => Promise<void>) | null>(null);
  const save = useCallback(async (overrides: Record<string, unknown> = {}) => {
    setSaveStatus("saving");
    const map = mapRef.current;
    const s   = stateRef.current;
    const body = {
      center: map ? [map.getCenter().lng, map.getCenter().lat] : initial.center,
      zoom:   map ? map.getZoom() : initial.zoom,
      markers:     s.markers,
      routes:      s.routes,
      areas:       s.areas,
      colorLabels: s.colorLabels,
      ...overrides,
    };
    try {
      await fetch(`/api/contents/${contentId}/autosave`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body_draft: body }),
      });
      setSaveStatus("saved");
    } catch { setSaveStatus("unsaved"); }
  }, [contentId, initial.center, initial.zoom]);

  // ── History functions (assigned to refs so closures are always fresh) ─────
  function pushHistory(m: MapMarker[], r: MapRoute[], a: MapArea[]) {
    const idx  = historyIdxRef.current;
    const next = [...historyRef.current.slice(0, idx + 1), { markers: m, routes: r, areas: a }]
      .slice(-MAX_HISTORY);
    historyRef.current    = next;
    historyIdxRef.current = next.length - 1;
    setCanUndo(next.length > 1);
    setCanRedo(false);
  }

  function undo() {
    const idx = historyIdxRef.current;
    if (idx <= 0) return;
    const newIdx = idx - 1;
    historyIdxRef.current = newIdx;
    const entry = historyRef.current[newIdx];
    setMarkers(entry.markers);
    setRoutes(entry.routes);
    setAreas(entry.areas);
    setCanUndo(newIdx > 0);
    setCanRedo(true);
    setTimeout(() => saveRef.current?.({ markers: entry.markers, routes: entry.routes, areas: entry.areas }), 0);
  }

  function redo() {
    const hist   = historyRef.current;
    const idx    = historyIdxRef.current;
    if (idx >= hist.length - 1) return;
    const newIdx = idx + 1;
    historyIdxRef.current = newIdx;
    const entry  = hist[newIdx];
    setMarkers(entry.markers);
    setRoutes(entry.routes);
    setAreas(entry.areas);
    setCanUndo(true);
    setCanRedo(newIdx < hist.length - 1);
    setTimeout(() => saveRef.current?.({ markers: entry.markers, routes: entry.routes, areas: entry.areas }), 0);
  }

  // Reasignadas tras cada render (no durante): los handlers del mapa y el
  // teclado disparan después del render, así que siempre ven el closure fresco.
  useEffect(() => {
    saveRef.current        = save;
    pushHistoryRef.current = pushHistory;
    undoRef.current        = undo;
    redoRef.current        = redo;
  });

  // ── Keyboard shortcut (Ctrl/Cmd+Z, Ctrl/Cmd+Y, Ctrl/Cmd+Shift+Z) ─────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undoRef.current(); }
      else if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); redoRef.current(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── Mount map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: initial.center, zoom: initial.zoom,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.on("load", () => setMapReady(true));
    map.on("click", (e) => {
      if ((e.originalEvent.target as HTMLElement).closest("[data-mk]")) return;
      const lng = parseFloat(e.lngLat.lng.toFixed(6));
      const lat = parseFloat(e.lngLat.lat.toFixed(6));
      const { mode: m } = stateRef.current;
      if (m === "marker") {
        const newId = uid();
        setMarkers((prev) => {
          const updated = [...prev, { id: newId, lng, lat, card: emptyCard() }];
          const s = stateRef.current;
          setTimeout(() => {
            saveRef.current?.({ markers: updated });
            pushHistoryRef.current(updated, s.routes, s.areas);
          }, 0);
          return updated;
        });
        setSelectedId({ type: "marker", id: newId });
      } else if (m === "route" || m === "area") {
        setDrawingPoints((prev) => [...prev, [lng, lat]]);
      }
    });
    map.on("moveend", () => { saveRef.current?.(); });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markerEls.current.forEach((m) => m.remove());
    markerEls.current = [];
    markers.forEach((m, i) => {
      const color = m.color ?? accentColor;
      const el = document.createElement("div");
      el.setAttribute("data-mk", m.id);
      // Tamaño explícito = tamaño del pin; ver nota en MapRenderer: sin esto el
      // elemento toma el ancho del mapa y el anchor corre los pines de su punto.
      el.style.width = "26px";
      el.style.height = "26px";
      el.innerHTML = `
        <div style="width:26px;height:26px;background:${color};border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer">
          <span style="transform:rotate(45deg);display:block;text-align:center;line-height:20px;color:white;font-size:10px;font-weight:bold">${i + 1}</span>
        </div>
        ${m.card.title ? `<div style="position:absolute;left:30px;top:0;white-space:nowrap;background:white;border-radius:4px;padding:1px 5px;font-size:11px;color:#1A1814;box-shadow:0 1px 4px rgba(0,0,0,0.2);pointer-events:none">${m.card.title}</div>` : ""}
      `;
      el.addEventListener("click", (e) => { e.stopPropagation(); setSelectedId({ type: "marker", id: m.id }); });
      markerEls.current.push(
        // Anchor en la punta del pin rotado (centro-abajo, ~5px fuera de la
        // caja); con "bottom-left" el pin se corría del punto al hacer zoom.
        new mapboxgl.Marker({ element: el, anchor: "bottom", offset: [0, -5] }).setLngLat([m.lng, m.lat]).addTo(map)
      );
    });
  }, [markers, accentColor]);

  // ── Sync routes ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    routeLayerIds.current.forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(id)) map.removeSource(id);
    });
    routeLayerIds.current = [];
    routeWaypointEls.current.forEach((m) => m.remove());
    routeWaypointEls.current = [];

    routes.forEach((route, i) => {
      if (route.points.length < 2) return;
      const color = route.color ?? MAP_PALETTE[i % MAP_PALETTE.length];
      const id = `route-${route.id}`;
      map.addSource(id, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.points } },
      });
      map.addLayer({
        id, type: "line", source: id,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": color, "line-width": 3, "line-dasharray": [2, 2] },
      });
      routeLayerIds.current.push(id);
      route.points.forEach((pt, pi) => {
        const dotEl = document.createElement("div");
        dotEl.innerHTML = `<div style="width:16px;height:16px;background:${color};border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;color:white;font-weight:bold">${pi + 1}</div>`;
        routeWaypointEls.current.push(
          new mapboxgl.Marker({ element: dotEl, anchor: "center" }).setLngLat(pt).addTo(map)
        );
      });
    });
  }, [routes, mapReady]);

  // ── Sync areas ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    areaLayerIds.current.forEach((id) => {
      if (map.getLayer(`${id}-fill`)) map.removeLayer(`${id}-fill`);
      if (map.getLayer(`${id}-line`)) map.removeLayer(`${id}-line`);
      if (map.getSource(id)) map.removeSource(id);
    });
    areaLayerIds.current = [];

    areas.forEach((area, i) => {
      if (area.points.length < 3) return;
      const color = area.color ?? MAP_PALETTE[i % MAP_PALETTE.length];
      const id = `area-${area.id}`;
      const ring = [...area.points, area.points[0]]; // close the ring
      map.addSource(id, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } },
      });
      map.addLayer({ id: `${id}-fill`, type: "fill", source: id, paint: { "fill-color": color, "fill-opacity": 0.18 } });
      map.addLayer({ id: `${id}-line`, type: "line", source: id, paint: { "line-color": color, "line-width": 2 } });
      areaLayerIds.current.push(id);
      const onClick = () => setSelectedId({ type: "area", id: area.id });
      map.on("click", `${id}-fill`, onClick);
    });
  }, [areas, mapReady]);

  // ── Sync drawing preview ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    drawingEls.current.forEach((m) => m.remove());
    drawingEls.current = [];
    const PREV = "__drawing__";
    if (map.getLayer(PREV)) map.removeLayer(PREV);
    if (map.getSource(PREV)) map.removeSource(PREV);
    const previewColor = "#94A3B8";
    drawingPoints.forEach(([lng, lat]) => {
      const el = document.createElement("div");
      el.style.cssText = `width:10px;height:10px;background:${previewColor};border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.25)`;
      drawingEls.current.push(new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map));
    });
    if (drawingPoints.length >= 2 && mapReady) {
      map.addSource(PREV, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: drawingPoints } } });
      map.addLayer({ id: PREV, type: "line", source: PREV, layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": previewColor, "line-width": 2, "line-dasharray": [3, 2], "line-opacity": 0.7 } });
    }
  }, [drawingPoints, mapReady]);

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleCardUpdate(card: MapCard, color: string | undefined) {
    if (!selectedId) return;
    const s = stateRef.current;
    if (selectedId.type === "marker") {
      const updated = s.markers.map((m) => m.id === selectedId.id ? { ...m, card, color } : m);
      setMarkers(updated);
      pushHistory(updated, s.routes, s.areas);
      setTimeout(() => saveRef.current?.({ markers: updated }), 0);
    } else if (selectedId.type === "route") {
      const updated = s.routes.map((r) => r.id === selectedId.id ? { ...r, card, color } : r);
      setRoutes(updated);
      pushHistory(s.markers, updated, s.areas);
      setTimeout(() => saveRef.current?.({ routes: updated }), 0);
    } else {
      const updated = s.areas.map((a) => a.id === selectedId.id ? { ...a, card, color } : a);
      setAreas(updated);
      pushHistory(s.markers, s.routes, updated);
      setTimeout(() => saveRef.current?.({ areas: updated }), 0);
    }
  }

  function handleDelete() {
    if (!selectedId) return;
    const s = stateRef.current;
    if (selectedId.type === "marker") {
      const u = s.markers.filter((m) => m.id !== selectedId.id);
      setMarkers(u);
      pushHistory(u, s.routes, s.areas);
      setTimeout(() => saveRef.current?.({ markers: u }), 0);
    } else if (selectedId.type === "route") {
      const u = s.routes.filter((r) => r.id !== selectedId.id);
      setRoutes(u);
      pushHistory(s.markers, u, s.areas);
      setTimeout(() => saveRef.current?.({ routes: u }), 0);
    } else {
      const u = s.areas.filter((a) => a.id !== selectedId.id);
      setAreas(u);
      pushHistory(s.markers, s.routes, u);
      setTimeout(() => saveRef.current?.({ areas: u }), 0);
    }
    setSelectedId(null);
  }

  function finishDrawing() {
    const min = mode === "area" ? 3 : 2;
    if (drawingPoints.length < min) { setDrawingPoints([]); return; }
    const newId = uid();
    const s = stateRef.current;
    if (mode === "area") {
      const u = [...s.areas, { id: newId, points: drawingPoints, card: emptyCard() }];
      setAreas(u);
      pushHistory(s.markers, s.routes, u);
      setTimeout(() => saveRef.current?.({ areas: u }), 0);
      setSelectedId({ type: "area", id: newId });
    } else {
      const u = [...s.routes, { id: newId, points: drawingPoints, card: emptyCard() }];
      setRoutes(u);
      pushHistory(s.markers, u, s.areas);
      setTimeout(() => saveRef.current?.({ routes: u }), 0);
      setSelectedId({ type: "route", id: newId });
    }
    setDrawingPoints([]);
  }

  // ── Import from JSON / GeoJSON file ─────────────────────────────────────────
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-importing the same file
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const result = parseImport(text);
      if (!result.markers.length && !result.routes.length && !result.areas.length) {
        setImportError("El archivo no contiene puntos, rutas ni áreas reconocibles.");
        return;
      }
      const nextMarkers = [...stateRef.current.markers, ...result.markers];
      const nextRoutes  = [...stateRef.current.routes,  ...result.routes];
      const nextAreas   = [...stateRef.current.areas,   ...result.areas];
      setMarkers(nextMarkers);
      setRoutes(nextRoutes);
      setAreas(nextAreas);
      setSelectedId(null);
      pushHistory(nextMarkers, nextRoutes, nextAreas);
      setTimeout(() => saveRef.current?.({ markers: nextMarkers, routes: nextRoutes, areas: nextAreas }), 0);

      // Fit the map to all imported geometry
      const all = [
        ...result.markers.map((m) => [m.lng, m.lat] as [number, number]),
        ...result.routes.flatMap((r) => r.points),
        ...result.areas.flatMap((a) => a.points),
      ];
      const map = mapRef.current;
      if (map && all.length) {
        const bounds = all.reduce(
          (b, pt) => b.extend(pt),
          new mapboxgl.LngLatBounds(all[0], all[0])
        );
        map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 600 });
      }
    } catch {
      setImportError("No se pudo leer el archivo. Asegúrate de que sea JSON o GeoJSON válido.");
    }
  }

  // ── Center map on a set of coordinates ──────────────────────────────────────
  function flyToPoints(pts: [number, number][]) {
    const map = mapRef.current;
    if (!map || !pts.length) return;
    if (pts.length === 1) {
      map.flyTo({ center: pts[0], zoom: Math.max(map.getZoom(), 14), speed: 1.4 });
    } else {
      const bounds = pts.reduce(
        (b, pt) => b.extend(pt),
        new mapboxgl.LngLatBounds(pts[0], pts[0])
      );
      map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 700 });
    }
  }

  // ── Export as GeoJSON ────────────────────────────────────────────────────────
  function handleExport() {
    const s = stateRef.current;
    const features: Record<string, unknown>[] = [
      ...s.markers.map((m) => ({
        type: "Feature",
        properties: { title: m.card.title || null, color: m.color ?? null },
        geometry: { type: "Point", coordinates: [m.lng, m.lat] },
      })),
      ...s.routes.map((r) => ({
        type: "Feature",
        properties: { title: r.card.title || null, color: r.color ?? null },
        geometry: { type: "LineString", coordinates: r.points },
      })),
      ...s.areas.map((a) => ({
        type: "Feature",
        properties: { title: a.card.title || null, color: a.color ?? null },
        geometry: { type: "Polygon", coordinates: [[...a.points, a.points[0]]] },
      })),
    ];
    const fc = { type: "FeatureCollection", features };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mapa.geojson"; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Download sample template ──────────────────────────────────────────────
  function handleDownloadSample() {
    const map = mapRef.current;
    const cx = map ? map.getCenter().lng : DEFAULT_CENTER[0];
    const cy = map ? map.getCenter().lat : DEFAULT_CENTER[1];
    const d = 0.008; // ~900 m offset
    const sample = {
      type: "FeatureCollection",
      // Los campos que empiezan con "_" son solo notas para quien edita la
      // plantilla; el importador los ignora. JSON no admite comentarios, así
      // que documentamos aquí qué campos se usan.
      _instrucciones: {
        formato: "GeoJSON estándar. Edita el arreglo 'features'; cada elemento es un punto, ruta o área.",
        geometria: {
          Point: "Un punto (marcador). coordinates: [lng, lat].",
          LineString: "Una ruta. coordinates: [[lng, lat], [lng, lat], …].",
          Polygon: "Un área. coordinates: [[[lng, lat], …, primer punto repetido]].",
        },
        properties: {
          title: "Título de la tarjeta (también se acepta 'name' o 'label').",
          description: "Texto de la tarjeta, opcional (también 'body' o 'text').",
          color: "Color del elemento en formato hex #RRGGBB, opcional.",
        },
        nota: "Las coordenadas son [longitud, latitud] en grados decimales (¡lng primero!).",
      },
      features: [
        {
          type: "Feature",
          properties: { title: "Punto de interés A", description: "Descripción opcional del lugar.", color: "#2563EB" },
          geometry: { type: "Point", coordinates: [cx, cy + d] },
        },
        {
          type: "Feature",
          properties: { title: "Punto de interés B", description: "Otro lugar relevante.", color: "#16A34A" },
          geometry: { type: "Point", coordinates: [cx + d, cy - d] },
        },
        {
          type: "Feature",
          properties: { title: "Ruta principal", description: "Recorrido entre los puntos A y B.", color: "#DC2626" },
          geometry: { type: "LineString", coordinates: [[cx, cy + d], [cx + d / 2, cy], [cx + d, cy - d]] },
        },
        {
          type: "Feature",
          properties: { title: "Zona de interés", description: "Área delimitada en el mapa.", color: "#7C3AED" },
          geometry: {
            type: "Polygon",
            coordinates: [[[cx - d, cy - d], [cx - d, cy + d], [cx + d / 2, cy + d], [cx + d / 2, cy - d], [cx - d, cy - d]]],
          },
        },
      ],
    };
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "plantilla-mapa.geojson"; a.click();
    URL.revokeObjectURL(url);
  }

  function handleColorLabelChange(color: string, label: string) {
    setColorLabels((prev) => {
      const updated = { ...prev, [color]: label };
      setTimeout(() => saveRef.current?.({ colorLabels: updated }), 0);
      return updated;
    });
  }

  function handlePublish() {
    startTransition(async () => {
      await save();
      const result = await publishContentAction(contentId, classId);
      if (result?.ok) setPublished(true);
    });
  }

  if (!TOKEN) return (
    <div className="bg-surface rounded-[12px] border border-subtle p-8 text-center">
      <p className="text-body text-ink-soft">Configura <code className="text-mono">NEXT_PUBLIC_MAPBOX_TOKEN</code> para usar el editor de mapas.</p>
    </div>
  );

  const selectedMarker = selectedId?.type === "marker" ? markers.find((m) => m.id === selectedId.id) ?? null : null;
  const selectedRoute  = selectedId?.type === "route"  ? routes.find((r)  => r.id === selectedId.id) ?? null : null;
  const selectedArea   = selectedId?.type === "area"   ? areas.find((a)  => a.id === selectedId.id) ?? null : null;
  const selectedEntity = selectedMarker ?? selectedRoute ?? selectedArea;
  const selectedEntityIndex = selectedMarker ? markers.indexOf(selectedMarker)
    : selectedRoute ? routes.indexOf(selectedRoute)
    : selectedArea ? areas.indexOf(selectedArea) : -1;

  // Colors currently in use on the map
  const usedColors = Array.from(new Set([
    ...markers.flatMap((m) => (m.color ? [m.color] : [])),
    ...routes.flatMap((r) => (r.color ? [r.color] : [])),
    ...areas.flatMap((a) => (a.color ? [a.color] : [])),
  ]));

  // Card placeholder text
  const placeholderText = mode === "marker"
    ? "Haz clic en el mapa para añadir un punto, o toca un punto para editar su tarjeta."
    : drawingPoints.length === 0
      ? mode === "area" ? "Haz clic en el mapa para trazar un área (mínimo 3 puntos)." : "Haz clic en el mapa para trazar una ruta."
      : `${drawingPoints.length} punto${drawingPoints.length !== 1 ? "s" : ""} — sigue o finaliza.`;

  return (
    <div className="space-y-3">
      {/* ── Compact toolbar ── */}
      <div className="flex items-center gap-3">
        {/* Mode toggle — small segmented control */}
        <div className="inline-flex items-center bg-surface-alt border border-subtle rounded-[7px] p-0.5 gap-0.5">
          {(["marker", "route", "area"] as Mode[]).map((m) => (
            <button key={m}
              onClick={() => { if (m !== mode) { setDrawingPoints([]); setMode(m); } }}
              className={`h-6 px-2.5 rounded-[5px] text-[12px] font-medium transition-colors whitespace-nowrap ${
                mode === m ? "bg-page shadow-sm text-ink" : "text-ink-mute hover:text-ink"
              }`}
            >
              {m === "marker" ? "Punto" : m === "route" ? "Ruta" : "Área"}
            </button>
          ))}
        </div>

        {/* Import / Export / Sample — grouped */}
        <div className="inline-flex items-center border border-subtle rounded-[6px] divide-x divide-subtle">
          <input ref={fileInputRef} type="file" accept=".json,.geojson,application/json,application/geo+json"
            onChange={handleImportFile} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} title="Importar desde archivo GeoJSON o JSON"
            className="text-mono text-[12px] px-2.5 h-6 text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors rounded-l-[5px]">
            Importar
          </button>
          <button onClick={handleExport}
            disabled={!markers.length && !routes.length && !areas.length}
            title="Exportar como GeoJSON"
            className="text-mono text-[12px] px-2.5 h-6 text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
            Exportar
          </button>
          <button onClick={handleDownloadSample} title="Descargar plantilla GeoJSON de ejemplo"
            className="text-mono text-[12px] px-2.5 h-6 text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors rounded-r-[5px]">
            Plantilla
          </button>
        </div>
        {/* Undo / Redo */}
        <div className="inline-flex items-center border border-subtle rounded-[6px] divide-x divide-subtle">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Deshacer (Ctrl+Z)"
            className="text-mono text-[12px] px-2.5 h-6 text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors rounded-l-[5px] disabled:opacity-30 disabled:cursor-not-allowed"
          >↩</button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Rehacer (Ctrl+Y)"
            className="text-mono text-[12px] px-2.5 h-6 text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors rounded-r-[5px] disabled:opacity-30 disabled:cursor-not-allowed"
          >↪</button>
        </div>

        <span className="text-mono text-ink-mute text-[11px]">
          {saveStatus === "saved" ? "Guardado" : saveStatus === "saving" ? "Guardando…" : "Sin guardar"}
        </span>
        <button onClick={handlePublish} disabled={isPending}
          className="ml-auto text-mono text-[12px] px-3 h-7 rounded-[6px] bg-ink text-page hover:bg-ink/80 disabled:opacity-40 transition-colors">
          {isPending ? "Publicando…" : published ? "Actualizar" : "Publicar"}
        </button>
      </div>

      {/* ── Map + Card panel (responsive: side-by-side on md+, stacked below) ── */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Map */}
        {/* `isolate`: contiene los z-index internos de Mapbox (controles, marcadores,
            popups) para que no suban al contexto de apilamiento raíz — ver MapRenderer. */}
        <div ref={containerRef} className="md:flex-1 isolate rounded-[12px] overflow-hidden border border-subtle"
          style={{ height: 440 }} />

        {/* Card panel */}
        <div className="md:w-[380px] md:shrink-0 min-h-[200px] md:h-[440px] bg-surface rounded-[12px] border border-subtle flex flex-col overflow-hidden">
          {selectedEntity && selectedId ? (
            <div className="flex flex-col h-full min-h-0">
              {/* Centrar — solo visible cuando hay selección */}
              <div className="flex justify-end px-3 pt-2 shrink-0">
                <button
                  onClick={() => {
                    if (selectedMarker) flyToPoints([[selectedMarker.lng, selectedMarker.lat]]);
                    else if (selectedRoute) flyToPoints(selectedRoute.points);
                    else if (selectedArea)  flyToPoints(selectedArea.points);
                  }}
                  className="text-mono text-[11px] text-ink-mute hover:text-ink transition-colors flex items-center gap-1"
                  title="Centrar el mapa en este elemento"
                >
                  <span>⊙</span><span>Centrar</span>
                </button>
              </div>
              <MapCardEditor
                key={selectedId.id}
                entityType={selectedId.type}
                entityIndex={selectedEntityIndex}
                initialCard={selectedEntity.card}
                initialColor={selectedEntity.color}
                accentColor={accentColor}
                onUpdate={handleCardUpdate}
                onDelete={handleDelete}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <p className="text-caption text-ink-mute leading-relaxed">{placeholderText}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Import error ── */}
      {importError && (
        <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-[8px] text-[12px] text-red-600">
          {importError}
        </div>
      )}

      {/* ── Drawing controls (visible only when drawing a route or area) ── */}
      {(mode === "route" || mode === "area") && drawingPoints.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-surface rounded-[8px] border border-subtle">
          <span className="text-mono text-[11px] text-ink-mute flex-1">
            {drawingPoints.length} punto{drawingPoints.length !== 1 ? "s" : ""}
          </span>
          <button onClick={finishDrawing} disabled={drawingPoints.length < (mode === "area" ? 3 : 2)}
            className="h-6 px-3 text-mono text-[11px] rounded-[5px] bg-ink text-page hover:bg-ink/80 disabled:opacity-40 transition-colors">
            Finalizar
          </button>
          <button onClick={() => setDrawingPoints([])} className="text-[11px] text-ink-mute hover:text-ink transition-colors">
            Cancelar
          </button>
        </div>
      )}

      {/* ── Routes list ── */}
      {routes.length > 0 && (
        <div className="space-y-1">
          <p className="text-caption text-ink-mute px-0.5">Rutas ({routes.length})</p>
          {routes.map((route, i) => {
            const color = route.color ?? MAP_PALETTE[i % MAP_PALETTE.length];
            const isSelected = selectedId?.type === "route" && selectedId.id === route.id;
            return (
              <button key={route.id}
                onClick={() => setSelectedId({ type: "route", id: route.id })}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] border transition-colors text-left ${isSelected ? "bg-ink/5 border-ink/20" : "bg-surface border-subtle hover:bg-surface-alt"}`}>
                <svg width="16" height="3" viewBox="0 0 16 3" className="shrink-0">
                  <line x1="0" y1="1.5" x2="16" y2="1.5" stroke={color} strokeWidth="2" strokeDasharray="4 3" />
                </svg>
                <span className="flex-1 text-[13px] text-ink truncate">
                  {route.card.title || <span className="text-ink-mute italic">Sin nombre</span>}
                </span>
                <span className="text-mono text-[10px] text-ink-mute shrink-0">{route.points.length} pts</span>
                <span
                  onClick={(e) => { e.stopPropagation(); flyToPoints(route.points); }}
                  title="Centrar en el mapa"
                  className="text-[13px] text-ink-mute hover:text-ink transition-colors cursor-pointer shrink-0 px-0.5"
                >⊙</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    const s = stateRef.current;
                    const u = s.routes.filter((r) => r.id !== route.id);
                    setRoutes(u);
                    pushHistory(s.markers, u, s.areas);
                    setTimeout(() => saveRef.current?.({ routes: u }), 0);
                    if (isSelected) setSelectedId(null);
                  }}
                  className="text-[12px] text-ink-mute hover:text-red-500 transition-colors cursor-pointer shrink-0 px-1"
                >✕</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Areas list ── */}
      {areas.length > 0 && (
        <div className="space-y-1">
          <p className="text-caption text-ink-mute px-0.5">Áreas ({areas.length})</p>
          {areas.map((area, i) => {
            const color = area.color ?? MAP_PALETTE[i % MAP_PALETTE.length];
            const isSelected = selectedId?.type === "area" && selectedId.id === area.id;
            return (
              <button key={area.id}
                onClick={() => setSelectedId({ type: "area", id: area.id })}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[8px] border transition-colors text-left ${isSelected ? "bg-ink/5 border-ink/20" : "bg-surface border-subtle hover:bg-surface-alt"}`}>
                <span className="w-3.5 h-3.5 rounded-[3px] shrink-0 border" style={{ background: `${color}40`, borderColor: color }} />
                <span className="flex-1 text-[13px] text-ink truncate">
                  {area.card.title || <span className="text-ink-mute italic">Sin nombre</span>}
                </span>
                <span className="text-mono text-[10px] text-ink-mute shrink-0">{area.points.length} pts</span>
                <span
                  onClick={(e) => { e.stopPropagation(); flyToPoints(area.points); }}
                  title="Centrar en el mapa"
                  className="text-[13px] text-ink-mute hover:text-ink transition-colors cursor-pointer shrink-0 px-0.5"
                >⊙</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    const s = stateRef.current;
                    const u = s.areas.filter((a) => a.id !== area.id);
                    setAreas(u);
                    pushHistory(s.markers, s.routes, u);
                    setTimeout(() => saveRef.current?.({ areas: u }), 0);
                    if (isSelected) setSelectedId(null);
                  }}
                  className="text-[12px] text-ink-mute hover:text-red-500 transition-colors cursor-pointer shrink-0 px-1"
                >✕</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Color legend editor — auto-generated from colors in use ── */}
      {usedColors.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-caption text-ink-mute">
            Convención de colores — ponle nombre a cada color para que aparezca en la vista del estudiante.
          </p>
          <div className="flex flex-col gap-1.5">
            {usedColors.map((c) => (
              <div key={c} className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-white shadow-sm" style={{ background: c }} />
                <input
                  value={colorLabels[c] ?? ""}
                  onChange={(e) => handleColorLabelChange(c, e.target.value)}
                  placeholder="Nombre del tipo (opcional)…"
                  className="flex-1 h-6 px-2 text-[12px] rounded-[5px] border border-subtle bg-page focus:outline-none focus:ring-1 focus:ring-accent/40"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
