import { Sun, Moon, Crosshair, Clock, Skull, CheckCircle } from "lucide-react";
import EclipseMap from "./EclipseMap";

const eclipseRules = [
  {
    icon: Crosshair,
    title: "Rule 1, The Shadow Path Is The Target Zone",
    points: [
      "The eclipse only affects nations where the shadow physically crosses",
      "Path of totality over a nation's capital city, that government is marked",
      "Nations outside the shadow path, zero effect",
      "This is not metaphor. This is geometric targeting",
    ],
  },
  {
    icon: Clock,
    title: "Rule 2, Duration Calculates The Damage Window",
    points: [
      "Solar Eclipse: Every 1 hour of totality = 1 full year of geopolitical effect",
      "Lunar Eclipse: Every 1 hour = 1 month of effect",
      "A 3-hour solar eclipse = 3 years of activated chaos in the shadow zone",
      "The event does NOT happen on eclipse day, it happens when Mars or Saturn hits the trigger degree",
    ],
  },
  {
    icon: Skull,
    title: "Rule 3, The King Killer Protocol",
    points: [
      "If the eclipse falls in the 10th house of a sitting leader's birth chart",
      "That leader loses power or dies within the eclipse window",
      "No exceptions in the historical record",
    ],
  },
];

const eclipses = [
  {
    emoji: "☀️",
    id: "solar-2028",
    title: "Solar Eclipse: August 2, 2028",
    subtitle: "THE MOST POWERFUL ECLIPSE OF THE DECADE",
    data: [
      { label: "Type", value: "Total Solar Eclipse" },
      { label: "Duration of Totality", value: "6 minutes 22 seconds, one of the longest of the 21st century" },
      { label: "Effect Window", value: "~6 years (2028-2034)" },
      { label: "Path of Totality", value: "Morocco → Algeria → Tunisia → Libya → Egypt → Saudi Arabia → Yemen → Somalia" },
      { label: "Capital Cities In Path", value: "Rabat, Algiers, Tunis, Tripoli" },
    ],
    shadow: [
      "North Africa, the entire Maghreb region, sits directly under totality",
      "Saudi Arabia receives 95%+ coverage, Riyadh narrowly escapes full totality",
      "The entire Arab world leadership enters the King Killer window simultaneously",
    ],
    trigger: "Eclipse degree: ~10° Leo. Mars transits 10° Leo: October-November 2028. That 60-90 day window = maximum detonation probability.",
    read: [
      "Multiple North African and Middle Eastern governments destabilize 2028-2030",
      "Saudi leadership faces its most dangerous internal challenge",
      "Arab world fractures further, accelerating the Middle Eastern front of WW3",
    ],
    severity: "critical",
  },
  {
    emoji: "☀️",
    id: "solar-2030",
    title: "Solar Eclipse: June 1, 2030",
    subtitle: "THE EUROPEAN DETONATOR",
    data: [
      { label: "Type", value: "Total Solar Eclipse" },
      { label: "Duration", value: "Approximately 3 minutes 44 seconds" },
      { label: "Effect Window", value: "~3.5 years (2030-2033)" },
      { label: "Path of Totality", value: "Spain, Portugal, North Africa" },
      { label: "Capital Cities In Path", value: "Madrid (Spain) directly in totality path" },
    ],
    shadow: [],
    trigger: "",
    read: [
      "Spain, a NATO member, has its capital city directly struck",
      "Spanish government enters King Killer Protocol, leadership change or collapse within 3.5 years",
      "Spain becomes pivot point for new European political architecture",
    ],
    severity: "high",
  },
  {
    emoji: "🌕",
    id: "lunar-2026",
    title: "Total Lunar Eclipse: March 3, 2026",
    subtitle: "THE IMMEDIATE TRIGGER, ALREADY LOADING",
    data: [
      { label: "Type", value: "Total Lunar Eclipse" },
      { label: "Duration", value: "Approximately 1 hour 17 minutes" },
      { label: "Effect Window", value: "~1-2 months of acute effect" },
      { label: "Visible From", value: "Americas, Europe, Africa, West Asia" },
      { label: "Nakshatra", value: "Leo/Aquarius axis, government confidence and equity markets" },
    ],
    shadow: [
      "This eclipse is the closest detonator to NOW",
      "Visible across the entire Western world and Europe",
      "Leo/Aquarius axis = government leadership vs. revolutionary forces",
    ],
    trigger: "Mars trigger fires: approximately April-May 2026. Watch: political instability in Western governments April-June 2026.",
    read: [],
    severity: "critical",
  },
  {
    emoji: "☀️",
    id: "solar-2026",
    title: "Solar Eclipse: February 17, 2026",
    subtitle: "THE SOUTHERN HEMISPHERE STRIKE",
    data: [
      { label: "Type", value: "Annular Solar Eclipse" },
      { label: "Path", value: "Antarctica, Southern Ocean, South America tip" },
      { label: "Capital Cities", value: "No major capitals directly hit" },
      { label: "Effect", value: "Lower intensity, Southern hemisphere financial markets minor disruption" },
    ],
    shadow: [],
    trigger: "",
    read: ["Lower priority target. Not the main weapon."],
    severity: "low",
  },
];

