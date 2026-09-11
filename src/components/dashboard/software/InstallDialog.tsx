// “Add to Asherin” — the deliberate step between having built something and
// having it in your dashboard.
//
// Nothing installs because an artifact exists. A person walks through what the
// app is, what it may do, where it lands, and only then confirms. A blocker in
// preflight stops the walk; it is never styled away.

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck, X } from "lucide-react";
import type { PreflightReport } from "@/lib/software/install";
import type { NavigationItem, PermissionManifest, SoftwareArtifact, SoftwareVersion } from "@/lib/software/types";
import { SECTION_LABEL, appRoute } from "@/lib/software/navigation";

const card = "rounded-xl border border-border/20 bg-card/30";

export interface InstallChoice {
  installedName: string;
  icon: string | null;
  section: NavigationItem["section"];
  grants: PermissionManifest;
  configuration: Record<string, unknown>;
}

const STEPS = ["preflight", "identity", "permissions", "data", "location", "confirm"] as const;
type Step = (typeof STEPS)[number];

const STEP_TITLE: Record<Step, string> = {
  preflight: "checks before installing",
  identity: "name and icon",
  permissions: "what it may do",
  data: "integrations and data",
  location: "where it goes",
  confirm: "confirm",
};

const InstallDialog = ({
  artifact,
  version,
  preflight,
  busy,
  onCancel,
  onConfirm,
}: {
  artifact: SoftwareArtifact;
  version: SoftwareVersion | null;
  preflight: PreflightReport | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (choice: InstallChoice) => void;
}) => {
  const [step, setStep] = useState<Step>("preflight");
  const [name, setName] = useState(artifact.displayName);
  const [icon, setIcon] = useState(artifact.icon ?? "");
  const [section, setSection] = useState<NavigationItem["section"]>("installed");
  const [accepted, setAccepted] = useState(false);

  const blockers = useMemo(() => preflight?.items.filter((i) => i.state === "fail") ?? [], [preflight]);
  const held = useMemo(() => preflight?.items.filter((i) => i.state === "unavailable") ?? [], [preflight]);
  const blocked = !preflight || blockers.length > 0 || held.length > 0;

  const index = STEPS.indexOf(step);
  const canForward = step === "preflight" ? !blocked : step !== "confirm";

  const grants: PermissionManifest = {
    ...artifact.permissionManifest,
    granted: artifact.permissionManifest.granted,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" role="dialog" aria-modal="true" aria-label="add to asherin">
      <div className={`${card} w-full max-w-xl overflow-hidden bg-background/95`}>
        <header className="flex items-center justify-between border-b border-border/20 px-5 py-3">
          <div>
            <h2 className="text-sm tracking-wide text-foreground">add to asherin</h2>
            <p className="text-[11px] text-muted-foreground">
              step {index + 1} of {STEPS.length} — {STEP_TITLE[step]}
            </p>
          </div>
          <button aria-label="close" onClick={onCancel} className="rounded-lg border border-border/25 p-1.5 hover:bg-card/40">
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4 text-xs">
          {step === "preflight" && (
            <>
              <p className="text-[11px] text-muted-foreground">
                {artifact.displayName} · {version ? `v${version.displayVersion}` : "no version saved yet"} ·{" "}
                {artifact.runtimeType.replace("_", " ")}
              </p>
              <p className="text-[11px] text-muted-foreground">identity {artifact.id}</p>
              <ul className="space-y-1">
                {(preflight?.items ?? []).map((i) => (
                  <li key={i.id} className="flex items-start gap-2">
                    {i.state === "pass" ? (
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400/90" />
                    )}
                    <span className={i.state === "pass" ? "text-foreground/80" : "text-amber-400/90"}>
                      {i.label} — {i.detail}
                    </span>
                  </li>
                ))}
              </ul>
              {blocked && (
                <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-2 text-[11px] text-amber-400/90">
                  {preflight?.summary ?? "preflight has not run yet"} — installing stays blocked until this clears.
                </p>
              )}
            </>
          )}

          {step === "identity" && (
            <>
              <label className="block text-[11px] text-muted-foreground">
                what you want to call it here
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="installed name"
                  className="mt-1 w-full rounded-lg border border-border/25 bg-background/40 p-2 text-xs outline-none focus:border-primary/40"
                />
              </label>
              <label className="block text-[11px] text-muted-foreground">
                icon (a character or short symbol)
                <input
                  value={icon}
                  onChange={(e) => setIcon(e.target.value.slice(0, 4))}
                  aria-label="installed icon"
                  className="mt-1 w-24 rounded-lg border border-border/25 bg-background/40 p-2 text-xs outline-none focus:border-primary/40"
                />
              </label>
              <p className="text-[11px] text-muted-foreground">{artifact.description || "no description"}</p>
              <p className="text-[11px] text-muted-foreground">
                the name is a label. renaming it later never changes its address, its permissions or its data.
              </p>
            </>
          )}

          {step === "permissions" && (
            <>
              <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> least privilege — only what is listed is granted.
              </p>
              <ul className="space-y-1">
                {grants.granted.length === 0 ? (
                  <li className="text-foreground/80">nothing requested — it runs with no extra access</li>
                ) : (
                  grants.granted.map((g) => (
                    <li key={g} className="text-foreground/80">
                      {g}
                      {grants.rationale?.[g] ? ` — ${grants.rationale[g]}` : ""}
                    </li>
                  ))
                )}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                if a later update asks for something new, it stops and asks you first.
              </p>
            </>
          )}

          {step === "data" && (
            <>
              <p className="text-[11px] text-muted-foreground">
                integrations declared: {artifact.integrationManifest.length || "none"}
              </p>
              <ul className="space-y-1 text-foreground/80">
                {artifact.integrationManifest.map((i, n) => (
                  <li key={i.id ?? n}>{i.provider} — {i.kind}{i.authenticationRequired ? " · needs a connected account" : ""}</li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground">
                dependencies declared: {artifact.dependencyManifest.length || "none"}. nothing is downloaded at run
                time.
              </p>
              <p className="text-[11px] text-muted-foreground">
                data: this app reads and writes only its own rows (artifact:{artifact.id.slice(0, 8)}…). it cannot see
                another app's data or the rest of your account.
              </p>
            </>
          )}

          {step === "location" && (
            <>
              <p className="text-[11px] text-muted-foreground">which part of your sidebar it belongs in</p>
              <div className="flex flex-wrap gap-2">
                {(["installed", "shared"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSection(s)}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      section === s ? "border-primary/50 text-primary" : "border-border/25 text-muted-foreground"
                    }`}
                  >
                    {SECTION_LABEL[s]}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">it opens at {appRoute(artifact.id)}</p>
            </>
          )}

          {step === "confirm" && (
            <>
              <ul className="space-y-1 text-foreground/80">
                <li>name here — {name.trim() || artifact.displayName}</li>
                <li>version — {version ? `v${version.displayVersion}` : "none saved yet"}</li>
                <li>permissions — {grants.granted.length ? grants.granted.join(", ") : "none"}</li>
                <li>sidebar — {SECTION_LABEL[section]}</li>
                <li>address — {appRoute(artifact.id)}</li>
              </ul>
              <label className="flex items-start gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={accepted}
                  aria-label="i understand what this installs"
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5"
                />
                i want this added to my dashboard with the access listed above.
              </label>
            </>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-border/20 px-5 py-3">
          <button
            onClick={() => setStep(STEPS[Math.max(0, index - 1)])}
            disabled={index === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/25 px-3 py-1.5 text-xs disabled:opacity-30 hover:bg-card/40"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> back
          </button>
          {step === "confirm" ? (
            <button
              disabled={!accepted || busy || blocked}
              onClick={() =>
                onConfirm({
                  installedName: name.trim() || artifact.displayName,
                  icon: icon.trim() || null,
                  section,
                  grants,
                  configuration: {},
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-xs text-primary disabled:opacity-40 hover:bg-primary/10"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} install
            </button>
          ) : (
            <button
              disabled={!canForward}
              onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, index + 1)])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-xs text-primary disabled:opacity-30 hover:bg-primary/10"
            >
              continue <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default InstallDialog;
