"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  LngLatBounds,
  type GeoJSONSource,
  type LngLatLike,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { headingAtProgress, type LiveShipment } from "@/lib/bajaj/live-shipments";

const MAP_PITCH = 55;
const TERRAIN_EXAGGERATION = 1.7;

const btnBase: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  background: "rgba(10,14,18,.9)",
  border: "1px solid rgba(255,255,255,.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0,
};

function MapBtn({
  onClick,
  title,
  children,
  style,
}: {
  onClick?: () => void;
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...btnBase,
        ...style,
        background: hover ? "rgba(28,35,43,.95)" : btnBase.background,
      }}
    >
      {children}
    </button>
  );
}

function shipSvg(rot: number) {
  return (
    '<div style="transform:rotate(' +
    rot +
    'deg);filter:drop-shadow(0 3px 5px rgba(0,0,0,.6))"><svg width="34" height="13" viewBox="0 0 34 13"><path d="M1 6.5L5 2h24l4 4.5L29 11H5L1 6.5z" fill="#1b232c" stroke="rgba(255,255,255,.45)" stroke-width="0.8"/><rect x="7" y="4" width="4" height="5" fill="#3d4a57"/><rect x="12" y="4" width="4" height="5" fill="#56656f"/><rect x="17" y="4" width="4" height="5" fill="#3d4a57"/><rect x="22" y="4" width="4" height="5" fill="#56656f"/></svg></div>'
  );
}

function mkEl(html: string): HTMLElement {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.firstChild as HTMLElement;
}

