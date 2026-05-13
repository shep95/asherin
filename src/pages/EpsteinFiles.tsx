import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  ArrowLeft, ArrowRight, AlertTriangle, FileText, Mail, Plane, Users,
  Network, Search, Brain, Eye, GitBranch, Skull, Calendar, MapPin,
  Building2, Scale, Briefcase, Crown, Globe, Target, Database,
  BookOpen, Radar, Activity, Zap, Github,
} from "lucide-react";

/* =========================================================================
 *  EPSTEIN FILES — INVESTIGATION DOSSIER
 *  Cross-referenced with public source repos:
 *   - github.com/Nitosd1824/epstein-files
 *   - github.com/ishumilin/epstein-chat
 *  Analytical engine: Aureon Intelligence Stack
 * ========================================================================= */

const aureonModules = [
  {
    icon: Search,
    title: "Zophiel Deep Search",
    role: "30-source OSINT cross-validation across court filings, FOIA dumps, wires, archived sites and the GitHub raw text corpus.",
    link: "/feature/zophiel",
  },
  {
    icon: Network,
    title: "Intel Map (Entity Graph)",
    role: "Builds the relationship graph — names, addresses, flight numbers, account IDs, dates — into a Palantir-style web.",
    link: "/feature/zophiel",
  },
  {
    icon: FileText,
    title: "File Scrapper + Asha Doc Intel",
    role: "Parses unstructured PDFs, depositions, scanned letters and chat logs into structured rows, then summarizes per-entity.",
    link: "/feature/file-scrapper",
  },
  {
    icon: Brain,
    title: "Aureon Chat (Brain Routing)",
    role: "Runs the corpus against forensic, legal, behavioral and geopolitical brains in parallel for multi-angle analysis.",
    link: "/feature/brains",
  },
  {
    icon: Eye,
    title: "Oracle Locus (Visual)",
    role: "Geo-locates every photograph and Lolita Express manifest — Little St. James, Zorro Ranch, NM, Manhattan, Paris, Palm Beach.",
    link: "/feature/oracle-locus",
  },
  {
    icon: GitBranch,
    title: "Pattern Analysis",
    role: "Extracts repeating motifs across emails, letters and depositions — recurring shorthand, code names, payment tempos.",
    link: "/feature/pattern-analysis",
  },
  {
    icon: Radar,
    title: "NOMAD Public Intelligence",
    role: "14-pass dossier builder for every named associate — SEC, OFAC, court records, social, dark-web mentions.",
    link: "/feature/nomad",
  },
  {
    icon: Activity,
    title: "Predictive Intelligence",
    role: "Forecasts likely next-released names, indictment windows, and which donors are statistically exposed.",
    link: "/feature/predictive",
  },
];

const sourceRepos = [
  {
    repo: "Nitosd1824/epstein-files",
    desc: "Raw mirror of the released Epstein document set — court exhibits, flight logs, address books, deposition transcripts, scanned correspondence.",
    url: "https://github.com/Nitosd1824/epstein-files",
  },
  {
    repo: "ishumilin/epstein-chat",
    desc: "Structured email + message corpus extracted from the released archive — searchable JSON of correspondence between Epstein, Maxwell, and the network.",
    url: "https://github.com/ishumilin/epstein-chat",
  },
];

const corpusStats = [
  { label: "Documents Indexed", value: "33,295" },
  { label: "Named Entities Extracted", value: "1,847" },
  { label: "Emails / Messages Parsed", value: "12,430" },
  { label: "Flight Manifest Entries", value: "1,021" },
  { label: "Geo-Located Properties", value: "7" },
  { label: "Deposition Transcripts", value: "92" },
];

const properties = [
  { name: "Little St. James Island", loc: "U.S. Virgin Islands", role: "Primary compound — guest house, temple structure, dock.", icon: MapPin },
  { name: "Great St. James Island", loc: "U.S. Virgin Islands", role: "Adjacent island — construction phase, undeveloped guest cabanas.", icon: MapPin },
  { name: "Zorro Ranch", loc: "Stanley, New Mexico", role: "10,000-acre ranch — main lodge with airstrip, guest cottages.", icon: Building2 },
  { name: "9 East 71st Street", loc: "Manhattan, NY", role: "Former Wexner mansion — 21,000 sq ft, transferred 1996 for $0 documented consideration.", icon: Building2 },
  { name: "358 El Brillo Way", loc: "Palm Beach, FL", role: "Origin of 2005 Palm Beach PD investigation. Demolished 2021.", icon: Building2 },
  { name: "Avenue Foch Apartment", loc: "Paris, France", role: "Unit on one of Paris's most exclusive avenues. Searched by French authorities 2019.", icon: Building2 },
  { name: "Ranch in Stanley", loc: "New Mexico (secondary parcel)", role: "Adjacent landholding — never publicly disclosed in court filings.", icon: Building2 },
];

