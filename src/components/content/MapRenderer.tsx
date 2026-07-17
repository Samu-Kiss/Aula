"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { accentHex } from "@/lib/accentColors";
import { AULA_MAP_STYLE } from "@/lib/mapStyle";
import { RichTextRenderer } from "@/components/content/RichTextRenderer";
import { MAP_PALETTE } from "@/app/dashboard/clases/[id]/modulos/[moduleId]/contenidos/[contentId]/MapCardEditor";

interface MapCard   { title: string; body: Record<string, unknown>; }
interface MapMarker { id?: string; lng: number; lat: number; color?: string; card?: MapCard; label?: string; categoryId?: string; }
interface MapRoute  { id?: string; points: [number, number][]; color?: string; card?: MapCard; name?: string | null; categoryId?: string; }
interface MapArea   { id?: string; points: [number, number][]; color?: string; card?: MapCard; name?: string | null; }

interface SelectedCard { type: "marker" | "route" | "area"; index: number; card: MapCard; color?: string; points: [number, number][]; }

interface Props {
  body: Record<string, unknown> | null;
  accent?: string;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const MAP_STYLE = process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL || AULA_MAP_STYLE;

const DASH_SEQ = [
  [0,4,3],[0.5,4,2.5],[1,4,2],[1.5,4,1.5],[2,4,1],
  [2.5,4,0.5],[3,4,0],[0,0.5,3,3.5],[0,1,3,3],
  [0,1.5,3,2.5],[0,2,3,2],[0,2.5,3,1.5],[0,3,3,1],[0,3.5,3,0.5],
];

export function MapRenderer({ body, accent }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardPanelRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const [selectedCard, setSelectedCard] = useState<SelectedCard | null>(null);
  // Pantalla completa como overlay CSS (fixed inset-0) en vez del Fullscreen
  // API: el API nativo falla o se revoca en iOS Safari y en vistas embebidas,
  // y el overlay se comporta igual en todos los navegadores.
  const [isFullscreen, setIsFullscreen] = useState(false);

  function toggleFullscreen() {
    setIsFullscreen((v) => !v);
    // El contenedor cambia de tamaño y Mapbox no lo observa; forzar resize
    // tras aplicar el nuevo layout.
    requestAnimationFrame(() => mapRef.current?.resize());
  }

  // ESC cierra el overlay; sin scroll de fondo mientras está abierto.
  useEffect(() => {
    if (!isFullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsFullscreen(false);
        requestAnimationFrame(() => mapRef.current?.resize());
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    // El contenedor del mapa cambia de ancho al abrir/cerrar la carta lateral;
    // Mapbox no observa el resize del contenedor, así que lo forzamos.
    const map = mapRef.current;
    if (map) requestAnimationFrame(() => map.resize());
    if (selectedCard) {
      cardPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedCard]);

  const center      = (body?.center      as [number, number] | undefined) ?? [-74.0721, 4.711];
  const zoom        = (body?.zoom        as number            | undefined) ?? 11;
  const markers     = (body?.markers     as MapMarker[]       | undefined) ?? [];
  const routes      = (body?.routes      as MapRoute[]        | undefined) ?? [];
  const areas       = (body?.areas       as MapArea[]         | undefined) ?? [];
  const colorLabels = (body?.colorLabels as Record<string,string> | undefined) ?? {};

  // Backwards compat: old data had markerCategories/routeCategories
  type OldCat = { id: string; label?: string; color: string };
  const oldMCats = (body?.markerCategories as OldCat[] | undefined) ?? [];
  const oldRCats = (body?.routeCategories  as OldCat[] | undefined) ?? [];
  const catColors = new Map([...oldMCats, ...oldRCats].map((c) => [c.id, c.color]));
  const catLabels = new Map([...oldMCats, ...oldRCats].filter((c) => c.label).map((c) => [c.color, c.label!]));
  // Merge old category labels into colorLabels
  const effectiveColorLabels: Record<string, string> = { ...Object.fromEntries(catLabels), ...colorLabels };

  const markerAccent = accentHex(accent) ?? "#1A1814";

  // Resolve color for a marker (supports both old categoryId and new color field)
  function markerColor(m: MapMarker, i: number) {
    return m.color ?? (m.categoryId ? catColors.get(m.categoryId) : undefined) ?? markerAccent;
  }
  function routeColor(r: MapRoute, i: number) {
    return r.color ?? (r.categoryId ? catColors.get(r.categoryId) : undefined) ?? MAP_PALETTE[i % MAP_PALETTE.length];
  }
  function areaColor(a: MapArea, i: number) {
    return a.color ?? MAP_PALETTE[i % MAP_PALETTE.length];
  }

  const setSelectedRef = useRef(setSelectedCard);
  useEffect(() => { setSelectedRef.current = setSelectedCard; }, []);

  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center, zoom, interactive: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    const cleanup: (() => void)[] = [];

    map.on("load", () => {
      const routeLayerIds: string[] = [];

      // ── Areas (rendered first so they sit beneath routes & markers) ──────────
      areas.forEach((area, i) => {
        if (area.points.length < 3) return;
        const color = areaColor(area, i);
        const card: MapCard = area.card ?? { title: area.name ?? "", body: {} };
        const src = `area-${i}`;
        const fill = `area-fill-${i}`;
        const line = `area-line-${i}`;
        const ring = [...area.points, area.points[0]];

        map.addSource(src, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } },
        });
        map.addLayer({ id: fill, type: "fill", source: src, paint: { "fill-color": color, "fill-opacity": 0.18 } });
        map.addLayer({ id: line, type: "line", source: src, paint: { "line-color": color, "line-width": 2 } });

        const hasContent = card.title || (card.body && Object.keys(card.body).length > 0);
        if (hasContent) {
          map.on("click", fill, () => setSelectedRef.current({ type: "area", index: i, card, color, points: area.points }));
          map.on("mouseenter", fill, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", fill, () => { map.getCanvas().style.cursor = ""; });
        }
      });

      // ── Routes ──────────────────────────────────────────────────────────────
      routes.forEach((route, i) => {
        if (route.points.length < 2) return;
        const color  = routeColor(route, i);
        const card: MapCard = route.card ?? { title: route.name ?? "", body: {} };
        const src = `route-${i}`;
        const lid = `route-layer-${i}`;
        const hit = `route-hit-${i}`;

        map.addSource(src, {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.points } },
        });
        map.addLayer({
          id: lid, type: "line", source: src,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": color, "line-width": 4, "line-dasharray": [2, 2] },
        });
        map.addLayer({
          id: hit, type: "line", source: src,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "transparent", "line-width": 18 },
        });
        routeLayerIds.push(lid);

        const hasContent = card.title || (card.body && Object.keys(card.body).length > 0);
        if (hasContent) {
          map.on("click", hit, () => setSelectedRef.current({ type: "route", index: i, card, color, points: route.points }));
          map.on("mouseenter", hit, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", hit, () => { map.getCanvas().style.cursor = ""; });
        }

        // Numbered waypoints
        route.points.forEach((pt, pi) => {
          const el = document.createElement("div");
          el.innerHTML = `<div style="width:18px;height:18px;background:${color};border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.2);font-size:9px;color:white;font-weight:bold">${pi + 1}</div>`;
          const m = new mapboxgl.Marker({ element: el, anchor: "center" }).setLngLat(pt).addTo(map);
          cleanup.push(() => m.remove());
        });
      });

      // ── Animated dashes — driven by map.on("render") so it stays in sync
      //    with Mapbox GL's WebGL loop and never tears.
      if (routeLayerIds.length > 0) {
        let animStep = -1;
        function onRender() {
          const newStep = Math.floor(performance.now() / 80) % DASH_SEQ.length;
          if (newStep !== animStep) {
            routeLayerIds.forEach((id) => {
              if (map.getLayer(id)) map.setPaintProperty(id, "line-dasharray", DASH_SEQ[newStep]);
            });
            animStep = newStep;
          }
          map.triggerRepaint();
        }
        map.on("render", onRender);
        cleanup.push(() => map.off("render", onRender));
        map.triggerRepaint(); // kick off the first render
      }

      // ── Markers ──────────────────────────────────────────────────────────
      markers.forEach((m, i) => {
        const color  = markerColor(m, i);
        const card: MapCard = m.card ?? { title: m.label ?? "", body: {} };
        const hasContent = card.title || (card.body && Object.keys(card.body).length > 0);

        const el = document.createElement("div");
        // Tamaño explícito del elemento = tamaño del pin. Sin esto (o con
        // position:relative que anula el absolute de .mapboxgl-marker) el div
        // queda en el flujo con ancho completo del mapa y los translate(-50%)
        // del anchor y el apilado de markers corren los pines de su lugar.
        el.style.width = "28px";
        el.style.height = "28px";
        el.innerHTML = `
          <div data-pin style="width:28px;height:28px;background:${color};border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.25);cursor:${hasContent ? "pointer" : "default"}">
            <span style="transform:rotate(45deg);display:block;text-align:center;line-height:22px;color:white;font-size:11px;font-weight:bold">${i + 1}</span>
          </div>
          ${card.title ? `<div style="position:absolute;left:32px;top:0;white-space:nowrap;background:white;border-radius:4px;padding:2px 6px;font-size:11px;color:#1A1814;box-shadow:0 1px 4px rgba(0,0,0,0.15);pointer-events:none">${card.title}</div>` : ""}
        `;
        if (hasContent) {
          el.querySelector("[data-pin]")?.addEventListener("click", (e) => {
            e.stopPropagation();
            setSelectedRef.current({ type: "marker", index: i, card, color, points: [[m.lng, m.lat]] });
          });
        }
        // La punta del pin rotado queda en el centro-abajo del elemento, ~6px
        // por fuera de la caja; el anchor debe coincidir con la punta o el pin
        // "se corre" del punto geográfico al hacer zoom.
        const mk = new mapboxgl.Marker({ element: el, anchor: "bottom", offset: [0, -6] }).setLngLat([m.lng, m.lat]).addTo(map);
        cleanup.push(() => mk.remove());
      });

      // ── Auto-fit to all content on first load ────────────────────────────
      const fitPts: [number, number][] = [
        ...markers.map((m): [number, number] => [m.lng, m.lat]),
        ...routes.flatMap((r) => r.points as [number, number][]),
        ...areas.flatMap((a) => a.points as [number, number][]),
      ];
      if (fitPts.length > 0) {
        const bounds = fitPts.reduce(
          (b, pt) => b.extend(pt),
          new mapboxgl.LngLatBounds(fitPts[0], fitPts[0])
        );
        map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 0 });
      }
    });

    return () => {
      cleanup.forEach((fn) => fn());
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!TOKEN) return <p className="text-body text-ink-soft">Mapa no disponible.</p>;

  // Legend: only colors that have a non-empty label, and are actually used on the map
  const usedMarkerColors = new Set(markers.map((m, i) => markerColor(m, i)));
  const usedRouteColors  = new Set(routes.map((r, i) => routeColor(r, i)));
  const usedAreaColors   = new Set(areas.map((a, i) => areaColor(a, i)));
  const legendEntries = MAP_PALETTE
    .filter((c) => effectiveColorLabels[c]?.trim() && (usedMarkerColors.has(c) || usedRouteColors.has(c) || usedAreaColors.has(c)))
    .map((c) => ({
      color: c,
      label: effectiveColorLabels[c],
      isRoute: usedRouteColors.has(c) && !usedMarkerColors.has(c),
      isArea: usedAreaColors.has(c) && !usedMarkerColors.has(c) && !usedRouteColors.has(c),
    }));

  // All coordinate points, used by the re-center button
  const allPtsForFit: [number, number][] = [
    ...markers.map((m): [number, number] => [m.lng, m.lat]),
    ...routes.flatMap((r) => r.points as [number, number][]),
    ...areas.flatMap((a) => a.points as [number, number][]),
  ];

  function handleRecenter() {
    const map = mapRef.current;
    if (!map || !allPtsForFit.length) return;
    const bounds = allPtsForFit.reduce(
      (b, pt) => b.extend(pt),
      new mapboxgl.LngLatBounds(allPtsForFit[0], allPtsForFit[0])
    );
    map.fitBounds(bounds, { padding: 60, maxZoom: 16, duration: 600 });
  }

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 flex flex-col gap-4 bg-page p-4 overflow-hidden"
          : "space-y-4"
      }
    >
      <div className={`flex flex-col md:flex-row gap-4 items-stretch ${isFullscreen ? "flex-1 min-h-0" : ""}`}>
      {/* Map — containerRef goes on this div so Mapbox reads correct dimensions */}
      <div
        ref={containerRef}
        className="relative flex-1 min-w-0 rounded-[12px] overflow-hidden shadow-sm"
        style={isFullscreen ? { minHeight: 0 } : { height: 560 }}
      >
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
          className="absolute top-[10px] left-[10px] z-10 flex items-center justify-center w-8 h-8 rounded-[8px] bg-white/90 backdrop-blur-sm border border-black/10 shadow text-[#1A1814] hover:bg-white transition-colors"
        >
          {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
        </button>
        {allPtsForFit.length > 0 && (
          <button
            onClick={handleRecenter}
            title="Centrar en el contenido"
            className="absolute bottom-[10px] left-[10px] z-10 flex items-center gap-1.5 h-8 px-3 rounded-[8px] bg-white/90 backdrop-blur-sm border border-black/10 shadow text-[12px] font-medium text-[#1A1814] hover:bg-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
              <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="7" y1="0" x2="7" y2="3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="7" y1="10.5" x2="7" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="0" y1="7" x2="3.5" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="10.5" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Centrar
          </button>
        )}
      </div>

      {/* Card panel — lateral en md+, apilada debajo en móvil */}
      {selectedCard && (
        <div ref={cardPanelRef} className={`bg-surface rounded-[12px] border border-subtle p-5 relative md:w-[340px] md:shrink-0 md:self-start md:overflow-y-auto ${isFullscreen ? "md:max-h-full shrink-0 max-h-[40vh] overflow-y-auto" : "md:max-h-[560px]"}`}>
          <div className="absolute top-3 right-3 flex items-center gap-1">
            <button
              onClick={() => {
                const map = mapRef.current;
                if (!map || !selectedCard.points.length) return;
                const pts = selectedCard.points;
                if (pts.length === 1) {
                  map.flyTo({ center: pts[0], zoom: Math.max(map.getZoom(), 14), speed: 1.4 });
                } else {
                  const bounds = pts.reduce(
                    (b, pt) => b.extend(pt),
                    new mapboxgl.LngLatBounds(pts[0], pts[0])
                  );
                  map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 700 });
                }
              }}
              title="Centrar en el mapa"
              className="w-7 h-7 flex items-center justify-center rounded-full text-ink-mute hover:bg-surface-alt hover:text-ink transition-colors text-[15px]"
              aria-label="Centrar en el mapa"
            >⊙</button>
            <button onClick={() => setSelectedCard(null)}
              className="w-7 h-7 flex items-center justify-center rounded-full text-ink-mute hover:bg-surface-alt hover:text-ink transition-colors text-[13px]"
              aria-label="Cerrar">✕</button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            {selectedCard.color && (
              selectedCard.type === "marker"
                ? <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: selectedCard.color }} />
                : selectedCard.type === "area"
                  ? <span className="w-3 h-3 rounded-[3px] shrink-0 border" style={{ background: `${selectedCard.color}40`, borderColor: selectedCard.color }} />
                  : <svg width="16" height="3" viewBox="0 0 16 3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke={selectedCard.color} strokeWidth="2" strokeDasharray="4 3" /></svg>
            )}
            <span className="text-mono text-ink-mute text-[11px] uppercase tracking-wide">
              {selectedCard.type === "marker" ? `Punto ${selectedCard.index + 1}`
                : selectedCard.type === "route" ? `Ruta ${selectedCard.index + 1}`
                : `Área ${selectedCard.index + 1}`}
            </span>
          </div>
          {selectedCard.card.title && <h3 className="text-h3 text-ink mb-3">{selectedCard.card.title}</h3>}
          {selectedCard.card.body && Object.keys(selectedCard.card.body).length > 0 && (
            <RichTextRenderer body={selectedCard.card.body} accent={accent} />
          )}
        </div>
      )}
      </div>

      {/* Legend — only shown when colors have named labels */}
      {legendEntries.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 px-1">
          {legendEntries.map(({ color, label, isRoute, isArea }) => (
            <div key={color} className="flex items-center gap-1.5">
              {isArea
                ? <span className="w-3 h-3 rounded-[3px] shrink-0 border" style={{ background: `${color}40`, borderColor: color }} />
                : isRoute
                  ? <svg width="16" height="4" viewBox="0 0 16 4" className="shrink-0"><line x1="0" y1="2" x2="16" y2="2" stroke={color} strokeWidth="2" strokeDasharray="4 3" /></svg>
                  : <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
              }
              <span className="text-caption text-ink-soft">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
