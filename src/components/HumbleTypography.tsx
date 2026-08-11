import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Public pages speak in a quiet, lowercase voice.
 *
 * The switch lives on <html data-humble="on"> and is driven by the route, not
 * by each page, so a new marketing page inherits the voice for free and no
 * component has to remember to opt in.
 *
 * Working surfaces (dashboards, tools, reports) are excluded: there, casing is
 * data — identifiers, hashes, coordinates, code — and flattening it would
 * destroy meaning rather than soften tone. The single exception is the
 * subscription screen, which is commercial copy and opts in explicitly via its
 * own wrapper attribute.
 */
const WORKING_SURFACES = [
  "/dashboard",
  "/asher-dashboard",
  "/asherin.gov/dashboard",
  "/asherin-gov/dashboard",
  "/report/",
  "/whiteboard",
  "/ziaassets",
];

const HumbleTypography = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const path = pathname.toLowerCase();
    const isWorking = WORKING_SURFACES.some(
      (p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`),
    );
    const root = document.documentElement;
    if (isWorking) root.removeAttribute("data-humble");
    else root.setAttribute("data-humble", "on");
    return () => root.removeAttribute("data-humble");
  }, [pathname]);

  return null;
};

export default HumbleTypography;
