import InstallButton from "@/components/InstallButton";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";

const InstallPage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 pt-24 pb-16 text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-muted-foreground">
          asherin.ide · desktop
        </p>
        <h1 className="mt-6 font-display text-5xl sm:text-6xl font-light tracking-[-0.02em] leading-[1.02]">
          install asherin.ide
        </h1>
        <p
          className="mt-8 max-w-xl text-lg leading-relaxed text-foreground/85"
          style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}
        >
          clicking install opens a native windows popup asking to confirm. no zip, no download step.
          installs in under 15 seconds. every launch checks for updates silently in the background.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <InstallButton />
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            windows · macOS · linux · one click, native install, auto-updates
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default InstallPage;
