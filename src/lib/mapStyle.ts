import type { StyleSpecification } from "mapbox-gl";

/**
 * Estilo Mapbox personalizado de Aula ("Minimal Elegant Geography"), alineado a la
 * paleta neutra del producto. Se usa como FALLBACK cuando NEXT_PUBLIC_MAPBOX_STYLE_URL
 * no está definido (ver MapRenderer / MapEditorInner / MapPinQuestion[Editor]).
 *
 * Nota: las etiquetas de agua usan la source-layer `natural_label` (Mapbox Streets v8),
 * no `water_label` (legacy v7) — esta última ya no existe y mapbox-gl JS lanza
 * "Source layer water_label does not exist" en runtime al validar el estilo.
 */
export const AULA_MAP_STYLE: StyleSpecification = {
  version: 8,
  name: "Minimal Elegant Geography",
  metadata: {
    "mapbox:autocomposite": true,
    "mapbox:type": "template",
    description:
      "Minimalist elegant style with clear physical geography, subtle terrain, water, landcover and clean labels.",
  },
  sprite: "mapbox://sprites/mapbox/light-v11",
  glyphs: "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
  sources: {
    composite: {
      url: "mapbox://mapbox.mapbox-streets-v8,mapbox.mapbox-terrain-v2",
      type: "vector",
    },
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#f4f1eb",
      },
    },
    {
      id: "landuse-natural",
      type: "fill",
      source: "composite",
      "source-layer": "landuse",
      filter: ["in", ["get", "class"], ["literal", ["wood", "grass", "park", "scrub"]]],
      paint: {
        "fill-color": "#dfe6d7",
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.35, 12, 0.55],
      },
    },
    {
      id: "landcover-natural",
      type: "fill",
      source: "composite",
      "source-layer": "landcover",
      filter: ["in", ["get", "class"], ["literal", ["wood", "grass", "scrub"]]],
      paint: {
        "fill-color": [
          "match",
          ["get", "class"],
          "wood",
          "#cdd8c2",
          "grass",
          "#e0e6d4",
          "scrub",
          "#d7ddc9",
          "#dfe6d7",
        ],
        "fill-opacity": 0.45,
      },
    },
    {
      id: "hillshade-shadow",
      type: "fill",
      source: "composite",
      "source-layer": "hillshade",
      paint: {
        "fill-color": "#9c927f",
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.08, 10, 0.14, 14, 0.08],
      },
    },
    {
      id: "contour-lines",
      type: "line",
      source: "composite",
      "source-layer": "contour",
      minzoom: 8,
      paint: {
        "line-color": "#b8ad99",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.25, 13, 0.55],
        "line-opacity": ["interpolate", ["linear"], ["zoom"], 8, 0.15, 13, 0.35],
      },
    },
    {
      id: "water",
      type: "fill",
      source: "composite",
      "source-layer": "water",
      paint: {
        "fill-color": "#b9d2d9",
        "fill-opacity": 0.9,
      },
    },
    {
      id: "water-line",
      type: "line",
      source: "composite",
      "source-layer": "waterway",
      paint: {
        "line-color": "#9fc1cb",
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.4, 12, 1.2],
        "line-opacity": 0.75,
      },
    },
    {
      id: "country-boundaries",
      type: "line",
      source: "composite",
      "source-layer": "admin",
      filter: ["all", ["==", ["get", "admin_level"], 0], ["!=", ["get", "maritime"], true]],
      paint: {
        "line-color": "#9B927F",
        "line-width": ["interpolate", ["linear"], ["zoom"], 2, 0.5, 5, 0.7, 8, 0.9, 12, 1.1],
        "line-opacity": 0.45,
      },
    },
    {
      id: "roads-minor",
      type: "line",
      source: "composite",
      "source-layer": "road",
      minzoom: 10,
      filter: ["in", ["get", "class"], ["literal", ["street", "street_limited", "service", "track"]]],
      paint: {
        "line-color": "#d7d1c5",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.3, 15, 1.2],
        "line-opacity": 0.55,
      },
    },
    {
      id: "roads-primary",
      type: "line",
      source: "composite",
      "source-layer": "road",
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary"]]],
      paint: {
        "line-color": "#c8bfae",
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 10, 1.2, 15, 2.4],
        "line-opacity": 0.75,
      },
    },
    {
      id: "settlement-labels",
      type: "symbol",
      source: "composite",
      "source-layer": "place_label",
      filter: ["in", ["get", "class"], ["literal", ["city", "town", "village"]]],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 8, 13, 12, 16],
        "text-letter-spacing": 0.02,
        "text-transform": "none",
      },
      paint: {
        "text-color": "#4d463b",
        "text-halo-color": "#f4f1eb",
        "text-halo-width": 1.2,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.65, 8, 0.9],
      },
    },
    {
      id: "natural-labels",
      type: "symbol",
      source: "composite",
      "source-layer": "natural_label",
      minzoom: 5,
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["DIN Pro Italic", "Arial Unicode MS Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 10, 13],
        "text-letter-spacing": 0.03,
      },
      paint: {
        "text-color": "#6c6658",
        "text-halo-color": "#f4f1eb",
        "text-halo-width": 1,
        "text-opacity": 0.75,
      },
    },
    {
      // Etiquetas de agua: en Streets v8 viven en `natural_label`, filtradas por clase.
      id: "water-labels",
      type: "symbol",
      source: "composite",
      "source-layer": "natural_label",
      filter: [
        "in",
        ["get", "class"],
        ["literal", ["sea", "ocean", "bay", "water", "reservoir", "lagoon", "strait", "lake", "river", "stream", "canal"]],
      ],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["DIN Pro Italic", "Arial Unicode MS Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 10, 14],
        "symbol-placement": "point",
      },
      paint: {
        "text-color": "#5e8791",
        "text-halo-color": "#f4f1eb",
        "text-halo-width": 1,
        "text-opacity": 0.8,
      },
    },
    {
      id: "country-labels",
      type: "symbol",
      source: "composite",
      "source-layer": "place_label",
      filter: ["==", ["get", "class"], "country"],
      layout: {
        "text-field": ["coalesce", ["get", "name_es"], ["get", "name"]],
        "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 2, 11, 6, 15],
        "text-letter-spacing": 0.08,
        "text-transform": "uppercase",
      },
      paint: {
        "text-color": "#3f392f",
        "text-halo-color": "#f4f1eb",
        "text-halo-width": 1.4,
        "text-opacity": 0.8,
      },
    },
  ],
};