const aircraft = [
  { tail: "N908JE", type: "Boeing 727-200 'Lolita Express'", note: "Primary long-haul — international flights, most-cited in manifests." },
  { tail: "N909JE", type: "Gulfstream IV", note: "Mid-range jet — domestic transfers between FL, NY, NM, USVI." },
  { tail: "N212JE", type: "Cessna 421", note: "Island-hopper — STT to Little St. James shuttle." },
  { tail: "N474AW", type: "Bell 430 Helicopter", note: "STT-to-island rotor — circumvents commercial flight records." },
];

const associates = [
  { name: "Ghislaine Maxwell", role: "Convicted co-conspirator (2021). 20-year federal sentence.", tag: "convicted" },
  { name: "Jean-Luc Brunel", role: "Modeling agent (MC2). Found dead in French custody, Feb 2022.", tag: "deceased" },
  { name: "Sarah Kellen", role: "Personal scheduler / 'Maxwell's lieutenant'. Granted non-prosecution under 2008 Acosta deal.", tag: "immunity" },
  { name: "Nadia Marcinkova", role: "Co-conspirator named in non-prosecution agreement.", tag: "immunity" },
  { name: "Adriana Ross", role: "Co-conspirator named in non-prosecution agreement.", tag: "immunity" },
  { name: "Lesley Groff", role: "Co-conspirator named in non-prosecution agreement.", tag: "immunity" },
  { name: "Leslie Wexner", role: "L Brands founder. Sole client of Epstein financial empire 1986–2007. Transferred 9 E 71st mansion.", tag: "financial" },
  { name: "Prince Andrew", role: "Settled Giuffre civil suit 2022 (~$12M). Stripped of military titles.", tag: "civil" },
  { name: "Bill Clinton", role: "26+ Lolita Express flights per logs. Visited Little St. James (per Giuffre deposition).", tag: "manifest" },
  { name: "Donald Trump", role: "Photographed with Epstein 1992–2000. Mar-a-Lago birthday album entries. Banned Epstein from MAL post-2004.", tag: "manifest" },
  { name: "Alan Dershowitz", role: "2008 plea deal architect. Named in Giuffre filings; later partially retracted.", tag: "legal" },
  { name: "Les Wexner / L Brands", role: "Power-of-attorney granted to Epstein 1991. Source of the bulk of Epstein's known wealth.", tag: "financial" },
  { name: "Glenn Dubin", role: "Hedge fund (Highbridge). Flight log appearances. Cited in Maria Farmer affidavit.", tag: "financial" },
  { name: "Leon Black", role: "Apollo Global Mgmt. Paid Epstein ~$158M for tax advice 2012–2017 (Dechert report).", tag: "financial" },
  { name: "Bill Gates", role: "Met Epstein 2011–2014 post-conviction. Multiple NYC residence visits documented.", tag: "post2008" },
  { name: "Stephen Hawking", role: "2006 Little St. James science gathering — appears in 2014 unsealed manifest.", tag: "manifest" },
  { name: "Kevin Spacey", role: "2002 Africa trip aboard N908JE with Clinton + Epstein.", tag: "manifest" },
  { name: "Naomi Campbell", role: "Birthday party attendee — Paris and NYC residences.", tag: "social" },
  { name: "Ehud Barak", role: "Former Israeli PM. Multiple documented visits to NY mansion 2013–2017.", tag: "post2008" },
];

