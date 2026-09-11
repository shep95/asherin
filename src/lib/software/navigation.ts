// The navigation registry.
//
// A sidebar row for an installed app is a record, not a hardcoded entry. The
// row carries a display name a person can change freely; identity — the
// artifact id, the installation id and the route built from the artifact id —
// is never touched by a rename. Everything here is pure so the identity rule
// can be proven without a database.

import type { Installation, NavigationItem, SoftwareArtifact } from "./types";

/** The one place a route for an installed app is written. Identity, not name. */
export function appRoute(artifactId: string): string {
  return `/dashboard/app/${artifactId}`;
}

/** The artifact an app route points at, or null when the path is something else. */
export function artifactIdFromRoute(route: string): string | null {
  const m = /^\/dashboard\/app\/([0-9a-fA-F-]{36})$/.exec(route.trim());
  return m ? m[1] : null;
}

export type NavigationSection = NavigationItem["section"];

export const SECTION_LABEL: Record<NavigationSection, string> = {
  installed: "your apps",
  shared: "shared with you",
  core: "asherin",
};

/** Rows a person should see in the sidebar right now, in their chosen order. */
export function visibleItems(items: NavigationItem[], section: NavigationSection): NavigationItem[] {
  return items
    .filter((i) => i.section === section && i.enabled)
    .slice()
    .sort((a, b) => a.position - b.position || a.displayName.localeCompare(b.displayName));
}

/**
 * A rename changes the label and nothing else. Returned so a caller can prove
 * — and a test can assert — that identity survived.
 */
export function renameItem(item: NavigationItem, displayName: string): NavigationItem {
  const next = displayName.trim();
  if (!next) throw new Error("a name cannot be empty");
  return { ...item, displayName: next };
}

/** Move a row to a new index, keeping every other row's relative order. */
export function reorder(items: NavigationItem[], id: string, toIndex: number): NavigationItem[] {
  const ordered = items.slice().sort((a, b) => a.position - b.position);
  const from = ordered.findIndex((i) => i.id === id);
  if (from < 0) return ordered;
  const clamped = Math.max(0, Math.min(ordered.length - 1, toIndex));
  const [moved] = ordered.splice(from, 1);
  ordered.splice(clamped, 0, moved);
  return ordered.map((i, index) => ({ ...i, position: index }));
}

/** The next free slot at the end of a section. */
export function nextPosition(items: NavigationItem[], section: NavigationSection): number {
  const inSection = items.filter((i) => i.section === section);
  return inSection.length === 0 ? 0 : Math.max(...inSection.map((i) => i.position)) + 1;
}

export type LaunchState =
  | { state: "open"; route: string }
  | { state: "disabled"; reason: string }
  | { state: "missing"; reason: string };

/**
 * Whether an installed app can be opened. Disabled keeps the installation and
 * the data; it only refuses the launch, and says so.
 */
export function launchState(input: {
  artifact: SoftwareArtifact | null;
  installation: Installation | null;
}): LaunchState {
  if (!input.artifact) return { state: "missing", reason: "this application no longer exists" };
  if (!input.installation) {
    return { state: "missing", reason: "this application is not installed on your dashboard" };
  }
  if (!input.installation.enabled) {
    return { state: "disabled", reason: "this application is disabled — enable it in its settings to run it" };
  }
  return { state: "open", route: appRoute(input.artifact.id) };
}

/**
 * Whether an update may run without asking. Anything the installation has not
 * already granted is a new capability, and a person approves it or it does not
 * happen.
 */
export function permissionDelta(input: {
  granted: string[];
  requested: string[];
}): { added: string[]; removed: string[]; requiresApproval: boolean } {
  const granted = new Set(input.granted);
  const requested = new Set(input.requested);
  const added = [...requested].filter((c) => !granted.has(c)).sort();
  const removed = [...granted].filter((c) => !requested.has(c)).sort();
  return { added, removed, requiresApproval: added.length > 0 };
}

export type RemovalAction =
  | "remove_from_dashboard"
  | "disable"
  | "uninstall"
  | "delete_application"
  | "delete_application_and_data";

export interface RemovalSemantics {
  action: RemovalAction;
  label: string;
  /** what a person is agreeing to, in their words. */
  consequence: string;
  keepsInstallation: boolean;
  keepsArtifact: boolean;
  keepsData: boolean;
  destructive: boolean;
  /** typed confirmation required before it runs. */
  requiresTypedConfirmation: boolean;
}

export const REMOVAL_SEMANTICS: Record<RemovalAction, RemovalSemantics> = {
  remove_from_dashboard: {
    action: "remove_from_dashboard",
    label: "remove from dashboard",
    consequence: "the sidebar row is hidden. the app stays installed and everything it holds is untouched.",
    keepsInstallation: true,
    keepsArtifact: true,
    keepsData: true,
    destructive: false,
    requiresTypedConfirmation: false,
  },
  disable: {
    action: "disable",
    label: "disable",
    consequence: "the app stays installed but refuses to run until you enable it again.",
    keepsInstallation: true,
    keepsArtifact: true,
    keepsData: true,
    destructive: false,
    requiresTypedConfirmation: false,
  },
  uninstall: {
    action: "uninstall",
    label: "uninstall",
    consequence: "the installation and its sidebar row go away. the app itself and its data stay, and you can install it again.",
    keepsInstallation: false,
    keepsArtifact: true,
    keepsData: true,
    destructive: false,
    requiresTypedConfirmation: false,
  },
  delete_application: {
    action: "delete_application",
    label: "delete application",
    consequence: "the app, its files and its history are deleted. the rows it stored are deleted with it.",
    keepsInstallation: false,
    keepsArtifact: false,
    keepsData: false,
    destructive: true,
    requiresTypedConfirmation: true,
  },
  delete_application_and_data: {
    action: "delete_application_and_data",
    label: "delete application and its data",
    consequence: "everything is deleted — the app, every version, and every row it saved. this cannot be undone.",
    keepsInstallation: false,
    keepsArtifact: false,
    keepsData: false,
    destructive: true,
    requiresTypedConfirmation: true,
  },
};

/** The data namespace an installed app may read. Never another artifact's. */
export function dataNamespace(artifactId: string): string {
  return `artifact:${artifactId}`;
}

export function namespaceAllows(namespace: string, artifactId: string): boolean {
  return namespace === dataNamespace(artifactId);
}
