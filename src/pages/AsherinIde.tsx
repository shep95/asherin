import { useEffect } from "react";

/**
 * asherin.ide is served as a standalone static site from public/asherin.ide/.
 * In dev/preview the Vite middleware and the published _redirects both serve
 * it before the SPA, so this route only fires as a fallback for client-side
 * navigation — it hands off to the static page with a full document load.
 */
const AsherinIde = () => {
  useEffect(() => {
    window.location.replace("/asherin.ide/");
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="text-sm font-extralight tracking-[0.22em] uppercase text-muted-foreground">
        opening asherin.ide…
      </p>
      <a
        href="/asherin.ide/"
        className="text-xs font-light text-muted-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline"
      >
        continue to asherin.ide
      </a>
    </main>
  );
};

export default AsherinIde;
