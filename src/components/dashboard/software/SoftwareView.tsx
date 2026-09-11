// asherin.software — the list of things you have made.
//
// It shows real records only: an artifact appears here because it exists in
// your account, with the status, version and visibility it actually holds.

import { useState } from "react";
import { Boxes, Loader2, Plus } from "lucide-react";
import { useSoftwareRegistry } from "@/contexts/SoftwareContext";
import ArtifactStatusBadge from "./ArtifactStatusBadge";

const card = "rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm";

const SoftwareView = ({ onOpen }: { onOpen: (artifactId: string) => void }) => {
  const { artifacts, installations, loading, error, create } = useSoftwareRegistry();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const submit = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    const made = await create(name.trim());
    setCreating(false);
    setName("");
    if (made) onOpen(made.id);
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-extralight tracking-wide text-foreground">
          <Boxes className="h-5 w-5 text-primary" /> asherin.software
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          everything you build lives here as its own record — versioned, owned by you, and only in your sidebar when you
          install it.
        </p>
      </header>

      <div className={`${card} mb-5 flex flex-wrap items-center gap-2 p-4`}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="name what you want to build"
          className="min-w-0 flex-1 rounded-lg border border-border/25 bg-transparent px-3 py-2 text-sm outline-none focus:border-primary/40"
        />
        <button
          onClick={submit}
          disabled={!name.trim() || creating}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/40 px-3 py-2 text-xs text-primary disabled:opacity-40 hover:bg-primary/10"
        >
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} new artifact
        </button>
      </div>

      {error && <div className={`${card} mb-4 p-4 text-xs text-destructive`}>{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> loading your software
        </div>
      ) : artifacts.length === 0 ? (
        <div className={`${card} p-6 text-sm text-muted-foreground`}>
          nothing built yet. name something above, or ask asherin in chat to build it and keep the result here.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {artifacts.map((a) => {
            const installed = installations.some((i) => i.artifactId === a.id);
            return (
              <li key={a.id}>
                <button
                  onClick={() => onOpen(a.id)}
                  className={`${card} w-full p-4 text-left transition-colors hover:border-primary/30`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm text-foreground">{a.displayName}</span>
                    <ArtifactStatusBadge status={a.lifecycle} />
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {a.description || "no description"}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {a.type} · {a.visibility} · {installed ? "installed" : "not installed"}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SoftwareView;
