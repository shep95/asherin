import { useEffect, useState } from "react";

// 30 real sources Zophiel pulls from. Order is shuffled in-memory each mount
// so the ambient strip never repeats the same lineup twice.
const SOURCES = [
  "Reuters", "BBC", "AP", "Bloomberg", "FT", "WSJ", "The Guardian",
  "Al Jazeera", "Xinhua", "TASS", "ICIJ", "OCCRP", "Bellingcat",
  "Wikileaks", "DDoSecrets", "WHO", "IMF", "World Bank", "OECD",
  "SEC EDGAR", "Companies House", "OpenSanctions", "OFAC",
  "gov.uk", "europa.eu", "data.gov", "Pew Research", "RAND",
  "arXiv", "PubMed", "Nature",
];

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

interface Props {
  className?: string;
}

const ZophielSourcePulse = ({ className }: Props) => {
  const [order, setOrder] = useState<string[]>(() => shuffle(SOURCES));

  useEffect(() => {
    const t = setInterval(() => setOrder((o) => shuffle(o)), 12_000);
    return () => clearInterval(t);
  }, []);

  // Duplicate for seamless marquee
  const loop = [...order, ...order];

  return (
    <div
      className={`relative overflow-hidden mask-fade-x ${className ?? ""}`}
      aria-hidden
    >
      <div
        className="flex items-center gap-6 whitespace-nowrap will-change-transform animate-[zophiel-marquee_60s_linear_infinite]"
      >
        {loop.map((src, i) => (
          <span
            key={`${src}-${i}`}
            className="inline-flex items-center gap-1.5 text-[10px] font-light tracking-[0.18em] text-muted-foreground/45 uppercase"
          >
            <span className="relative flex h-1 w-1">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/40" />
              <span className="relative inline-flex h-1 w-1 rounded-full bg-emerald-400/70" />
            </span>
            {src}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ZophielSourcePulse;
