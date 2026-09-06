// asherin.arvision — plan view of the loaded map.
// Draws the walkable graph, points of interest, the active route, the viewer and
// every peer in the session. Tapping the canvas places the viewer by hand, which
// is the honest fallback when camera positioning is not configured.

import { useCallback, useEffect, useRef } from "react";
import { MapTransform } from "@/lib/arvision/spatial/mapTransform";
import type { NavigationGraph } from "@/lib/arvision/spatial/navData";
import type { PeerState, Vec3 } from "@/lib/arvision/spatial/types";

interface MapCanvasProps {
  graph: NavigationGraph;
  position: Vec3 | null;
  headingRad: number | null;
  path: number[] | null;
  destinationId: number | null;
  peers: PeerState[];
  onPlace: (position: Vec3) => void;
}

const COLORS = {
  edge: "rgba(255,255,255,0.10)",
  waypoint: "rgba(255,255,255,0.28)",
  route: "rgba(212,175,110,0.85)",
  poi: "rgba(255,255,255,0.55)",
  poiActive: "rgba(212,175,110,1)",
  viewer: "#ffffff",
  peer: "#9ad0ff",
};

const MapCanvas = ({ graph, position, headingRad, path, destinationId, peers, onPlace }: MapCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transformRef = useRef<MapTransform | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (width < 8 || height < 8) return;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const transform = new MapTransform(graph.data.bounds, { width, height }, 24);
    transformRef.current = transform;

    // walkable graph
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.edge;
    ctx.beginPath();
    for (const wp of graph.data.waypoints) {
      const a = transform.toScreen(wp.position);
      for (const neighbourId of wp.connectedWaypoints) {
        if (neighbourId < wp.id) continue;
        const neighbour = graph.getWaypoint(neighbourId);
        if (!neighbour) continue;
        const b = transform.toScreen(neighbour.position);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    }
    ctx.stroke();

    ctx.fillStyle = COLORS.waypoint;
    for (const wp of graph.data.waypoints) {
      const p = transform.toScreen(wp.position);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // active route
    if (path && path.length > 1) {
      ctx.strokeStyle = COLORS.route;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      path.forEach((id, index) => {
        const wp = graph.getWaypoint(id);
        if (!wp) return;
        const p = transform.toScreen(wp.position);
        if (index === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    }

    // points of interest
    ctx.font = "300 11px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const poi of graph.getPOIs()) {
      const p = transform.toScreen(poi.position);
      const active = poi.id === destinationId;
      ctx.fillStyle = active ? COLORS.poiActive : COLORS.poi;
      ctx.beginPath();
      ctx.arc(p.x, p.y, active ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = active ? COLORS.poiActive : "rgba(255,255,255,0.65)";
      ctx.fillText(poi.name, p.x, p.y - 10);
    }

    // peers
    for (const peer of peers) {
      if (!peer.pose) continue;
      const p = transform.toScreen(peer.pose.position);
      const color = `rgb(${Math.round(peer.colorR * 255)},${Math.round(peer.colorG * 255)},${Math.round(peer.colorB * 255)})`;
      ctx.fillStyle = peer.pose.isLocalized ? color : COLORS.peer;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText(peer.playerName, p.x, p.y + 18);
    }

    // viewer
    if (position) {
      const p = transform.toScreen(position);
      ctx.save();
      ctx.translate(p.x, p.y);
      if (headingRad !== null) ctx.rotate(headingRad);
      ctx.fillStyle = COLORS.viewer;
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(7.5, 8);
      ctx.lineTo(0, 4);
      ctx.lineTo(-7.5, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }, [graph, position, headingRad, path, destinationId, peers]);

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(parent);
    return () => observer.disconnect();
  }, [draw]);

  const handlePlace = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const transform = transformRef.current;
    if (!canvas || !transform) return;
    const rect = canvas.getBoundingClientRect();
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const mapPoint = transform.toMap(point);
    const nearest = graph.findNearestWaypoint(mapPoint);
    onPlace(nearest ? { ...nearest.position } : mapPoint);
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handlePlace}
      className="h-full w-full cursor-crosshair touch-manipulation rounded-2xl"
      aria-label="map plan view. tap to place your position"
    />
  );
};

export default MapCanvas;