const historicalProofs = [
  {
    title: "The 2008 Financial Collapse",
    points: [
      "Solar Eclipse: August 1, 2008, path crossed China, Russia, Central Asia",
      "Eclipse degree: financial axis",
      "Mars crossed the eclipse degree: September 15, 2008",
      "Lehman Brothers filed bankruptcy: September 15, 2008",
    ],
    verdict: "Zero days difference. Mars hit the trigger. The weapon fired.",
  },
  {
    title: "FTX Crypto Collapse 2022",
    points: [
      "Total Lunar Eclipse: November 8, 2022",
      "Eclipse degree: Taurus, the store of value sign",
      "FTX collapse began its public acceleration: November 8, 2022",
      "The eclipse fired on the same day because the trigger planet was already at the degree",
    ],
    verdict: "$32 billion evaporated in 72 hours.",
  },
  {
    title: "Brexit & Political Chaos 2019-2020",
    points: [
      "Solar Eclipse: July 2, 2019, path crossed South America",
      "Partial eclipse visible across Europe at 30-40% coverage",
      "Effect window activated UK political system",
      "Boris Johnson became PM: July 24, 2019, 22 days after eclipse",
    ],
    verdict: "UK Parliament suspended, constitutional crisis, snap elections, all within the eclipse window.",
  },
];

const masterTimeline = [
  { date: "Mar 3, 2026", type: "Total Lunar", duration: "1h 17m", path: "Americas, Europe, Africa", target: "Western government instability", trigger: "Apr-May 2026" },
  { date: "Aug 2, 2028", type: "Total Solar", duration: "6m 22s", path: "Morocco, Algeria, Libya, Saudi Arabia", target: "Arab world leadership collapse", trigger: "Oct-Nov 2028" },
  { date: "Jan 26, 2028", type: "Total Lunar", duration: "1h 17m", path: "Asia, Australia, Pacific", target: "Pacific theater, China/Taiwan axis activated", trigger: "Feb-Mar 2028" },
  { date: "Jul 22, 2028", type: "Total Solar", duration: "2m 13s", path: "Australia, New Zealand, Pacific", target: "Pacific military theater escalation", trigger: "Sep-Oct 2028" },
  { date: "Jun 1, 2030", type: "Total Solar", duration: "3m 44s", path: "Spain, Portugal, North Africa", target: "Madrid, European architecture collapse", trigger: "Aug-Sep 2030" },
];

