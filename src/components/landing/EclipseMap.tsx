import { useState } from "react";
import { Sun, Moon } from "lucide-react";

interface EclipsePathData {
  id: string;
  date: string;
  type: "solar" | "lunar";
  label: string;
  path: string; // SVG path
  cities: { name: string; x: number; y: number }[];
  color: string;
  info: string;
}

const ECLIPSE_PATHS: EclipsePathData[] = [
  {
    id: "lunar-2026",
    date: "Mar 3, 2026",
    type: "lunar",
    label: "Total Lunar, Western Instability",
    path: "M 80,160 Q 200,120 320,140 Q 440,160 520,170",
    cities: [
      { name: "Washington D.C.", x: 170, y: 155 },
      { name: "London", x: 355, y: 130 },
      { name: "Madrid", x: 340, y: 148 },
    ],
    color: "hsl(275, 95%, 43%)",
    info: "Visible across Americas, Europe, Africa. Leo/Aquarius axis = government confidence vs revolutionary forces. Trigger fires Apr-May 2026.",
  },
  {
    id: "solar-2028",
    date: "Aug 2, 2028",
    type: "solar",
    label: "Total Solar, Arab World Collapse",
    path: "M 330,155 Q 370,150 410,148 Q 450,146 490,155 Q 520,162 550,175",
    cities: [
      { name: "Rabat", x: 340, y: 152 },
      { name: "Algiers", x: 360, y: 147 },
      { name: "Tunis", x: 370, y: 146 },
      { name: "Tripoli", x: 385, y: 148 },
      { name: "Cairo", x: 410, y: 152 },
      { name: "Riyadh", x: 465, y: 162 },
    ],
    color: "hsl(0, 84%, 60%)",
    info: "6m 22s totality, ~6 years of effect (2028-2034). The most powerful eclipse of the decade. Entire Arab world leadership enters King Killer window.",
  },
  {
    id: "lunar-2028",
    date: "Jan 26, 2028",
    type: "lunar",
    label: "Total Lunar, Pacific Theater Activation",
    path: "M 520,155 Q 580,140 640,150 Q 700,160 730,175",
    cities: [
      { name: "Beijing", x: 610, y: 140 },
      { name: "Taipei", x: 625, y: 162 },
      { name: "Tokyo", x: 650, y: 145 },
    ],
    color: "hsl(275, 70%, 55%)",
    info: "Visible across Asia, Australia, Pacific. China/Taiwan axis activated. Trigger fires Feb-Mar 2028.",
  },
  {
    id: "solar-2028",
    date: "Jul 22, 2028",
    type: "solar",
    label: "Total Solar, Pacific Escalation",
    path: "M 660,190 Q 690,195 720,200 Q 735,210 740,220",
    cities: [
      { name: "Sydney", x: 700, y: 225 },
      { name: "Auckland", x: 740, y: 235 },
    ],
    color: "hsl(25, 90%, 55%)",
    info: "2m 13s totality. Australia, New Zealand, Pacific. Military theater escalation. Trigger fires Sep-Oct 2028.",
  },
  {
    id: "solar-2030",
    date: "Jun 1, 2030",
    type: "solar",
    label: "Total Solar, European Detonator",
    path: "M 310,145 Q 330,140 350,142 Q 370,148 390,155",
    cities: [
      { name: "Madrid", x: 340, y: 148 },
      { name: "Lisbon", x: 328, y: 150 },
    ],
    color: "hsl(40, 90%, 55%)",
    info: "3m 44s totality, ~3.5 years effect. Madrid directly struck. Spanish government enters King Killer Protocol.",
  },
];

