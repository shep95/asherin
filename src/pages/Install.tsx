import WindowsInstall from "@/components/WindowsInstall";
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
          one click installs the desktop editor through windows itself and keeps
          it updated. if your browser blocks the install handler, use the direct
          package link instead.
        </p>
        <div className="mt-16 flex w-full justify-center">
          <WindowsInstall />
        </div>
        <p className="mt-10 max-w-xl text-sm leading-relaxed text-muted-foreground">
          the package on the server is still a placeholder file, so windows will
          report a parsing error until the signed build is uploaded.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
};

export default InstallPage;
