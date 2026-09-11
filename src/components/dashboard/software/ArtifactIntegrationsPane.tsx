// what one app is allowed to reach.
//
// Access is granted operation by operation, never "full access". A change that
// asks for anything new is shown as a difference and needs your approval before
// it counts.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  HEALTH_LABEL,
  consentSentence,
  diffPermissions,
  type IntegrationGrant,
  type IntegrationRecord,
} from "@/lib/software/integrations";
import { grantIntegration, listGrants, listIntegrations, revokeGrant } from "@/lib/software/integrationStore";

interface Props {
  artifactId: string;
  artifactName: string;
  installationId?: string | null;
  /** what the app itself declares it wants, from its manifest. */
  requested?: Array<{ integrationId: string; scopes: string[]; tools?: string[]; rationale?: string | null }>;
}

export default function ArtifactIntegrationsPane({ artifactId, artifactName, installationId, requested = [] }: Props) {
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
  const [grants, setGrants] = useState<IntegrationGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, { scopes: string[]; tools: string[] }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, g] = await Promise.all([listIntegrations(), listGrants(artifactId)]);
      setIntegrations(i);
      setGrants(g);
      setPicked(
        Object.fromEntries(
          g.map((x) => [x.integrationId, { scopes: [...x.grantedScopes], tools: [...x.grantedTools] }]),
        ),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not load connections");
    } finally {
      setLoading(false);
    }
  }, [artifactId]);

  useEffect(() => {
    void load();
  }, [load]);

  const grantFor = (id: string) => grants.find((g) => g.integrationId === id) ?? null;

  // what the app asks for versus what it already has: only new things escalate.
  const escalation = useMemo(() => {
    const current = {
      integrationIds: grants.filter((g) => g.state === "approved").map((g) => g.integrationId),
      scopes: grants.flatMap((g) => (g.state === "approved" ? g.grantedScopes : [])),
      tools: grants.flatMap((g) => (g.state === "approved" ? g.grantedTools : [])),
    };
    const next = {
      integrationIds: requested.map((r) => r.integrationId),
      scopes: requested.flatMap((r) => r.scopes),
      tools: requested.flatMap((r) => r.tools ?? []),
    };
    return requested.length ? diffPermissions(current, next) : null;
  }, [grants, requested]);

  const toggle = (integrationId: string, key: "scopes" | "tools", value: string) => {
    setPicked((prev) => {
      const entry = prev[integrationId] ?? { scopes: [], tools: [] };
      const has = entry[key].includes(value);
      return {
        ...prev,
        [integrationId]: { ...entry, [key]: has ? entry[key].filter((v) => v !== value) : [...entry[key], value] },
      };
    });
  };

  const save = async (integration: IntegrationRecord) => {
    setBusy(true);
    setError(null);
    try {
      const entry = picked[integration.id] ?? { scopes: [], tools: [] };
      await grantIntegration({
        integrationId: integration.id,
        artifactId,
        installationId: installationId ?? null,
        scopes: entry.scopes,
        tools: entry.tools,
        rationale: requested.find((r) => r.integrationId === integration.id)?.rationale ?? null,
        approve: true,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save that permission");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> loading connections…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-[11px] text-red-300/85">{error}</p>}

      {escalation?.escalation && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 text-[11px] text-amber-100/90">
          <p className="font-medium">this update asks for more than {artifactName} had before</p>
          {escalation.addedScopes.length > 0 && <p>new permissions: {escalation.addedScopes.join(", ")}</p>}
          {escalation.addedTools.length > 0 && <p>new tools: {escalation.addedTools.join(", ")}</p>}
          <p className="mt-1">nothing is active until you approve it below.</p>
        </div>
      )}

      {integrations.length === 0 && (
        <p className="text-[11px] text-muted-foreground">you have not connected anything yet.</p>
      )}

      {integrations.map((it) => {
        const grant = grantFor(it.id);
        const entry = picked[it.id] ?? { scopes: [], tools: [] };
        const operations = it.contract.operations ?? [];
        const tools = it.contract.tools ?? [];
        const unusable = it.status !== "active";
        return (
          <section key={it.id} className="rounded-xl border border-border/25 bg-card/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs">{it.displayName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {it.provider} · {HEALTH_LABEL[it.health]}
                  {unusable ? ` · ${it.status} — apps cannot use it` : ""}
                </p>
              </div>
              {grant && grant.state === "approved" && (
                <span className="flex items-center gap-1 rounded-full border border-emerald-400/30 px-2 py-0.5 text-[10px] text-emerald-200/90">
                  <ShieldCheck className="h-3 w-3" /> granted
                </span>
              )}
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              {consentSentence(it, entry.scopes, requested.find((r) => r.integrationId === it.id)?.rationale)}
            </p>

            {operations.length === 0 ? (
              <p className="mt-2 text-[11px] text-muted-foreground">
                this connection has no operations described yet, so there is nothing to grant.
              </p>
            ) : (
              <ul className="mt-2 space-y-1">
                {operations.map((op) => (
                  <li key={op.id} className="flex items-start gap-2 text-[11px]">
                    <input
                      type="checkbox"
                      aria-label={`${it.displayName}: ${op.label}`}
                      disabled={unusable || busy}
                      checked={entry.scopes.includes(op.scope)}
                      onChange={() => toggle(it.id, "scopes", op.scope)}
                      className="mt-0.5"
                    />
                    <span>
                      {op.label}
                      <span className="text-muted-foreground"> · {op.scope}</span>
                      {op.effect !== "read" && <span className="text-amber-200/80"> · asks before it runs</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {it.type === "mcp" && tools.length > 0 && (
              <div className="mt-2">
                <p className="text-[11px] text-muted-foreground">tools on this server</p>
                <ul className="mt-1 space-y-1">
                  {tools.map((t) => (
                    <li key={t.name} className="flex items-start gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        aria-label={`${it.displayName} tool ${t.name}`}
                        disabled={unusable || busy}
                        checked={entry.tools.includes(t.name)}
                        onChange={() => toggle(it.id, "tools", t.name)}
                        className="mt-0.5"
                      />
                      <span>
                        {t.name}
                        {t.description && <span className="text-muted-foreground"> · {t.description}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                disabled={unusable || busy}
                onClick={() => void save(it)}
                className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] disabled:opacity-40"
              >
                {grant ? "update access" : "approve access"}
              </button>
              {grant && grant.state !== "revoked" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      try {
                        await revokeGrant(grant.id);
                        await load();
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                  className="rounded-lg border border-border/25 px-2.5 py-1 text-[11px] hover:bg-card/40"
                >
                  take access away
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
