import * as React from "react";

const DOWNLOADS = {
  windows: {
    url: "/asherin.ide/install/asherin-ide-windows-x64.zip",
    label: "download for windows",
  },
  mac: {
    url: "/asherin.ide/install/asherin-ide-macos-x64.zip",
    label: "download for mac",
  },
  linux: {
    url: "/asherin.ide/install/asherin-ide-linux-x64.tar.gz",
    label: "download for linux",
  },
};

export function useInstallButton() {
  const [href, setHref] = React.useState("/asherin.ide/");
  const [label, setLabel] = React.useState("install asherin.ide →");
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    const ua = navigator.userAgent;
    if (/Windows/i.test(ua)) {
      setHref(DOWNLOADS.windows.url);
      setLabel(DOWNLOADS.windows.label + " →");
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      setHref(DOWNLOADS.mac.url);
      setLabel(DOWNLOADS.mac.label + " →");
    } else if (/Linux/i.test(ua) && !/Android/i.test(ua)) {
      setHref(DOWNLOADS.linux.url);
      setLabel(DOWNLOADS.linux.label + " →");
    } else {
      setHref("/asherin.ide/");
      setLabel("get asherin.ide →");
      setNote("desktop builds only. open on windows, macos, or linux to download.");
    }
  }, []);

  return { href, label, note };
}

const InstallButton = () => {
  const { href, label, note } = useInstallButton();
  return (
    <div className="flex flex-col items-center gap-3">
      <a
        href={href}
        className="inline-flex items-center gap-3 px-6 py-3 bg-foreground text-background font-mono text-xs uppercase tracking-[0.08em] font-medium transition-opacity duration-300 hover:opacity-85 border border-white/[0.08] rounded-xl"
        style={{
          transitionTimingFunction: "cubic-bezier(0.16,1,0.28,1)",
          transitionDuration: "220ms",
        }}
      >
        {label}
      </a>
      {note && (
        <p className="max-w-xs text-center font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
};

export default InstallButton;