const EclipseWeaponsSection = () => (
  <section className="relative z-10 px-6 py-24">
    {/* Header */}
    <div className="mx-auto max-w-4xl text-center mb-16">
      <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/40 uppercase mb-4">
        Accessing Zero-Point Field... Eclipse Detonator Map Uploading...
      </p>
      <div className="rounded-full border border-destructive/30 bg-destructive/5 backdrop-blur-md px-4 py-1.5 mb-8 inline-block">
        <span className="text-[10px] font-light tracking-[0.3em] text-destructive uppercase">🔴 Classified: The Eclipse Weapons Manual</span>
      </div>
      <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
        What Eclipses Do, Where They Hit
        <br />
        <span className="text-muted-foreground">When They Detonate</span>
      </h2>
      <p className="text-xs font-extralight text-muted-foreground/50">
        ZOPHIEL | ASHERIN TRUTH ENGINE · This is the system elites use that mainstream science ignores.
      </p>
    </div>

    {/* PART 1, What Is An Eclipse */}
    <div className="mx-auto max-w-4xl mb-16">
      <h3 className="text-lg font-extralight tracking-wide text-foreground mb-2">Part 1, What Is An Eclipse Actually Doing</h3>
      <div className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-6 sm:p-8 mb-6">
        <p className="text-xs font-extralight text-muted-foreground mb-2">
          <span className="text-foreground/50 italic">The Disney Truth:</span> "An eclipse is just the Moon blocking the Sun. Cool to look at."
        </p>
        <p className="text-xs font-light text-foreground mb-4">The Deep State Truth:</p>
        <p className="text-xs font-extralight text-muted-foreground leading-relaxed mb-4">
          An eclipse is a <span className="text-foreground font-light">charged weapon being loaded into a specific degree of the sky.</span>
        </p>
        <div className="rounded-xl bg-accent/5 border border-accent/15 p-4 text-center">
          <p className="text-xs font-extralight text-muted-foreground leading-relaxed">
            The eclipse is the <span className="text-foreground">bullet being chambered</span>. Mars or Saturn crossing that same degree later, is the <span className="text-foreground">trigger being pulled</span>. The target is whatever nation, city, or leader sits under the shadow path.
          </p>
        </div>
      </div>

      {/* Three Rules */}
      <div className="space-y-4">
        {eclipseRules.map((rule, i) => (
          <div key={i} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 border border-destructive/20">
                <rule.icon className="h-4 w-4 text-destructive" />
              </div>
              <h4 className="text-sm font-light tracking-wide text-foreground">{rule.title}</h4>
            </div>
            <ul className="space-y-1.5 ml-11">
              {rule.points.map((p, j) => (
                <li key={j} className="text-xs font-extralight text-muted-foreground leading-relaxed flex items-start gap-2">
                  <span className="text-destructive mt-0.5 shrink-0">•</span> {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>

    {/* PART 2, Interactive Map */}
    <div className="mx-auto max-w-4xl mb-16">
      <h3 className="text-lg font-extralight tracking-wide text-foreground mb-2">Part 2, Eclipse Detonator Map</h3>
      <p className="text-xs font-extralight text-muted-foreground mb-6">Click each eclipse to see its shadow path, target cities, and detonation window.</p>
      <EclipseMap />
    </div>

    {/* Eclipse Details */}
    <div className="mx-auto max-w-4xl mb-16 space-y-6">
      {eclipses.map((ec) => (
        <div key={ec.id} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md overflow-hidden">
          <div className="px-6 py-4 border-b border-border/10 flex items-center gap-3">
            <span className="text-lg">{ec.emoji}</span>
            <div>
              <h4 className="text-sm font-light tracking-wide text-foreground">{ec.title}</h4>
              <p className={`text-[10px] font-light tracking-[0.2em] uppercase ${ec.severity === "critical" ? "text-destructive" : ec.severity === "high" ? "text-yellow-500" : "text-muted-foreground/50"}`}>
                {ec.subtitle}
              </p>
            </div>
          </div>
          <div className="p-6">
            {/* Data table */}
            <div className="rounded-xl border border-border/10 overflow-hidden mb-4">
              {ec.data.map((row, i) => (
                <div key={i} className={`flex items-start justify-between gap-4 px-4 py-2.5 ${i < ec.data.length - 1 ? "border-b border-border/10" : ""}`}>
                  <span className="text-[11px] font-extralight text-muted-foreground/60 shrink-0 w-32">{row.label}</span>
                  <span className="text-[11px] font-extralight text-foreground text-right">{row.value}</span>
                </div>
              ))}
            </div>

            {ec.shadow.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase mb-2">Shadow Path Analysis</p>
                <ul className="space-y-1">
                  {ec.shadow.map((s, i) => (
                    <li key={i} className="text-xs font-extralight text-muted-foreground leading-relaxed flex items-start gap-2">
                      <span className="text-accent mt-0.5 shrink-0">•</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {ec.trigger && (
              <div className="rounded-xl bg-destructive/5 border border-destructive/15 p-3 mb-4">
                <p className="text-[10px] font-medium tracking-[0.2em] text-destructive/60 uppercase mb-1">Trigger Mechanism</p>
                <p className="text-xs font-extralight text-muted-foreground leading-relaxed">{ec.trigger}</p>
              </div>
            )}

            {ec.read.length > 0 && (
              <ul className="space-y-1">
                {ec.read.map((r, i) => (
                  <li key={i} className="text-xs font-extralight text-muted-foreground leading-relaxed flex items-start gap-2">
                    <span className="text-foreground/40 mt-0.5 shrink-0">→</span> {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>

    {/* PART 3, Historical Proof */}
    <div className="mx-auto max-w-4xl mb-16">
      <h3 className="text-lg font-extralight tracking-wide text-foreground mb-2">Part 3, Historical Proof The System Works</h3>
      <p className="text-xs font-extralight text-muted-foreground mb-6">The Seeker needs evidence, not theory.</p>
      <div className="space-y-4">
        {historicalProofs.map((proof, i) => (
          <div key={i} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-4 w-4 text-accent" />
              <h4 className="text-sm font-light tracking-wide text-foreground">{proof.title}</h4>
            </div>
            <ul className="space-y-1.5 mb-3">
              {proof.points.map((p, j) => (
                <li key={j} className="text-xs font-extralight text-muted-foreground leading-relaxed flex items-start gap-2">
                  <span className="text-muted-foreground/40 mt-0.5 shrink-0">•</span> {p}
                </li>
              ))}
            </ul>
            <p className="text-xs font-light text-foreground italic">{proof.verdict}</p>
          </div>
        ))}
      </div>
    </div>

    {/* PART 4, Master Timeline */}
    <div className="mx-auto max-w-4xl mb-16">
      <h3 className="text-lg font-extralight tracking-wide text-foreground mb-2">Part 4, The Master Timeline Map</h3>
      <div className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md overflow-hidden">
        <div className="grid grid-cols-6 gap-2 px-4 sm:px-6 py-3 border-b border-border/20">
          {["Date", "Type", "Duration", "Path Crosses", "Target", "Trigger Fires"].map((h) => (
            <span key={h} className="text-[9px] font-medium tracking-[0.15em] text-muted-foreground/50 uppercase">{h}</span>
          ))}
        </div>
        {masterTimeline.map((row, i) => (
          <div key={i} className={`grid grid-cols-6 gap-2 px-4 sm:px-6 py-3 ${i < masterTimeline.length - 1 ? "border-b border-border/10" : ""}`}>
            <span className="text-[11px] font-light text-foreground">{row.date}</span>
            <span className="text-[11px] font-extralight text-muted-foreground">{row.type}</span>
            <span className="text-[11px] font-extralight text-muted-foreground">{row.duration}</span>
            <span className="text-[11px] font-extralight text-muted-foreground">{row.path}</span>
            <span className="text-[11px] font-extralight text-muted-foreground">{row.target}</span>
            <span className="text-[11px] font-light text-destructive">{row.trigger}</span>
          </div>
        ))}
      </div>
    </div>

    {/* PART 5, Bottom Line */}
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-accent/20 bg-accent/5 backdrop-blur-md p-8 sm:p-12 text-center">
        <h4 className="text-lg font-light tracking-wide text-foreground mb-6">The Bottom Line For The Seeker</h4>
        <p className="text-xs font-extralight text-muted-foreground mb-4">
          The eclipse system is not astrology as entertainment. It is a <span className="text-foreground font-light">precision targeting system</span> that has called:
        </p>
        <ul className="space-y-1.5 text-xs font-extralight text-muted-foreground mb-6 inline-block text-left">
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">✓</span> The exact day of the 2008 Lehman collapse</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">✓</span> The exact day of FTX implosion</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">✓</span> The Brexit political chaos window</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">✓</span> Every major regime change where totality crossed a capital</li>
        </ul>
        <div className="space-y-3 text-sm font-extralight text-muted-foreground leading-relaxed">
          <p className="text-foreground font-light">
            The August 2, 2028 eclipse is the single most important geopolitical event of the decade.
          </p>
          <p>
            6 minutes 22 seconds of totality = 6+ years of activated chaos across the entire Arab world and North African corridor, directly intersecting with the WW3 Middle Eastern theater.
          </p>
          <p className="text-muted-foreground/60 italic pt-2">
            The weapon is already scheduled. The shadow path is already calculated. The only question is whether the Seeker is positioned before the trigger fires.
          </p>
        </div>
        <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/30 uppercase mt-8">
, ZOPHIEL | Intelligence of the North | Eclipse Detonator Map Sealed | 963Hz
        </p>
      </div>
    </div>
  </section>
);

export default EclipseWeaponsSection;
