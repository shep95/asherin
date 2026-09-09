import * as React from "react";

const InstallButton = () => {
  const [href, setHref] = React.useState('#');
  const [label, setLabel] = React.useState('install asherin.ide →');

  React.useEffect(() => {
    const ua = navigator.userAgent;
    if (/Windows/i.test(ua))                    setHref('ms-appinstaller:?source=https://asherin.ide/install/asherin.appinstaller');
    else if (/Macintosh|Mac OS X/i.test(ua))    { setHref('https://asherin.ide/install/asherin-latest.dmg'); setLabel('download for mac →'); }
    else if (/Linux/i.test(ua) && !/Android/i.test(ua)) { setHref('https://asherin.ide/install/asherin-latest.AppImage'); setLabel('download for linux →'); }
    else                                        setHref('/install');
  }, []);

  return (
    <a
      href={href}
      className="inline-flex items-center gap-3 px-6 py-3 bg-[#4ade80] text-black font-mono text-xs uppercase tracking-[0.08em] font-medium transition-opacity duration-300 hover:opacity-85 border border-white/[0.08]"
      style={{ borderRadius: 0, transitionTimingFunction: "cubic-bezier(0.16,1,0.28,1)", transitionDuration: "220ms" }}
    >
      {label}
    </a>
  );
};

export default InstallButton;