// Simplified world map SVG paths (continents)
const CONTINENTS = [
  // North America
  "M 60,100 Q 80,85 120,90 Q 160,80 180,100 Q 195,105 200,120 Q 190,140 175,155 Q 160,170 140,175 Q 120,180 100,175 Q 80,165 70,150 Q 60,135 55,120 Z",
  // South America  
  "M 155,195 Q 170,185 180,195 Q 190,210 195,230 Q 195,250 185,265 Q 175,275 165,270 Q 155,260 150,240 Q 148,220 150,205 Z",
  // Europe
  "M 340,100 Q 355,95 370,100 Q 385,105 390,115 Q 388,125 380,130 Q 370,135 355,132 Q 345,128 340,120 Q 338,110 340,100 Z",
  // Africa
  "M 340,155 Q 360,145 380,148 Q 400,155 410,170 Q 415,190 410,210 Q 400,230 385,240 Q 370,245 355,235 Q 345,220 340,200 Q 338,180 340,165 Z",
  // Asia
  "M 400,90 Q 440,80 490,85 Q 540,80 580,90 Q 620,95 650,110 Q 660,125 650,140 Q 630,150 600,155 Q 560,160 520,155 Q 480,150 450,140 Q 420,130 410,115 Q 400,105 400,90 Z",
  // Middle East
  "M 410,135 Q 430,130 460,135 Q 480,145 475,160 Q 460,165 440,162 Q 425,155 415,145 Z",
  // Australia
  "M 640,210 Q 670,200 700,205 Q 720,215 725,230 Q 715,240 695,245 Q 670,240 655,230 Q 645,220 640,210 Z",
  // India
  "M 510,145 Q 525,140 535,150 Q 530,170 520,180 Q 510,175 505,160 Z",
];

const EclipseMap = () => {
  const [activeEclipse, setActiveEclipse] = useState<string | null>("solar-2028");
  const active = ECLIPSE_PATHS.find((e) => e.id === activeEclipse);

  return (
    <div className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md overflow-hidden">
      {/* Map */}
      <div className="relative">
        <svg viewBox="0 0 800 300" className="w-full h-auto" style={{ minHeight: 260 }}>
          {/* Grid lines */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line key={`vg-${i}`} x1={i * 100} y1={0} x2={i * 100} y2={300} stroke="hsl(0 0% 14%)" strokeWidth={0.5} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <line key={`hg-${i}`} x1={0} y1={i * 100} x2={800} y2={300} stroke="hsl(0 0% 14%)" strokeWidth={0.5} />
          ))}
          {/* Equator */}
          <line x1={0} y1={175} x2={800} y2={175} stroke="hsl(0 0% 20%)" strokeWidth={0.5} strokeDasharray="4 4" />

          {/* Continents */}
          {CONTINENTS.map((d, i) => (
            <path key={i} d={d} fill="hsl(0 0% 12%)" stroke="hsl(0 0% 22%)" strokeWidth={0.5} />
          ))}

          {/* Eclipse paths */}
          {ECLIPSE_PATHS.map((ep) => (
            <g key={ep.id} className="cursor-pointer" onClick={() => setActiveEclipse(ep.id)}>
              <path
                d={ep.path}
                fill="none"
                stroke={ep.color}
                strokeWidth={activeEclipse === ep.id ? 3 : 1.5}
                opacity={activeEclipse === ep.id ? 1 : 0.3}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
              {/* Glow effect for active */}
              {activeEclipse === ep.id && (
                <path
                  d={ep.path}
                  fill="none"
                  stroke={ep.color}
                  strokeWidth={8}
                  opacity={0.15}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              )}
            </g>
          ))}

          {/* City markers for active eclipse */}
          {active?.cities.map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r={3} fill={active.color} opacity={0.8} />
              <circle cx={c.x} cy={c.y} r={6} fill={active.color} opacity={0.15} />
              <text x={c.x} y={c.y - 8} textAnchor="middle" fill="hsl(0 0% 92%)" fontSize={6} fontWeight={300} opacity={0.7}>
                {c.name}
              </text>
            </g>
          ))}
        </svg>

        {/* Active eclipse info overlay */}
        {active && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-4 sm:right-auto sm:max-w-sm rounded-xl border border-border/20 bg-card/80 backdrop-blur-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              {active.type === "solar" ? <Sun className="h-3 w-3" style={{ color: active.color }} /> : <Moon className="h-3 w-3" style={{ color: active.color }} />}
              <span className="text-[10px] font-light tracking-wider text-foreground">{active.date}</span>
              <span className="text-[9px] font-extralight text-muted-foreground/50">•</span>
              <span className="text-[10px] font-extralight text-muted-foreground">{active.label}</span>
            </div>
            <p className="text-[10px] font-extralight text-muted-foreground leading-relaxed">{active.info}</p>
          </div>
        )}
      </div>

      {/* Eclipse selector tabs */}
      <div className="flex flex-wrap gap-1.5 px-4 py-3 border-t border-border/10">
        {ECLIPSE_PATHS.map((ep) => (
          <button
            key={ep.id}
            onClick={() => setActiveEclipse(ep.id)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-light tracking-wide transition-all ${
              activeEclipse === ep.id
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            {ep.type === "solar" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
            {ep.date}
          </button>
        ))}
      </div>
    </div>
  );
};

export default EclipseMap;
