"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export interface MapPinMarker {
  id: string;
  lng: number;
  lat: number;
  label: string;
}

export interface MapPinBody {
  center: [number, number];
  zoom: number;
  markers: MapPinMarker[];
  correct_marker_id: string;
}

interface Props {
  body: MapPinBody;
  onChange: (body: MapPinBody) => void;
}

const DEFAULT_CENTER: [number, number] = [-74.0721, 4.711];
const DEFAULT_ZOOM = 11;
const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function markerEl(label: string, isCorrect: boolean): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = `
    width: 32px; height: 32px; border-radius: 50%;
    background: ${isCorrect ? "#16a34a" : "#1d4ed8"};
    color: white; font-weight: 700; font-size: 13px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    user-select: none;
  `;
  el.textContent = label;
  return el;
}

export function MapPinQuestionEditor({ body, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const bodyRef = useRef(body);

  // Sync ref
  useEffect(() => { bodyRef.current = body; }, [body]);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: body.center ?? DEFAULT_CENTER,
      zoom: body.zoom ?? DEFAULT_ZOOM,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("click", (e) => {
      const current = bodyRef.current;
      if (current.markers.length >= 20) return;
      const label = LABELS[current.markers.length] ?? String(current.markers.length + 1);
      const newMarker: MapPinMarker = {
        id: uid(),
        lng: parseFloat(e.lngLat.lng.toFixed(6)),
        lat: parseFloat(e.lngLat.lat.toFixed(6)),
        label,
      };
      const updated: MapPinBody = {
        ...current,
        markers: [...current.markers, newMarker],
        correct_marker_id: current.correct_marker_id || newMarker.id,
      };
      onChange(updated);
    });

    map.on("moveend", () => {
      const c = map.getCenter();
      const z = map.getZoom();
      onChange({
        ...bodyRef.current,
        center: [parseFloat(c.lng.toFixed(6)), parseFloat(c.lat.toFixed(6))],
        zoom: parseFloat(z.toFixed(2)),
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers to map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    // Add current markers
    body.markers.forEach((m) => {
      const isCorrect = m.id === body.correct_marker_id;
      const el = markerEl(m.label, isCorrect);

      el.title = `Marcador ${m.label}${isCorrect ? " (correcto)" : ""}`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      const marker = new mapboxgl.Marker({ element: el, draggable: false })
        .setLngLat([m.lng, m.lat])
        .addTo(map);
      markersRef.current.set(m.id, marker);
    });
  }, [body.markers, body.correct_marker_id]);

  function removeMarker(id: string) {
    const current = bodyRef.current;
    const remaining = current.markers.filter((m) => m.id !== id);
    // Re-label
    const relabeled = remaining.map((m, i) => ({ ...m, label: LABELS[i] ?? String(i + 1) }));
    const newCorrect = current.correct_marker_id === id
      ? (relabeled[0]?.id ?? "")
      : current.correct_marker_id;
    onChange({ ...current, markers: relabeled, correct_marker_id: newCorrect });
  }

  return (
    <div className="space-y-3">
      <p className="text-caption text-ink-mute">
        Haz clic en el mapa para añadir marcadores. Luego selecciona cuál es la respuesta correcta.
      </p>

      {/* Map */}
      <div
        ref={containerRef}
        style={{ height: 320, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(0,0,0,0.1)" }}
      />

      {/* Marker list */}
      {body.markers.length > 0 ? (
        <div className="space-y-2">
          <p className="text-caption font-medium text-ink">Marcadores — selecciona el correcto</p>
          {body.markers.map((m) => {
            const isCorrect = m.id === body.correct_marker_id;
            return (
              <div
                key={m.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-[8px] border cursor-pointer transition-colors ${
                  isCorrect
                    ? "border-bosque bg-bosque/8"
                    : "border-subtle bg-surface hover:border-accent/40"
                }`}
                onClick={() => onChange({ ...body, correct_marker_id: m.id })}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-none"
                  style={{ background: isCorrect ? "#16a34a" : "#1d4ed8" }}
                >
                  {m.label}
                </div>
                <span className="flex-1 text-caption text-ink">
                  Marcador {m.label}
                  {isCorrect && <span className="ml-2 text-bosque font-medium">(Correcto)</span>}
                </span>
                <span className="text-mono text-ink-mute text-[11px]">
                  {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeMarker(m.id); }}
                  className="text-ink-mute hover:text-borgona text-caption px-1"
                  title="Eliminar marcador"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-caption text-ink-mute text-center py-2">
          Aún no hay marcadores. Haz clic en el mapa para añadir.
        </p>
      )}
    </div>
  );
}
