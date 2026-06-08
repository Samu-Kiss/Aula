"use client";

import { useEffect, useRef, useState, useCallback, useTransition } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { publishContentAction } from "@/app/dashboard/clases/[id]/actions";
import { accentHex } from "@/lib/accentColors";
import { MapCardEditor, MAP_PALETTE } from "./MapCardEditor";
import type { MapCard } from "./MapCardEditor";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MapMarker { id: string; lng: number; lat: number; color?: string; card: MapCard; }
interface MapRoute  { id: string; points: [number, number][]; color?: string; card: MapCard; }
type Selection = { type: "marker" | "route"; id: string } | null;
type Mode = "marker" | "route";
type SaveStatus = "saved" | "saving" | "unsaved";

interface Props {
  contentId: string; classId: string;
  initialDraft: Record<string, unknown>; isPublished: boolean;
  accent?: string | null;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const DEFAULT_CENTER: [number, number] = [-74.0721, 4.711];
const DEFAULT_ZOOM = 11;

function uid() { return crypto.randomUUID(); }
function emptyCard(): MapCard { return { title: "", body: {} }; }

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

  const colorLabels: Record<string, string> = {
    ...migratedLabels,
    ...(draft?.colorLabels as Record<string, string> | undefined),
  };

  return {
    center: (draft?.center as [number, number] | undefined) ?? DEFAULT_CENTER,
    zoom:   (draft?.zoom   as number            | undefined) ?? DEFAULT_ZOOM,
    markers,
    routes,
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
  const drawingEls       = useRef<mapboxgl.Marker[]>([]);

  const initial = migrate(initialDraft);

  const [markers,     setMarkers]     = useState<MapMarker[]>(initial.markers);
  const [routes,      setRoutes]      = useState<MapRoute[]>(initial.routes);
  const [colorLabels, setColorLabels] = useState<Record<string, string>>(initial.colorLabels);
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

  // State ref for stale-closure–safe map handlers
  const stateRef = useRef({ mode, markers, routes, colorLabels });
  useEffect(() => { stateRef.current = { mode, markers, routes, colorLabels }; });

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
  saveRef.current = save;

  // ── Mount map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
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
          setTimeout(() => saveRef.current?.({ markers: updated }), 0);
          return updated;
        });
        setSelectedId({ type: "marker", id: newId });
      } else if (m === "route") {
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
      el.style.position = "relative";
      el.innerHTML = `
        <div style="width:26px;height:26px;background:${color};border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);cursor:pointer">
          <span style="transform:rotate(45deg);display:block;text-align:center;line-height:20px;color:white;font-size:10px;font-weight:bold">${i + 1}</span>
        </div>
        ${m.card.title ? `<div style="position:absolute;left:30px;top:0;white-space:nowrap;background:white;border-radius:4px;padding:1px 5px;font-size:11px;color:#1A1814;box-shadow:0 1px 4px rgba(0,0,0,0.2);pointer-events:none">${m.card.title}</div>` : ""}
      `;
      el.addEventListener("click", (e) => { e.stopPropagation(); setSelectedId({ type: "marker", id: m.id }); });
      markerEls.current.push(
        new mapboxgl.Marker({ element: el, anchor: "bottom-left" }).setLngLat([m.lng, m.lat]).addTo(map)
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
    if (selectedId.type === "marker") {
      setMarkers((prev) => {
        const updated = prev.map((m) => m.id === selectedId.id ? { ...m, card, color } : m);
        setTimeout(() => saveRef.current?.({ markers: updated }), 0);
        return updated;
      });
    } else {
      setRoutes((prev) => {
        const updated = prev.map((r) => r.id === selectedId.id ? { ...r, card, color } : r);
        setTimeout(() => saveRef.current?.({ routes: updated }), 0);
        return updated;
      });
    }
  }

  function handleDelete() {
    if (!selectedId) return;
    if (selectedId.type === "marker") {
      setMarkers((prev) => { const u = prev.filter((m) => m.id !== selectedId.id); setTimeout(() => saveRef.current?.({ markers: u }), 0); return u; });
    } else {
      setRoutes((prev) => { const u = prev.filter((r) => r.id !== selectedId.id); setTimeout(() => saveRef.current?.({ routes: u }), 0); return u; });
    }
    setSelectedId(null);
  }

  function finishRoute() {
    if (drawingPoints.length < 2) { setDrawingPoints([]); return; }
    const newId = uid();
    setRoutes((prev) => { const u = [...prev, { id: newId, points: drawingPoints, card: emptyCard() }]; setTimeout(() => saveRef.current?.({ routes: u }), 0); return u; });
    setSelectedId({ type: "route", id: newId });
    setDrawingPoints([]);
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
  const selectedEntity = selectedMarker ?? selectedRoute;
  const selectedEntityIndex = selectedMarker ? markers.indexOf(selectedMarker) : selectedRoute ? routes.indexOf(selectedRoute) : -1;

  // Colors currently in use on the map
  const usedColors = Array.from(new Set([
    ...markers.flatMap((m) => (m.color ? [m.color] : [])),
    ...routes.flatMap((r) => (r.color ? [r.color] : [])),
  ]));

  // Card placeholder text
  const placeholderText = mode === "marker"
    ? "Haz clic en el mapa para añadir un punto, o toca un punto para editar su tarjeta."
    : drawingPoints.length === 0
      ? "Haz clic en el mapa para trazar una ruta."
      : `${drawingPoints.length} punto${drawingPoints.length !== 1 ? "s" : ""} — sigue o finaliza.`;

  return (
    <div className="space-y-3">
      {/* ── Compact toolbar ── */}
      <div className="flex items-center gap-3">
        {/* Mode toggle — small segmented control */}
        <div className="inline-flex items-center bg-surface-alt border border-subtle rounded-[7px] p-0.5 gap-0.5">
          {(["marker", "route"] as Mode[]).map((m) => (
            <button key={m}
              onClick={() => { if (m !== mode) { setDrawingPoints([]); setMode(m); } }}
              className={`h-6 px-2.5 rounded-[5px] text-[12px] font-medium transition-colors whitespace-nowrap ${
                mode === m ? "bg-page shadow-sm text-ink" : "text-ink-mute hover:text-ink"
              }`}
            >
              {m === "marker" ? "Punto" : "Ruta"}
            </button>
          ))}
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
        <div ref={containerRef} className="md:flex-1 rounded-[12px] overflow-hidden border border-subtle"
          style={{ height: 440 }} />

        {/* Card panel */}
        <div className="md:w-[380px] md:shrink-0 min-h-[200px] md:h-[440px] bg-surface rounded-[12px] border border-subtle flex flex-col overflow-hidden">
          {selectedEntity && selectedId ? (
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
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center">
              <p className="text-caption text-ink-mute leading-relaxed">{placeholderText}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Route drawing controls (visible only when drawing) ── */}
      {mode === "route" && drawingPoints.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-surface rounded-[8px] border border-subtle">
          <span className="text-mono text-[11px] text-ink-mute flex-1">
            {drawingPoints.length} punto{drawingPoints.length !== 1 ? "s" : ""}
          </span>
          <button onClick={finishRoute} disabled={drawingPoints.length < 2}
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
                  onClick={(e) => { e.stopPropagation(); setRoutes((prev) => { const u = prev.filter((r) => r.id !== route.id); setTimeout(() => saveRef.current?.({ routes: u }), 0); return u; }); if (isSelected) setSelectedId(null); }}
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
                  className="flex-1 h-6 px-2 text-[12px] rounded-[5px] border border-subtle bg-page focus:outline-none focus:ring-1 focus:ring-ink/15"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
