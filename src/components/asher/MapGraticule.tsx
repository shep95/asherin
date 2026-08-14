// asherin.maps — the rectangle grid, on the map surface.
//
// The old geospatial costume drew a 40px CSS lattice over a blank card and
// called it a world map. The lattice was the only honest thing in that room:
// a person reading imagery wants a measurable frame, not a spreadsheet. So the
// lattice survives, but as a REAL graticule — lines that land on true lat/lon
// on live satellite tiles, with edge labels, redrawn on every move.
//
// Density is a function of zoom so the mesh never turns into a white sheet:
// at country zoom the step is degrees, at rooftop zoom it is arc-seconds.

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/** Degree step per zoom band. Chosen so a viewport holds ~6–12 cells. */
export function graticuleStep(zoom: number): number {
  if (zoom <= 2) return 30;
  if (zoom <= 4) return 10;
  if (zoom <= 6) return 5;
  if (zoom <= 8) return 1;
  if (zoom <= 10) return 0.5;
  if (zoom <= 12) return 0.1;
  if (zoom <= 14) return 0.05;
  if (zoom <= 16) return 0.01;
  if (zoom <= 18) return 0.005;
  return 0.001;
}

/** Label precision follows the step so 0.001° does not print as "48.86". */
function precisionFor(step: number): number {
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  if (step >= 0.01) return 2;
  if (step >= 0.001) return 3;
  return 4;
}

/** Snap a value down to the nearest multiple of step (float-safe). */
export function snapDown(value: number, step: number): number {
  return Math.floor(value / step + 1e-9) * step;
}

/**
 * Number of lines the grid would draw across a span. Exported so the density
 * guard (never a solid mesh) is testable without a DOM map.
 */
export function lineCount(span: number, step: number): number {
  return Math.floor(span / step) + 1;
}

interface Props {
  enabled: boolean;
  /** gold at rooftop, cool white at country scale. */
  color?: string;
  labels?: boolean;
}

const MapGraticule = ({ enabled, color = "#d8c9a3", labels = true }: Props) => {
  const map = useMap();

  useEffect(() => {
    if (!enabled) return;

    const group = L.layerGroup([], { pane: "overlayPane" }).addTo(map);

    const draw = () => {
      group.clearLayers();
      const b = map.getBounds();
      const zoom = map.getZoom();
      const step = graticuleStep(zoom);
      const prec = precisionFor(step);

      const south = Math.max(-85, b.getSouth());
      const north = Math.min(85, b.getNorth());
      const west = b.getWest();
      const east = b.getEast();

      // Density guard: if the viewport somehow holds more than ~40 lines per
      // axis the mesh reads as fog, so the step is doubled until it does not.
      let useStep = step;
      while (lineCount(north - south, useStep) > 40 || lineCount(east - west, useStep) > 40) {
        useStep *= 2;
      }

      const style: L.PolylineOptions = {
        color,
        weight: 0.6,
        opacity: 0.28,
        interactive: false,
      };

      // Faint sub-grid: five minor cells per major cell, drawn first so the
      // labelled graticule always sits on top. Barely there on imagery — a
      // measurable texture, not a fog sheet — and skipped when the minor mesh
      // would exceed the same density guard the major lines answer to.
      const minorStep = useStep / 5;
      const minorStyle: L.PolylineOptions = {
        color,
        weight: 0.4,
        opacity: 0.09,
        interactive: false,
      };
      const minorFits =
        lineCount(north - south, minorStep) <= 120 &&
        lineCount(east - west, minorStep) <= 120;

      if (minorFits) {
        for (let lat = snapDown(south, minorStep); lat <= north; lat += minorStep) {
          if (lat < -85 || lat > 85) continue;
          group.addLayer(L.polyline([[lat, west], [lat, east]], minorStyle));
        }
        for (let lng = snapDown(west, minorStep); lng <= east; lng += minorStep) {
          group.addLayer(L.polyline([[south, lng], [north, lng]], minorStyle));
        }
      }



      for (let lat = snapDown(south, useStep); lat <= north; lat += useStep) {
        if (lat < -85 || lat > 85) continue;
        group.addLayer(L.polyline([[lat, west], [lat, east]], style));
        if (labels) {
          group.addLayer(
            L.marker([lat, west], {
              interactive: false,
              keyboard: false,
              icon: L.divIcon({
                className: "asherin-graticule-label",
                html: `<span>${lat.toFixed(prec)}°</span>`,
                iconSize: [0, 0],
              }),
            }),
          );
        }
      }

      for (let lng = snapDown(west, useStep); lng <= east; lng += useStep) {
        group.addLayer(L.polyline([[south, lng], [north, lng]], style));
        if (labels) {
          group.addLayer(
            L.marker([south, lng], {
              interactive: false,
              keyboard: false,
              icon: L.divIcon({
                className: "asherin-graticule-label asherin-graticule-label--x",
                html: `<span>${lng.toFixed(prec)}°</span>`,
                iconSize: [0, 0],
              }),
            }),
          );
        }
      }
    };

    draw();
    map.on("moveend zoomend resize", draw);
    return () => {
      map.off("moveend zoomend resize", draw);
      group.remove();
    };
  }, [map, enabled, color, labels]);

  return null;
};

export default MapGraticule;
