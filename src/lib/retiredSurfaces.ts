import type { DashboardView } from "@/components/dashboard/types";

/** Products removed from sale and access. Keep this list aligned with backend guards. */
export const RETIRED_VIEWS: readonly DashboardView[] = [
  "geospatial",
  "zacoon",
  "axrlen",
  "zeeion",
  "timeseries",
];

export function isRetiredView(view: string): boolean {
  return (RETIRED_VIEWS as readonly string[]).includes(view);
}
