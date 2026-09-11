// Data that belongs to this artifact — and only this artifact.
//
// Records live in a namespace keyed by the artifact and its owner, so an
// artifact can never read your account data or another artifact's data. The
// shape it declares is shown next to what it actually holds.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteArtifactRecord,
  listArtifactRecords,
  putArtifactRecord,
  readContract,
  validateDataContract,
  type ArtifactRecord,
} from "@/lib/software/dataContract";
import type { ArtifactRun, SoftwareArtifact } from "@/lib/software/types";

const card = "rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm";

const ArtifactDataPane = ({
  artifact,
  runs,
  canWrite,
}: {
  artifact: SoftwareArtifact;
  runs: ArtifactRun[];
  canWrite: boolean;
}) => {
  const { user } = useAuth();
  const [records, setRecords] = useState<ArtifactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState("");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("{}");
  const [busy, setBusy] = useState(false);

  const contract = useMemo(() => readContract(artifact.dataManifest), [artifact.dataManifest]);
  const problems = useMemo(() => validateDataContract(contract), [contract]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRecords(await listArtifactRecords(artifact.id));
    } catch (e) {
      toast.error("could not read this artifact's data", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [artifact.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const parsed = JSON.parse(value || "{}") as Record<string, unknown>;
      await putArtifactRecord({ artifactId: artifact.id, userId: user.id, collection: collection.trim(), key: key.trim(), value: parsed });
      setKey("");
      setValue("{}");
      await load();
      toast.success("record saved to this artifact");
    } catch (e) {
      toast.error("could not save that record", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, ArtifactRecord[]>();
    for (const r of records) map.set(r.collection, [...(map.get(r.collection) ?? []), r]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [records]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={`${card} p-5`}>
        <h2 className="mb-2 text-sm tracking-wide text-foreground">declared shape</h2>
        {contract.entities.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            this artifact declares no data shape yet. it cannot read your account data — that boundary is not a setting.
          </p>
        ) : (
          <ul className="space-y-2 text-[11px]">
            {contract.entities.map((e) => (
              <li key={e.name} className="rounded-lg border border-border/15 px-3 py-2">
                <p className="text-foreground/80">{e.name}</p>
                <p className="text-muted-foreground">
                  {e.fields.map((f) => `${f.name}: ${f.type}${f.required ? "" : "?"}`).join(", ")}
                </p>
                <p className="text-muted-foreground">
                  owned by the artifact owner · kept {e.retention === "session_only" ? "for the session only" : "until deleted"} ·{" "}
                  {e.access === "owner_only" ? "owner only" : "shared with collaborators"}
                </p>
              </li>
            ))}
          </ul>
        )}
        {problems.length > 0 && (
          <ul className="mt-2 space-y-1 text-[11px] text-destructive/90">
            {problems.map((p, i) => (
              <li key={`${p.entity}-${i}`}>
                {p.entity}
                {p.field ? `.${p.field}` : ""}: {p.problem}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${card} p-5`}>
        <h2 className="mb-2 text-sm tracking-wide text-foreground">stored records</h2>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : grouped.length === 0 ? (
          <p className="text-xs text-muted-foreground">this artifact holds no data yet.</p>
        ) : (
          <ul className="space-y-2">
            {grouped.map(([name, rows]) => (
              <li key={name}>
                <p className="text-[11px] text-foreground/80">
                  {name} · {rows.length} record{rows.length === 1 ? "" : "s"}
                </p>
                <ul className="mt-1 space-y-1">
                  {rows.slice(0, 20).map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/15 px-3 py-1.5 text-[11px]">
                      <span className="min-w-0 truncate">
                        <span className="text-foreground/80">{r.key}</span>{" "}
                        <span className="text-muted-foreground">{JSON.stringify(r.value)}</span>
                      </span>
                      {canWrite && (
                        <button
                          aria-label={`delete record ${r.key}`}
                          onClick={async () => {
                            await deleteArtifactRecord(r.id);
                            await load();
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}

        {canWrite && (
          <div className="mt-4 space-y-2 border-t border-border/15 pt-4">
            <input
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              placeholder="collection, e.g. inventory_items"
              aria-label="collection"
              className="w-full rounded-lg border border-border/20 bg-background/40 px-3 py-2 text-xs outline-none focus:border-primary/40"
            />
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="record key"
              aria-label="record key"
              className="w-full rounded-lg border border-border/20 bg-background/40 px-3 py-2 text-xs outline-none focus:border-primary/40"
            />
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={3}
              aria-label="record value"
              className="w-full rounded-lg border border-border/20 bg-background/40 px-3 py-2 font-mono text-[11px] outline-none focus:border-primary/40"
            />
            <button
              disabled={busy || !collection.trim() || !key.trim()}
              onClick={() => void add()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 px-3 py-1.5 text-[11px] disabled:opacity-40 hover:bg-card/40"
            >
              <Plus className="h-3.5 w-3.5" /> save record
            </button>
          </div>
        )}
      </section>

      <section className={`${card} p-5 lg:col-span-2`}>
        <h2 className="mb-2 text-sm tracking-wide text-foreground">what runs recorded</h2>
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">no runs have recorded anything yet.</p>
        ) : (
          <ul className="space-y-1.5 text-[11px]">
            {runs.slice(0, 8).map((r) => (
              <li key={r.id} className="flex items-baseline justify-between gap-3">
                <span className="text-foreground/80">
                  {r.status} · {r.scope} · {r.results.length} result{r.results.length === 1 ? "" : "s"} ·{" "}
                  {r.observations.length} observation{r.observations.length === 1 ? "" : "s"}
                </span>
                <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ArtifactDataPane;
