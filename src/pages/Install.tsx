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
          download the archive for your platform, extract it, and run the app.
          windows users: open <code className="font-mono text-sm">asherin ide.exe</code> inside the folder.
          mac/linux users: run the bundled executable from the extracted folder.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4">
          <InstallButton />
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            windows · macos · linux · zip / tar.gz · no installer needed
          </p>
        </div>
        <p className="mt-8 max-w-xl text-sm leading-relaxed text-muted-foreground">
          the windows build is not code-signed, so smartscreen may show a warning.
          click “more info” then “run anyway” to launch. signed installers will
          replace these archives once the release certificate is ready.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
};

export default InstallPage;
