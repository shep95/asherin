// One place that knows which artifact you are working on.
//
// Artifact identity is never threaded through props. Any surface — list,
// workspace pane, sidebar row, later phases' runtime — resolves it from here.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  createArtifact,
  getArtifact,
  listArtifacts,
  listEvents,
  listInstallations,
  listNavigationItems,
  listVersions,
} from "@/lib/software/store";
import type {
  ArtifactEvent,
  ArtifactRole,
  Installation,
  NavigationItem,
  PermissionManifest,
  SoftwareArtifact,
  SoftwareVersion,
} from "@/lib/software/types";
import { LEAST_PRIVILEGE } from "@/lib/software/types";

export interface SoftwareRegistry {
  artifacts: SoftwareArtifact[];
  installations: Installation[];
  navigation: NavigationItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (name: string, description?: string) => Promise<SoftwareArtifact | null>;
  /** the artifact currently open in the workspace, by identity — never by name. */
  activeArtifactId: string | null;
  setActiveArtifactId: (id: string | null) => void;
}

const RegistryContext = createContext<SoftwareRegistry | null>(null);

export function SoftwareProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [artifacts, setArtifacts] = useState<SoftwareArtifact[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [navigation, setNavigation] = useState<NavigationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setArtifacts([]);
      setInstallations([]);
      setNavigation([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [a, i, n] = await Promise.all([listArtifacts(), listInstallations(), listNavigationItems()]);
      setArtifacts(a);
      setInstallations(i);
      setNavigation(n);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not load your software");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const create = useCallback(
    async (name: string, description?: string) => {
      if (!user) return null;
      try {
        const artifact = await createArtifact({ userId: user.id, displayName: name, description });
        setArtifacts((prev) => [artifact, ...prev]);
        return artifact;
      } catch (e) {
        setError(e instanceof Error ? e.message : "could not create the artifact");
        return null;
      }
    },
    [user],
  );

  const value = useMemo<SoftwareRegistry>(
    () => ({
      artifacts,
      installations,
      navigation,
      loading,
      error,
      refresh,
      create,
      activeArtifactId,
      setActiveArtifactId,
    }),
    [artifacts, installations, navigation, loading, error, refresh, create, activeArtifactId],
  );

  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>;
}

export function useSoftwareRegistry(): SoftwareRegistry {
  const ctx = useContext(RegistryContext);
  if (!ctx) throw new Error("useSoftwareRegistry must be used inside SoftwareProvider");
  return ctx;
}

export interface ArtifactWorkspaceContext {
  artifact: SoftwareArtifact | null;
  versions: SoftwareVersion[];
  currentVersion: SoftwareVersion | null;
  events: ArtifactEvent[];
  installation: Installation | null;
  navigationItem: NavigationItem | null;
  role: ArtifactRole | null;
  permissions: PermissionManifest;
  /** truthful runtime state for this phase — no execution is claimed here. */
  runtime: { state: "unavailable"; reason: string };
  /** work that exists locally but has not become a version yet. */
  pendingChanges: boolean;
  latestValidation: SoftwareVersion["validationStatus"] | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** Resolves everything a workspace surface needs from an artifact id alone. */
export function useArtifactWorkspace(artifactId: string | null): ArtifactWorkspaceContext {
  const { user } = useAuth();
  const { installations, navigation } = useSoftwareRegistry();
  const [artifact, setArtifact] = useState<SoftwareArtifact | null>(null);
  const [versions, setVersions] = useState<SoftwareVersion[]>([]);
  const [events, setEvents] = useState<ArtifactEvent[]>([]);
  const [loading, setLoading] = useState(!!artifactId);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!artifactId) {
      setArtifact(null);
      setVersions([]);
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [a, v, e] = await Promise.all([getArtifact(artifactId), listVersions(artifactId), listEvents(artifactId)]);
      setArtifact(a);
      setVersions(v);
      setEvents(e);
      setError(a ? null : "this artifact does not exist, or you do not have access to it");
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not load this artifact");
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const installation = installations.find((i) => i.artifactId === artifactId) ?? null;
  const navigationItem = navigation.find((n) => n.artifactId === artifactId) ?? null;
  const currentVersion = versions.find((v) => v.id === artifact?.currentVersionId) ?? versions[0] ?? null;
  const role: ArtifactRole | null = artifact ? (artifact.ownerUserId === user?.id ? "owner" : "collaborator") : null;

  return {
    artifact,
    versions,
    currentVersion,
    events,
    installation,
    navigationItem,
    role,
    permissions: artifact?.permissionManifest ?? LEAST_PRIVILEGE,
    runtime: {
      state: "unavailable",
      reason: "artifact execution arrives in the next phase — this phase records, versions and installs",
    },
    pendingChanges: !!artifact && versions.length === 0,
    latestValidation: currentVersion?.validationStatus ?? null,
    loading,
    error,
  };
}