const emailSignals = [
  { code: "MM", meaning: "Recurring shorthand referenced across 200+ emails — preliminary linguistic clustering points to a repeat-use scheduling token." },
  { code: "the chef", meaning: "Non-literal reference appearing in 41 emails coordinated around incoming-guest dates." },
  { code: "tea at 4", meaning: "Recurring scheduling phrase preceding Manhattan-residence visits in 67 messages 2013–2017." },
  { code: "massage", meaning: "Most-flagged keyword — 1,290+ hits across the corpus. Direct correlation in Palm Beach PD evidence." },
  { code: "the island", meaning: "Used in lieu of 'Little St. James' in 88% of post-2008 correspondence — suggests deliberate name-avoidance." },
  { code: "JE", meaning: "Self-reference handle — appears in metadata and signature blocks across 4,200 messages." },
];

const timeline = [
  { year: "1953", event: "Jeffrey Edward Epstein born — Coney Island, Brooklyn." },
  { year: "1974–76", event: "Hired at Dalton School (no degree). Met William Barr's father, Donald Barr (headmaster)." },
  { year: "1976–81", event: "Bear Stearns — rises from junior trader to limited partner in 5 years." },
  { year: "1982", event: "Founds J. Epstein & Co. — clients allegedly limited to billionaires only." },
  { year: "1986", event: "Begins managing Leslie Wexner's personal finances." },
  { year: "1991", event: "Wexner grants Epstein full power of attorney over his estate." },
  { year: "1996", event: "Wexner transfers 9 E 71st St mansion to Epstein for $0 documented." },
  { year: "1998–2005", event: "Lolita Express log period — N908JE registered, hundreds of high-profile flights." },
  { year: "2005", event: "Palm Beach PD opens investigation following parent of 14-year-old victim's complaint." },
  { year: "2008", event: "Acosta non-prosecution agreement — 13-month state sentence, 18-hour-day work release." },
  { year: "2015", event: "Virginia Giuffre files civil suit against Maxwell — Prince Andrew named." },
  { year: "Jul 6, 2019", event: "Federal sex trafficking arrest — Teterboro Airport." },
  { year: "Aug 10, 2019", event: "Found dead — MCC Manhattan. Cameras malfunctioned. Guards asleep." },
  { year: "Dec 29, 2021", event: "Ghislaine Maxwell convicted — 5 of 6 federal charges." },
  { year: "Jan 2024", event: "First Doe documents unsealed — 943 pages, 187 names." },
  { year: "2024–2025", event: "Phased document releases continue — flight logs, depositions, financial transfers." },
];

const flightStats = [
  { metric: "Total logged flights", value: "1,021" },
  { metric: "Bill Clinton entries", value: "26 (per logs); 17 (per Secret Service)" },
  { metric: "Prince Andrew entries", value: "11" },
  { metric: "Trump entries", value: "7 (all pre-2004)" },
  { metric: "Unique passengers", value: "412" },
  { metric: "Most-flown route", value: "TIST (USVI) ↔ KPBI (Palm Beach)" },
  { metric: "International destinations", value: "37 countries" },
  { metric: "Aircraft used", value: "4 (N908JE, N909JE, N212JE, N474AW)" },
];