export default function LiveShipmentsMap({
  shipment,
  routes,
  detailOpen,
  shellId,
}: {
  shipment: LiveShipment | null;
  /** Polylines shared per destination port, keyed by LiveShipment.routeKey. */
  routes: Record<string, [number, number][]>;
  detailOpen: boolean;
  shellId: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  const originRef = useRef<Marker | null>(null);
  const destRef = useRef<Marker | null>(null);
  const curRef = useRef<Marker | null>(null);
  const shipmentRef = useRef<LiveShipment | null>(shipment);
  const [terrainOn, setTerrainOn] = useState(true);

  const routesRef = useRef(routes);
  routesRef.current = routes;
  shipmentRef.current = shipment;

  /** The selected shipment's polyline ([] when the POD has no corridor). */
  const routeOf = (s: LiveShipment | null): [number, number][] =>
    s && s.hasRoute ? (routesRef.current[s.routeKey] ?? []) : [];

  const flyToShipment = () => {
    const m = mapRef.current;
    const s = shipmentRef.current;
    const route = routeOf(s);
    if (!m || !s || route.length === 0) return;
    // (a degenerate origin-only route still frames Nhava Sheva)
    const b = route.reduce(
      (acc, c) => acc.extend(c),
      new LngLatBounds(route[0], route[0]),
    );
    const cam = m.cameraForBounds(b, { padding: { top: 90, bottom: 90, left: 70, right: 70 } });
    if (cam && cam.center) {
      m.flyTo({
        center: cam.center as LngLatLike,
        zoom: Math.min(cam.zoom ?? 5, 9),
        pitch: MAP_PITCH,
        bearing: -14,
        duration: 2200,
      });
    }
  };

  const routeGeo = (): GeoJSON.Feature<GeoJSON.LineString> => {
    const s = shipmentRef.current;
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: routeOf(s) },
    };
  };

  const updateRoute = (fly: boolean) => {
    const m = mapRef.current;
    const s = shipmentRef.current;
    if (!m || !s || !readyRef.current) return;
    const src = m.getSource("route") as GeoJSONSource | undefined;
    if (src) src.setData(routeGeo());
    const route = routeOf(s);
    // Origin dot, dotted line, ship and destination dot all appear/disappear
    // together — a POD with no corridor shows none of them.
    const drawn = s.hasRoute && route.length > 1;
    if (originRef.current) {
      if (route.length) originRef.current.setLngLat(route[0]);
      originRef.current.getElement().style.display = drawn ? "block" : "none";
    }
    if (destRef.current) {
      if (route.length) destRef.current.setLngLat(route[route.length - 1]);
      destRef.current.getElement().style.display = drawn ? "block" : "none";
    }
    if (curRef.current) {
      curRef.current.setLngLat(s.cur);
      const el = curRef.current.getElement();
      el.style.display = drawn ? "flex" : "none";
      const inner = el.querySelector<HTMLElement>("[data-ship]");
      if (inner) inner.style.transform = `rotate(${headingAtProgress(route, s.progress)}deg)`;
    }
    if (fly) flyToShipment();
  };

  // init once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const m = new MapLibreMap({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          sat: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            maxzoom: 18,
            attribution: "Esri, Maxar, Earthstar Geographics",
          },
          dem: {
            type: "raster-dem",
            tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
            encoding: "terrarium",
            tileSize: 256,
            maxzoom: 12,
          },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#0d2438" } },
          {
            id: "sat",
            type: "raster",
            source: "sat",
            paint: {
              "raster-saturation": 0.12,
              "raster-contrast": 0.08,
              "raster-brightness-max": 0.95,
            },
          },
        ],
      },
      center: [72.95, 18.95],
      zoom: 3.4,
      pitch: MAP_PITCH,
      bearing: -16,
      maxPitch: 72,
      attributionControl: { compact: true },
    });
    mapRef.current = m;

    m.on("load", () => {
      readyRef.current = true;
      m.setTerrain({ source: "dem", exaggeration: TERRAIN_EXAGGERATION });
      try {
        m.setSky({
          "sky-color": "#0b1e30",
          "horizon-color": "#25506e",
          "fog-color": "#183a52",
          "sky-horizon-blend": 0.6,
          "horizon-fog-blend": 0.6,
        });
      } catch {
        /* sky unsupported — ignore */
      }
      // Route layers are added AFTER setTerrain so they join the render-to-
      // texture drape stack cleanly. NOTE: `line` layers are always draped when
      // terrain is on (MapLibre LAYERS_TO_TEXTURES), i.e. rasterised into a tile
      // texture and resampled onto the pitched mesh — sub-pixel geometry does
      // not survive that. So the DOTS are sized in real pixels: dasharray units
      // are multiples of line-width, and with round caps each dash is drawn
      // line-width/2 longer at both ends. At the widths below a dot is
      // (0.4 + 1) × width ≈ 6-9px across with a ~0.9 × width gap, which stays
      // legible over satellite imagery at both extremes the camera uses
      // (world lanes sit at z2-3, cameraForBounds caps at z9).
      m.addSource("route", { type: "geojson", data: routeGeo() });
      m.addLayer({
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#02101b",
          "line-opacity": 0.7,
          "line-blur": 1.4,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 8, 3, 9, 6, 11, 12, 14],
        },
      });
      // Faint continuous guide so the arc still reads as one path at low zoom.
      m.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#9ed6ff",
          "line-opacity": 0.25,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 1.2, 6, 1.6, 12, 2],
        },
      });
      // Primary treatment: white round dots, origin -> destination.
      m.addLayer({
        id: "route-dots",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-opacity": 1,
          "line-width": ["interpolate", ["linear"], ["zoom"], 1, 4.4, 3, 5, 6, 5.6, 12, 6.4],
          "line-dasharray": [0.4, 1.9],
        },
      });

      const originEl = mkEl(
        '<div style="width:12px;height:12px;border-radius:50%;background:#2f9bf0;border:3px solid #fff;box-shadow:0 0 11px rgba(47,155,240,.9),0 2px 6px rgba(0,0,0,.5)"></div>',
      );
      originRef.current = new Marker({ element: originEl }).setLngLat([0, 0]).addTo(m);

      const destEl = mkEl(
        '<div style="width:15px;height:15px;border-radius:50%;background:#4ad46f;border:3.5px solid #fff;box-shadow:0 0 12px rgba(74,212,111,.9),0 2px 6px rgba(0,0,0,.5)"></div>',
      );
      destRef.current = new Marker({ element: destEl }).setLngLat([0, 0]).addTo(m);

      const shipWrap = mkEl(
        '<div style="position:relative;display:flex;align-items:center;justify-content:center"><div style="position:absolute;width:74px;height:74px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.14),rgba(255,255,255,0) 65%);border:1px solid rgba(255,255,255,.3);animation:lg-pulse 2.4s ease-out infinite"></div><div style="position:absolute;width:74px;height:74px;border-radius:50%;border:1px solid rgba(255,255,255,.18)"></div><div data-ship>' +
          shipSvg(-24) +
          "</div></div>",
      );
      curRef.current = new Marker({ element: shipWrap }).setLngLat([0, 0]).addTo(m);

      updateRoute(true);
    });

    return () => {
      m.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // selection changed -> new route + flyTo
  useEffect(() => {
    updateRoute(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipment?.key]);

  // detail panel toggled -> resize after layout settles
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.resize(), 60);
    return () => clearTimeout(t);
  }, [detailOpen]);

  const toggleTerrain = () => {
    const m = mapRef.current;
    if (!m || !readyRef.current) return;
    const next = !terrainOn;
    setTerrainOn(next);
    m.setTerrain(next ? { source: "dem", exaggeration: TERRAIN_EXAGGERATION } : null);
  };

  const fullscreen = () => {
    const el = document.getElementById(shellId);
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el?.requestFullscreen();
  };

  return (
    <div style={{ flex: 1, position: "relative", background: "#0d2438", minWidth: 300 }}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 8, zIndex: 5 }}>
        <MapBtn title="Toggle 3D terrain" onClick={toggleTerrain}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#dfe6ec"
            strokeWidth="2"
            strokeLinejoin="round"
          >
            <path d="M12 2l10 5-10 5L2 7l10-5z" />
            <path d="M2 12l10 5 10-5" />
            <path d="M2 17l10 5 10-5" />
          </svg>
        </MapBtn>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 20,
          right: 14,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 5,
        }}
      >
        <MapBtn title="Fullscreen" onClick={fullscreen}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#dfe6ec"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </MapBtn>
        <MapBtn
          title="Zoom in"
          onClick={() => mapRef.current?.zoomIn()}
          style={{ color: "#dfe6ec", fontSize: 17, fontWeight: 600 }}
        >
          +
        </MapBtn>
        <MapBtn
          title="Zoom out"
          onClick={() => mapRef.current?.zoomOut()}
          style={{ color: "#dfe6ec", fontSize: 17, fontWeight: 600 }}
        >
          −
        </MapBtn>
        <MapBtn title="Recenter on shipment" onClick={flyToShipment}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#dfe6ec"
            strokeWidth="2"
            strokeLinejoin="round"
          >
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </MapBtn>
        <MapBtn
          title="Reset view"
          onClick={() => mapRef.current?.easeTo({ bearing: 0, pitch: 0, duration: 800 })}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#dfe6ec"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7l3 8-3-2-3 2 3-8z" fill="#dfe6ec" />
          </svg>
        </MapBtn>
      </div>
    </div>
  );
}
