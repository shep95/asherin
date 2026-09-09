import * as React from "react";

/**
 * Edit these four URLs to change where each platform downloads from.
 * The component detects the visitor's OS on the client and picks the
 * matching href + label automatically.
 */
export const INSTALL_CONFIG = {
  winAppInstaller:
    "https://asherin.com/asherin.ide/install/asherin.appinstaller",
  macDmg: "https://asherin.com/asherin.ide/download/asherin-latest-mac.dmg",
  linuxAppImage:
    "https://asherin.com/asherin.ide/download/asherin-latest-linux.AppImage",
  fallback: "https://asherin.com/asherin.ide/install",
} as const;

type Platform = "windows" | "mac" | "linux" | "other";

function detectPlatform(ua: string): Platform {
  if (/Windows/i.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "other";
}

export function useInstallButton() {
  const [platform, setPlatform] = React.useState<Platform>("other");

  React.useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent));
  }, []);

  switch (platform) {
    case "windows":
      return {
        href: `ms-appinstaller:?source=${INSTALL_CONFIG.winAppInstaller}`,
        label: "install asherin.ide",
        note: "",
      };
    case "mac":
      return {
        href: INSTALL_CONFIG.macDmg,
        label: "download asherin.ide for mac",
        note: "",
      };
    case "linux":
      return {
        href: INSTALL_CONFIG.linuxAppImage,
        label: "download asherin.ide for linux",
        note: "",
      };
    default:
      return {
        href: INSTALL_CONFIG.fallback,
        label: "install asherin.ide",
        note:
          "desktop builds only. open on windows, macos, or linux to download.",
      };
  }
}

const InstallButton = () => {
  const { href, label, note } = useInstallButton();

  return (
    <div className="flex flex-col items-center gap-3">
      <a
        href={href}
        className="inline-flex items-center gap-3 rounded-xl border border-white/[0.08] bg-foreground px-6 py-3 font-mono text-xs font-medium uppercase tracking-[0.08em] text-background transition-opacity duration-200 hover:opacity-85"
        style={{
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.28, 1)",
          transitionDuration: "220ms",
        }}
      >
        {label}
        <span aria-hidden>→</span>
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