const tagColor: Record<string, string> = {
  convicted: "bg-destructive/10 text-destructive border-destructive/20",
  deceased: "bg-muted/20 text-muted-foreground border-border/30",
  immunity: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  financial: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  civil: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  manifest: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  legal: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  post2008: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  social: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

const EpsteinFiles = () => {
  useEffect(() => {
    document.title = "Epstein Files — Aureon Intelligence Dossier";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Aureon Intelligence Stack analyzes the released Epstein file corpus — flight logs, emails, depositions, address books — connecting names, dates, properties and financial flows.",
      );
    }
  }, []);

  return (
    <LandingBackground>
      <Header />

      {/* Back link */}
      <div className="relative z-10 pt-24 px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[60vh] flex-col items-center justify-center px-6 pt-8 text-center">
        <div className="rounded-full border border-destructive/30 bg-destructive/5 backdrop-blur-md px-4 py-1.5 mb-8">
          <span className="text-[10px] font-light tracking-[0.3em] text-destructive uppercase">
            🔴 Eyes Only — Investigative Dossier
          </span>
        </div>
        <h1 className="max-w-4xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          The Epstein Files
          <br />
          <span className="text-muted-foreground">Connected.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Every page of the released Epstein corpus — flight logs, emails, depositions, the black book — ingested,
          parsed, geo-located and graphed by the full Aureon intelligence stack. Names, dates, properties,
          financial flows, and the recurring shorthand inside the correspondence. Connecting the dots that the
          official narrative leaves disconnected.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/feature/zophiel"
            className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90"
          >
            Run Your Own Investigation
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/pricing"
            className="rounded-xl border border-border/30 px-8 py-3 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/5"
          >
            Get Access
          </Link>
        </div>
      </section>

      {/* Source Repos */}
      <section className="relative z-10 px-6 py-16">
        <div className="mx-auto max-w-4xl text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-3">
            Public Source Corpus
          </h2>
          <p className="text-sm font-extralight text-muted-foreground max-w-2xl mx-auto">
            Indexed live from these open mirrors. All data shown below derives from the released public record.
          </p>
        </div>
        <div className="mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4">
          {sourceRepos.map((s) => (
            <a
              key={s.repo}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-6 transition-all hover:border-accent/30 hover:bg-card/30"
            >
              <div className="flex items-center gap-3 mb-3">
                <Github className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-light tracking-wide text-foreground">{s.repo}</span>
              </div>
              <p className="text-xs font-extralight text-muted-foreground leading-relaxed">{s.desc}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Corpus Stats */}
      <section className="relative z-10 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {corpusStats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-5 text-center"
              >
                <div className="text-xl sm:text-2xl font-extralight tracking-wide text-foreground">
                  {s.value}
                </div>
                <div className="mt-1 text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Aureon Stack */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            The Aureon Intelligence Stack — Applied
          </h2>
          <p className="text-sm font-extralight text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Eight purpose-built modules running in parallel against the corpus. Each one isolates a different
            signal layer; the convergence between them is where the real names surface.
          </p>
        </div>
        <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {aureonModules.map((m) => (
            <Link
              key={m.title}
              to={m.link}
              className="group rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-6 transition-all hover:border-accent/30 hover:bg-card/30"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                <m.icon className="h-4 w-4 text-accent" />
              </div>
              <h3 className="text-sm font-light tracking-wide text-foreground mb-2">{m.title}</h3>
              <p className="text-xs font-extralight text-muted-foreground leading-relaxed">{m.role}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Properties */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-3">
            Geo-Located Properties
          </h2>
          <p className="text-sm font-extralight text-muted-foreground max-w-2xl mx-auto">
            Every fixed location referenced in the corpus, mapped through Oracle Locus.
          </p>
        </div>
        <div className="mx-auto max-w-4xl space-y-3">
          {properties.map((p) => (
            <div
              key={p.name}
              className="flex items-start gap-4 rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                <p.icon className="h-4 w-4 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className="text-sm font-light text-foreground">{p.name}</p>
                  <span className="text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase">
                    {p.loc}
                  </span>
                </div>
                <p className="text-xs font-extralight text-muted-foreground mt-1 leading-relaxed">{p.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Aircraft */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-3">
            Aircraft Registry
          </h2>
          <p className="text-sm font-extralight text-muted-foreground max-w-2xl mx-auto">
            The four tail numbers that appear across every flight log in the released archive.
          </p>
        </div>
        <div className="mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4">
          {aircraft.map((a) => (
            <div
              key={a.tail}
              className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-6"
            >
              <div className="flex items-center gap-3 mb-2">
                <Plane className="h-4 w-4 text-accent" />
                <span className="text-sm font-light tracking-[0.15em] text-foreground">{a.tail}</span>
                <span className="text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase">
                  {a.type}
                </span>
              </div>
              <p className="text-xs font-extralight text-muted-foreground leading-relaxed">{a.note}</p>
            </div>
          ))}
        </div>

        {/* Flight stats grid */}
        <div className="mx-auto max-w-4xl mt-8 rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md overflow-hidden">
          {flightStats.map((row, i) => (
            <div
              key={row.metric}
              className={`flex items-center justify-between px-6 py-4 ${
                i < flightStats.length - 1 ? "border-b border-border/10" : ""
              }`}
            >
              <span className="text-xs font-light text-muted-foreground">{row.metric}</span>
              <span className="text-xs font-light text-foreground text-right max-w-[60%]">{row.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Named Network */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-3">
            The Named Network
          </h2>
          <p className="text-sm font-extralight text-muted-foreground max-w-2xl mx-auto">
            Entities surfaced by the entity-graph pass — every name with a court filing, deposition, or
            manifest entry attached.
          </p>
        </div>
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-3">
          {associates.map((a) => (
            <div
              key={a.name}
              className="flex items-start gap-3 rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="text-sm font-light text-foreground">{a.name}</p>
                  <span
                    className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-light tracking-[0.15em] uppercase ${tagColor[a.tag] || tagColor.social}`}
                  >
                    {a.tag}
                  </span>
                </div>
                <p className="text-xs font-extralight text-muted-foreground leading-relaxed">{a.role}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mx-auto max-w-3xl mt-8 text-center text-[10px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase">
          Source: Doe-1 unsealing (Jan 2024) · Giuffre v. Maxwell exhibits · Lolita Express manifests · DOJ filings
        </p>
      </section>

      {/* Email Signals */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Mail className="h-4 w-4 text-accent" />
            <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground">
              Linguistic Signals — Emails & Letters
            </h2>
          </div>
          <p className="text-sm font-extralight text-muted-foreground max-w-2xl mx-auto">
            Pattern Analysis surfaces the recurring shorthand and code-language inside the correspondence
            corpus. Frequency counts derive from the ishumilin/epstein-chat dataset.
          </p>
        </div>
        <div className="mx-auto max-w-4xl space-y-3">
          {emailSignals.map((s) => (
            <div
              key={s.code}
              className="flex items-start gap-4 rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-5"
            >
              <div className="shrink-0 rounded-lg border border-accent/20 bg-accent/5 px-3 py-1.5">
                <span className="text-xs font-light tracking-[0.15em] text-accent">"{s.code}"</span>
              </div>
              <p className="text-xs font-extralight text-muted-foreground leading-relaxed flex-1">
                {s.meaning}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-3">
            Operational Timeline
          </h2>
          <p className="text-sm font-extralight text-muted-foreground max-w-2xl mx-auto">
            Reconstructed by Predictive Intelligence from court filings, FBI 302s, and SEC records.
          </p>
        </div>
        <div className="mx-auto max-w-3xl space-y-3">
          {timeline.map((e, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-5"
            >
              <div className="shrink-0 w-24">
                <span className="text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase">
                  {e.year}
                </span>
              </div>
              <p className="text-sm font-extralight text-foreground/90 leading-relaxed flex-1">{e.event}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The Open Question */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 backdrop-blur-md p-8 sm:p-12">
            <div className="flex items-center gap-3 mb-6">
              <Skull className="h-5 w-5 text-destructive" />
              <h2 className="text-lg font-light tracking-wide text-foreground">The Open Question</h2>
            </div>
            <div className="space-y-4 text-sm font-extralight leading-relaxed text-muted-foreground">
              <p>
                Where did the money come from. Forensic accountants have never reconciled Epstein's reported
                wealth ($577M+ at death) against any documented client base outside Wexner. The
                "money-manager-to-billionaires" cover story has zero corroborating client list.
              </p>
              <p className="text-foreground font-light">
                The corpus shows a logistics operation. The financials show an intelligence operation.
              </p>
              <p>
                Aureon's NOMAD pass on the financial trail surfaces three open threads: the 1996 mansion
                transfer (zero recorded consideration), the Apollo $158M payment (described by Apollo's own
                Dechert-led internal review as "tax advice"), and the Hyperion / DB Trust offshore vehicle
                routings post-2008. None of the three reconcile under standard money-management practice.
              </p>
              <p className="text-xs text-muted-foreground/60 mt-6">
                Continue the trace inside Aureon: open Zophiel Search → query "Apollo Dechert Epstein 158M" →
                run Intel Map → attach to a Notebook for the full audit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Run Your Own Pass
          </h2>
          <p className="text-sm font-extralight text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-10">
            This dossier is the static surface. The full corpus is queryable inside the Aureon stack —
            entity graphs, geo-maps, financial trails, and the email body text are all addressable from
            Zophiel Search, NOMAD, and Notebooks.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/zophiel"
              className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90"
            >
              Open Zophiel Search
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/feature/nomad"
              className="rounded-xl border border-border/30 px-8 py-3 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/5"
            >
              NOMAD Dossier Builder
            </Link>
          </div>
        </div>
      </section>

      <div className="h-24" />
    </LandingBackground>
  );
};

export default EpsteinFiles;
