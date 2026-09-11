// integration health centre.
//
// Every connection you have added, what state it is really in, which apps use
// it, and the audit trail. Nothing here claims a connection works until a live
// health check says so, and no credential value is ever shown or stored here.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plug, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import {
  HEALTH_LABEL,
  healthTone,
  validateCredentialRef,
  validateEndpoint,
  type IntegrationAuthType,
  type IntegrationEvent,
  type IntegrationGrant,
  type IntegrationOperation,
  type IntegrationRecord,
  type IntegrationType,
} from "@/lib/software/integrations";
import {
  checkIntegrationHealth,
  createIntegration,
  discoverMcpCapabilities,
  deleteIntegration,
  listGrants,
  listIntegrationEvents,
  listIntegrations,
  revokeGrant,
  revokeIntegration,
  updateIntegration,
} from "@/lib/software/integrationStore";
import { useSoftwareRegistry } from "@/contexts/SoftwareContext";

const TONE_CLASS: Record<ReturnType<typeof healthTone>, string> = {
  ok: "border-emerald-400/30 text-emerald-200/90",
  warn: "border-amber-400/30 text-amber-200/90",
  bad: "border-red-400/30 text-red-200/90",
  idle: "border-border/30 text-muted-foreground",
};

export default function IntegrationsView() {
  const { artifacts } = useSoftwareRegistry();
  const [items, setItems] = useState<IntegrationRecord[]>([]);
  const [grants, setGrants] = useState<IntegrationGrant[]>([]);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [form, setForm] = useState({
    displayName: "",
    provider: "",
    type: "api" as IntegrationType,
    endpoint: "",
    authType: "api_key" as IntegrationAuthType,
    credentialRef: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [i, g, e] = await Promise.all([listIntegrations(), listGrants(), listIntegrationEvents(40)]);
      setItems(i);
      setGrants(g);
      setEvents(e);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not load your connections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const artifactName = useMemo(() => {
    const map = new Map(artifacts.map((a) => [a.id, a.displayName]));
    return (id: string) => map.get(id) ?? "an app";
  }, [artifacts]);

  const guard = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : label);
    } finally {
      setBusy(null);
    }
  };

  const endpointCheck = form.type === "internal" ? { ok: true, reason: "" } : validateEndpoint(form.endpoint);
  const credCheck = validateCredentialRef(form.credentialRef || null);
  const canAdd =
    form.displayName.trim().length > 1 && form.provider.trim().length > 1 && endpointCheck.ok && credCheck.ok;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-xl font-extralight tracking-wide">connections</h1>
        <p className="text-xs text-muted-foreground">
          apis and mcp servers you have connected. keys are never stored here — you save a key in project secrets and
          enter only its name.
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/5 p-3 text-xs text-red-200/90">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-2xl border border-border/25 bg-card/20 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-light">add a connection</h2>
          <button
            onClick={() => setAdding((v) => !v)}
            className="rounded-lg border border-border/25 px-3 py-1.5 text-[11px] hover:bg-card/40"
          >
            {adding ? "cancel" : "new connection"}
          </button>
        </div>

        {adding && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-[11px] text-muted-foreground">
              name
              <input
                aria-label="connection name"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="weather service"
                className="w-full rounded-lg border border-border/25 bg-background/40 p-2 text-xs text-foreground outline-none focus:border-primary/40"
              />
            </label>
            <label className="space-y-1 text-[11px] text-muted-foreground">
              provider
              <input
                aria-label="provider"
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                placeholder="open-meteo"
                className="w-full rounded-lg border border-border/25 bg-background/40 p-2 text-xs text-foreground outline-none focus:border-primary/40"
              />
            </label>
            <label className="space-y-1 text-[11px] text-muted-foreground">
              kind
              <select
                aria-label="connection kind"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as IntegrationType })}
                className="w-full rounded-lg border border-border/25 bg-background/40 p-2 text-xs text-foreground outline-none"
              >
                <option value="api">api</option>
                <option value="oauth">oauth</option>
                <option value="webhook">webhook</option>
                <option value="mcp">mcp server</option>
                <option value="internal">internal</option>
              </select>
            </label>
            <label className="space-y-1 text-[11px] text-muted-foreground">
              how it signs in
              <select
                aria-label="authentication"
                value={form.authType}
                onChange={(e) => setForm({ ...form, authType: e.target.value as IntegrationAuthType })}
                className="w-full rounded-lg border border-border/25 bg-background/40 p-2 text-xs text-foreground outline-none"
              >
                <option value="none">no key needed</option>
                <option value="api_key">api key</option>
                <option value="bearer">bearer token</option>
                <option value="basic">basic</option>
                <option value="oauth2">oauth token</option>
              </select>
            </label>
            <label className="space-y-1 text-[11px] text-muted-foreground sm:col-span-2">
              address
              <input
                aria-label="endpoint"
                value={form.endpoint}
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                placeholder="https://api.example.com/v1"
                className="w-full rounded-lg border border-border/25 bg-background/40 p-2 text-xs text-foreground outline-none focus:border-primary/40"
              />
              {form.endpoint && !endpointCheck.ok && <span className="text-red-300/80">{endpointCheck.reason}</span>}
            </label>
            {form.authType !== "none" && (
              <label className="space-y-1 text-[11px] text-muted-foreground sm:col-span-2">
                secret name (not the key itself)
                <input
                  aria-label="secret name"
                  value={form.credentialRef}
                  onChange={(e) => setForm({ ...form, credentialRef: e.target.value.toUpperCase() })}
                  placeholder="MY_SERVICE_KEY"
                  className="w-full rounded-lg border border-border/25 bg-background/40 p-2 font-mono text-xs text-foreground outline-none focus:border-primary/40"
                />
                {form.credentialRef && !credCheck.ok && <span className="text-red-300/80">{credCheck.reason}</span>}
              </label>
            )}
            <div className="sm:col-span-2">
              <button
                disabled={!canAdd || busy !== null}
                onClick={() =>
                  void guard("could not add the connection", async () => {
                    await createIntegration({
                      provider: form.provider,
                      displayName: form.displayName,
                      type: form.type,
                      endpoint: form.type === "internal" ? null : form.endpoint,
                      transport: form.type === "mcp" ? "mcp_http" : form.type === "internal" ? "internal" : "https",
                      authType: form.authType,
                      credentialRef: form.authType === "none" ? null : form.credentialRef || null,
                      contract: { operations: [] },
                    });
                    setAdding(false);
                    setForm({ ...form, displayName: "", provider: "", endpoint: "", credentialRef: "" });
                  })
                }
                className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] disabled:opacity-40"
              >
                add connection
              </button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                adding does not mean connected. test it afterwards — the state only changes when the service really
                answers.
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> loading your connections…
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-2xl border border-border/25 bg-card/20 p-6 text-center text-xs text-muted-foreground">
            you have not connected anything yet.
          </p>
        ) : (
          items.map((it) => {
            const used = grants.filter((g) => g.integrationId === it.id);
            return (
              <article key={it.id} className="rounded-2xl border border-border/25 bg-card/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Plug className="h-3.5 w-3.5 text-muted-foreground" />
                      <h3 className="truncate text-sm font-light">{it.displayName}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${TONE_CLASS[healthTone(it.health)]}`}>
                        {HEALTH_LABEL[it.health]}
                      </span>
                      {it.status !== "active" && (
                        <span className="rounded-full border border-border/30 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {it.status}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {it.provider} · {it.type} · {it.endpoint ?? "no address"}
                    </p>
                    {it.healthDetail && <p className="mt-1 text-[11px] text-muted-foreground">{it.healthDetail}</p>}
                    {it.authType !== "none" && (
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        key comes from secret {it.credentialRef ?? "— none set"}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      disabled={busy !== null || it.status === "revoked"}
                      onClick={() =>
                        void guard("the connection test could not run", async () => {
                          await checkIntegrationHealth(it.id);
                        })
                      }
                      className="flex items-center gap-1.5 rounded-lg border border-border/25 px-2.5 py-1 text-[11px] hover:bg-card/40 disabled:opacity-40"
                    >
                      <RefreshCw className="h-3 w-3" /> test connection
                    </button>
                    {it.type === "mcp" && (
                      <button
                        disabled={busy !== null || it.status === "revoked"}
                        onClick={() =>
                          void guard("the tool list could not be read", async () => {
                            const res = await discoverMcpCapabilities(it.id);
                            if (!res.ok) throw new Error(res.error ?? "the server did not report any tools");
                          })
                        }
                        className="rounded-lg border border-border/25 px-2.5 py-1 text-[11px] hover:bg-card/40 disabled:opacity-40"
                      >
                        read its tools
                      </button>
                    )}
                    <button
                      disabled={busy !== null || it.status === "revoked"}
                      onClick={() =>
                        void guard("could not change the connection", () =>
                          updateIntegration(it.id, { status: it.status === "disabled" ? "active" : "disabled" }),
                        )
                      }
                      className="rounded-lg border border-border/25 px-2.5 py-1 text-[11px] hover:bg-card/40 disabled:opacity-40"
                    >
                      {it.status === "disabled" ? "enable" : "disable"}
                    </button>
                    <button
                      disabled={busy !== null || it.status === "revoked"}
                      onClick={() => void guard("could not revoke", () => revokeIntegration(it.id))}
                      className="rounded-lg border border-amber-400/30 px-2.5 py-1 text-[11px] text-amber-200/90 hover:bg-amber-500/10 disabled:opacity-40"
                    >
                      revoke access
                    </button>
                    <button
                      disabled={busy !== null}
                      aria-label={`remove ${it.displayName}`}
                      onClick={() => void guard("could not remove", () => deleteIntegration(it.id))}
                      className="rounded-lg border border-red-400/30 px-2 py-1 text-[11px] text-red-200/90 hover:bg-red-500/10 disabled:opacity-40"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 border-t border-border/20 pt-3">
                  <p className="text-[11px] text-muted-foreground">what it can do</p>
                  {(it.contract.operations ?? []).length === 0 ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      nothing described yet. add each thing it may do, one at a time, so an app can be given exactly
                      that and nothing more.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {(it.contract.operations ?? []).map((op) => (
                        <li key={op.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span>{op.label}</span>
                          <span className="text-muted-foreground">
                            {op.effect} · {op.scope}
                            {op.method ? ` · ${op.method} ${op.path ?? ""}` : ""}
                          </span>
                          <button
                            disabled={busy !== null}
                            onClick={() =>
                              void guard("could not remove that", () =>
                                updateIntegration(it.id, {
                                  contract: {
                                    ...it.contract,
                                    operations: (it.contract.operations ?? []).filter((o) => o.id !== op.id),
                                  },
                                }),
                              )
                            }
                            className="rounded border border-border/25 px-1.5 py-0.5 hover:bg-card/40"
                          >
                            remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <OperationForm
                    disabled={busy !== null || it.status === "revoked"}
                    onAdd={(op) =>
                      void guard("could not add that", () =>
                        updateIntegration(it.id, {
                          contract: { ...it.contract, operations: [...(it.contract.operations ?? []), op] },
                          scopes: Array.from(new Set([...it.scopes, op.scope])),
                        }),
                      )
                    }
                  />
                </div>

                <div className="mt-3 border-t border-border/20 pt-3">
                  <p className="text-[11px] text-muted-foreground">apps using this</p>
                  {used.length === 0 ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">none yet</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {used.map((g) => (
                        <li key={g.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span>{artifactName(g.artifactId)}</span>
                          <span className="text-muted-foreground">
                            {g.state} · {g.grantedScopes.join(", ") || "no scopes"}
                            {g.grantedTools.length ? ` · tools: ${g.grantedTools.join(", ")}` : ""}
                          </span>
                          {g.state !== "revoked" && (
                            <button
                              disabled={busy !== null}
                              onClick={() => void guard("could not revoke that permission", () => revokeGrant(g.id))}
                              className="rounded border border-border/25 px-1.5 py-0.5 hover:bg-card/40"
                            >
                              revoke
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>

      <section className="rounded-2xl border border-border/25 bg-card/20 p-4">
        <h2 className="text-sm font-light">activity</h2>
        <p className="text-[11px] text-muted-foreground">connection tests, permission changes and calls. no keys, no payloads.</p>
        <ul className="mt-3 space-y-1">
          {events.length === 0 && <li className="text-[11px] text-muted-foreground">nothing yet</li>}
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="font-mono">{new Date(e.createdAt).toLocaleString()}</span>
              <span className="text-foreground/80">{e.eventType}</span>
              <span>{e.outcome}</span>
              {e.operation && <span>· {e.operation}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** one thing a connection may do, described narrowly enough to grant on its own. */
function OperationForm({ disabled, onAdd }: { disabled: boolean; onAdd: (op: IntegrationOperation) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState("");
  const [effect, setEffect] = useState<IntegrationOperation["effect"]>("read");
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("");

  if (!open) {
    return (
      <button
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="mt-2 rounded-lg border border-border/25 px-2.5 py-1 text-[11px] hover:bg-card/40 disabled:opacity-40"
      >
        describe an operation
      </button>
    );
  }

  const id = scope.trim().replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  const ready = label.trim().length > 1 && /^[a-z0-9]+([._-][a-z0-9]+)+$/i.test(scope.trim());

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <input
        aria-label="operation label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="create calendar event"
        className="rounded-lg border border-border/25 bg-background/40 p-2 text-xs outline-none focus:border-primary/40"
      />
      <input
        aria-label="operation scope"
        value={scope}
        onChange={(e) => setScope(e.target.value)}
        placeholder="calendar.events.create"
        className="rounded-lg border border-border/25 bg-background/40 p-2 font-mono text-xs outline-none focus:border-primary/40"
      />
      <select
        aria-label="operation effect"
        value={effect}
        onChange={(e) => setEffect(e.target.value as IntegrationOperation["effect"])}
        className="rounded-lg border border-border/25 bg-background/40 p-2 text-xs outline-none"
      >
        <option value="read">reads only</option>
        <option value="write">changes something</option>
        <option value="destructive">deletes something</option>
      </select>
      <div className="flex gap-2">
        <select
          aria-label="operation method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="rounded-lg border border-border/25 bg-background/40 p-2 text-xs outline-none"
        >
          {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          aria-label="operation path"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="events"
          className="flex-1 rounded-lg border border-border/25 bg-background/40 p-2 font-mono text-xs outline-none focus:border-primary/40"
        />
      </div>
      <div className="sm:col-span-2 flex gap-2">
        <button
          disabled={!ready || disabled}
          onClick={() => {
            onAdd({ id, label: label.trim(), effect, method, path: path.trim() || undefined, scope: scope.trim(), inputs: [], outputs: [] });
            setLabel("");
            setScope("");
            setPath("");
            setOpen(false);
          }}
          className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] disabled:opacity-40"
        >
          add operation
        </button>
        <button onClick={() => setOpen(false)} className="rounded-lg border border-border/25 px-2.5 py-1 text-[11px] hover:bg-card/40">
          cancel
        </button>
      </div>
    </div>
  );
}
