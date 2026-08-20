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
import type { LiveShipment } from "@/lib/bajaj/live-shipments";

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

/** bearing (deg, clockwise from north) along the route at the current position */
function headingAt(route: [number, number][], progress: number): number {
  if (route.length < 2) return 0;
  const i = Math.min(route.length - 2, Math.floor(progress * (route.length - 1)));
  const [x0, y0] = route[i];
  const [x1, y1] = route[i + 1];
  return (Math.atan2(x1 - x0, y1 - y0) * 180) / Math.PI - 90;
}

export default function LiveShipmentsMap({
  shipment,
  detailOpen,
  shellId,
}: {
  shipment: LiveShipment | null;
  detailOpen: boolean;
  shellId: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  const destRef = useRef<Marker | null>(null);
  const curRef = useRef<Marker | null>(null);
  const shipmentRef = useRef<LiveShipment | null>(shipment);
  const [terrainOn, setTerrainOn] = useState(true);

  shipmentRef.current = shipment;

  const flyToShipment = () => {
    const m = mapRef.current;
    const s = shipmentRef.current;
    if (!m || !s || s.route.length === 0) return;
    const b = s.route.reduce(
      (acc, c) => acc.extend(c),
      new LngLatBounds(s.route[0], s.route[0]),
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
      geometry: { type: "LineString", coordinates: s ? s.route : [] },
    };
  };

  const updateRoute = (fly: boolean) => {
    const m = mapRef.current;
    const s = shipmentRef.current;
    if (!m || !s || !readyRef.current) return;
    const src = m.getSource("route") as GeoJSONSource | undefined;
    if (src) src.setData(routeGeo());
    if (destRef.current && s.route.length) {
      destRef.current.setLngLat(s.route[s.route.length - 1]);
      destRef.current.getElement().style.display = s.route.length > 1 ? "block" : "none";
    }
    if (curRef.current) {
      curRef.current.setLngLat(s.cur);
      const el = curRef.current.getElement();
      el.style.display = s.route.length > 1 ? "flex" : "none";
      const inner = el.querySelector<HTMLElement>("[data-ship]");
      if (inner) inner.style.transform = `rotate(${headingAt(s.route, s.progress)}deg)`;
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
      m.addSource("route", { type: "geojson", data: routeGeo() });
      m.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": 2.4,
          "line-opacity": 0.92,
          "line-dasharray": [0.1, 2.4],
        },
      });

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
        <MapBtn title="Share">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dfe6ec" strokeWidth="2">
            <circle cx="18" cy="5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="19" r="2.5" />
            <path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6" />
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

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/live/minimap.png"
        alt="Overview"
        style={{
          position: "absolute",
          left: 16,
          bottom: 20,
          width: 88,
          height: 90,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,.2)",
          boxShadow: "0 8px 24px rgba(0,0,0,.5)",
          zIndex: 5,
          cursor: "pointer",
        }}
        onClick={flyToShipment}
      />
    </div>
  );
}
