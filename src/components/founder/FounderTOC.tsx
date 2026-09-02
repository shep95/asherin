import { useEffect, useState } from "react";

/**
 * Sticky right-edge Table of Contents for the Founder's page.
 * Highlights the active section as the visitor scrolls.
 * Desktop only — collapses on mobile / tablet.
 */
const sections: { id: string; label: string }[] = [
  { id: "top", label: "Asher" },
  { id: "genesis", label: "Genesis" },
  { id: "story", label: "The Story" },
  { id: "humanity", label: "For Humanity" },
  { id: "manifesto", label: "The Wound of Worship" },
  { id: "note", label: "A Personal Note" },

  { id: "videos", label: "The Archives" },

  { id: "imagines", label: "The Teachings" },
];

const FounderTOC = () => {
  const [active, setActive] = useState<string>("top");

  useEffect(() => {
    const onScroll = () => {
      let current = "top";
      for (const s of sections) {
        const el = s.id === "top" ? document.body : document.getElementById(s.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= 180) current = s.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      aria-label="Founder page sections"
      className="hidden xl:flex fixed right-6 top-1/2 -translate-y-1/2 z-30 flex-col gap-1.5 pl-3 border-l border-foreground/10"
    >
      {sections.map((s) => {
        const isActive = active === s.id;
        return (
          <a
            key={s.id}
            href={`#${s.id}`}
            onClick={(e) => {
              if (s.id === "top") {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else {
                e.preventDefault();
                document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
            className={`group flex items-center gap-2.5 py-1 text-[10px] tracking-[0.28em] uppercase font-mono transition-colors ${
              isActive ? "text-amber-200" : "text-foreground/40 hover:text-foreground/80"
            }`}
          >
            <span
              className={`h-px transition-all duration-300 ${
                isActive ? "w-6 bg-amber-300" : "w-2.5 bg-foreground/30 group-hover:w-4"
              }`}
            />
            {s.label}
          </a>
        );
      })}
    </nav>
  );
};

export default FounderTOC;
