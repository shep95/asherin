// dependency tracking for software artifacts.
//
// Dependencies are read out of the source, kept apart from the source, and
// never fetched at run time. Nothing is installed silently: an undeclared
// import is reported, not resolved.

export interface DependencyRecord {
  name: string;
  range: string;
  source: "npm" | "url" | "unknown";
  license: string | null;
  compatibility: "client_browser" | "requires_build" | "unknown";
  securityStatus: "unreviewed" | "reviewed" | "flagged";
  installationRequirement: "not_required" | "external_build_provider" | "network_permission";
  declared: boolean;
  usedIn: string[];
}

const BARE_IMPORT = /(?:^|\n)\s*import\s+(?:[\w*\s{},$]+\s+from\s+)?["']([^"'./][^"']*)["']/g;
const REQUIRE_CALL = /require\(\s*["']([^"'./][^"']*)["']\s*\)/g;
const URL_IMPORT = /(?:^|\n)\s*import\s+(?:[\w*\s{},$]+\s+from\s+)?["'](https?:\/\/[^"']+)["']/g;
const SCRIPT_SRC = /<script[^>]+src\s*=\s*["'](https?:\/\/[^"']+)["']/gi;

function packageName(specifier: string): string {
  if (specifier.startsWith("@")) return specifier.split("/").slice(0, 2).join("/");
  return specifier.split("/")[0];
}

/** Reads the dependencies a set of files actually reaches for. */
export function detectDependencies(
  files: Array<{ path: string; content: string }>,
  declared: DependencyRecord[] = [],
): DependencyRecord[] {
  const found = new Map<string, DependencyRecord>();
  const declaredByName = new Map(declared.map((d) => [d.name, d]));

  const add = (name: string, source: DependencyRecord["source"], path: string) => {
    const existing = found.get(name);
    if (existing) {
      if (!existing.usedIn.includes(path)) existing.usedIn.push(path);
      return;
    }
    const known = declaredByName.get(name);
    found.set(name, {
      name,
      range: known?.range ?? "unspecified",
      source,
      license: known?.license ?? null,
      compatibility: source === "url" ? "client_browser" : "requires_build",
      securityStatus: known?.securityStatus ?? "unreviewed",
      installationRequirement:
        source === "url" ? "network_permission" : "external_build_provider",
      declared: !!known,
      usedIn: [path],
    });
  };

  for (const file of files) {
    for (const re of [BARE_IMPORT, REQUIRE_CALL]) {
      re.lastIndex = 0;
      let m = re.exec(file.content);
      while (m) {
        if (!/^https?:\/\//.test(m[1])) add(packageName(m[1]), "npm", file.path);
        m = re.exec(file.content);
      }
    }
    for (const re of [URL_IMPORT, SCRIPT_SRC]) {
      re.lastIndex = 0;
      let m = re.exec(file.content);
      while (m) {
        add(m[1], "url", file.path);
        m = re.exec(file.content);
      }
    }
  }

  for (const d of declared) {
    if (!found.has(d.name)) found.set(d.name, { ...d, usedIn: d.usedIn ?? [] });
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface DependencyVerdict {
  runnableInSandbox: boolean;
  blocking: DependencyRecord[];
  notes: string[];
}

/** What the current runtime can honestly do with these dependencies. */
export function assessDependencies(
  deps: DependencyRecord[],
  networkPermitted: boolean,
): DependencyVerdict {
  const blocking = deps.filter(
    (d) => d.installationRequirement === "external_build_provider" || (d.source === "url" && !networkPermitted),
  );
  const notes: string[] = [];
  if (deps.some((d) => d.source === "npm")) {
    notes.push("packages cannot be installed here — this artifact needs an external build provider to run");
  }
  if (deps.some((d) => d.source === "url") && !networkPermitted) {
    notes.push("remote scripts are blocked because this artifact has no network permission");
  }
  if (deps.some((d) => !d.declared)) {
    notes.push("some dependencies appear in the code but are not declared in the manifest");
  }
  return { runnableInSandbox: blocking.length === 0, blocking, notes };
}
