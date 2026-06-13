"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { AULA_MAP_STYLE } from "@/lib/mapStyle";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const MAP_STYLE = process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL || AULA_MAP_STYLE;

interface MapPinMarker {
  id: string;
  lng: number;
  lat: number;
  label: string;
}

interface MapPinBody {
  center: [number, number];
  zoom: number;
  markers: MapPinMarker[];
  correct_marker_id: string;
}

interface Props {
  bodySnapshot: MapPinBody;
  selectedMarkerId: string | undefined;
  onChange: (markerId: string) => void;
  submitted: boolean;
  // only provided when showing results
  correctMarkerId?: string;
}

function markerEl(
  label: string,
  state: "default" | "selected" | "correct" | "wrong"
): HTMLElement {
  const colors: Record<typeof state, string> = {
    default: "#1d4ed8",
    selected: "#7c3aed",
    correct: "#16a34a",
    wrong: "#dc2626",
  };
  const el = document.createElement("div");
  el.style.cssText = `
    width: 34px; height: 34px; border-radius: 50%;
    background: ${colors[state]};
    color: white; font-weight: 700; font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    cursor: ${state === "default" || state === "selected" ? "pointer" : "default"};
    border: 3px solid white;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    transition: transform 0.1s;
    user-select: none;
  `;
  el.textContent = label;
  return el;
}

export function MapPinQuestion({ bodySnapshot, selectedMarkerId, onChange, submitted, correctMarkerId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: bodySnapshot.center ?? [-74.0721, 4.711],
      zoom: bodySnapshot.zoom ?? 11,
      interactive: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const ready = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();

      for (const m of bodySnapshot.markers) {
        let state: "default" | "selected" | "correct" | "wrong" = "default";
        if (submitted && correctMarkerId) {
          if (m.id === correctMarkerId) state = "correct";
          else if (m.id === selectedMarkerId) state = "wrong";
        } else if (m.id === selectedMarkerId) {
          state = "selected";
        }

        const el = markerEl(m.label, state);
        if (!submitted) {
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            onChange(m.id);
          });
        }
        el.title = m.label;

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([m.lng, m.lat])
          .addTo(map);
        markersRef.current.set(m.id, marker);
      }
    };

    if (map.isStyleLoaded()) ready();
    else map.once("load", ready);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodySnapshot, selectedMarkerId, submitted, correctMarkerId]);

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        style={{ height: 320, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(0,0,0,0.1)" }}
      />
      {!submitted && (
        <p className="text-caption text-ink-mute text-center">
          {selectedMarkerId
            ? `Marcador seleccionado: ${bodySnapshot.markers.find((m) => m.id === selectedMarkerId)?.label ?? "?"}`
            : "Haz clic en un marcador del mapa para seleccionar tu respuesta."}
        </p>
      )}
    </div>
  );
}
