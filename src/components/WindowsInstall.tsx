import * as React from "react";

const APPINSTALLER_URL = "https://asherin.com/install/asherin.appinstaller";
const MSIX_URL = "/install/asherin-x64.msix";
const MANIFEST_URL = "/updates/latest.json";

function relativeTime(iso: string): string | null {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;
  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 0) return "released just now";
  const units: Array<[number, string]> = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [2592000, "day"],
    [31536000, "month"],
  ];
  if (seconds < 60) return "released just now";
  for (let i = 1; i < units.length; i += 1) {
    const [limit] = units[i];
    if (seconds < limit) {
      const value = Math.floor(seconds / units[i - 1][0]);
      const noun = units[i - 1][1];
      return `released ${value} ${noun}${value === 1 ? "" : "s"} ago`;
    }
  }
  const years = Math.floor(seconds / 31536000);
  return `released ${years} year${years === 1 ? "" : "s"} ago`;
}

const WindowsInstall = () => {
  const [chip, setChip] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    fetch(MANIFEST_URL, { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("http " + response.status))))
      .then((data: { version?: string; releasedAt?: string }) => {
        if (cancelled || !data?.version) return;
        const when = data.releasedAt ? relativeTime(data.releasedAt) : null;
        setChip(when ? `v${data.version} · ${when}` : `v${data.version}`);
      })
      .catch(() => {
        /* chip stays hidden */
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return (
    <div className="relative w-full max-w-xl">
      {chip && (
        <span className="absolute right-0 -top-7 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {chip}
        </span>
      )}

      <div className="flex flex-col items-center gap-4">
        <div className="flex flex-wrap items-center justify-center gap-5">
          <a
            href={`ms-appinstaller:?source=${APPINSTALLER_URL}`}
            className="inline-flex items-center rounded-xl border border-white/[0.08] bg-white/[0.04] px-6 py-3 font-mono text-xs uppercase tracking-[0.08em] text-foreground transition-colors duration-200 hover:bg-white/[0.07]"
          >
            download for windows
          </a>
          <a
            href={MSIX_URL}
            className="font-mono text-xs lowercase tracking-[0.04em] text-muted-foreground underline underline-offset-4 transition-colors duration-200 hover:text-foreground"
          >
            direct .msix
          </a>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          windows 10 · 11 · one-click install · auto-updates
        </p>
      </div>
    </div>
  );
};

export default WindowsInstall;
