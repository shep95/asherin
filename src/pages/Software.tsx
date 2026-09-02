/**
 * /software — a short, honest catalog.
 *
 * Three jobs, then the tools that actually exist behind sign-in.
 * No competitor chart. No tile mall. If a capability is not real in HEAD,
 * it does not get a card.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageSquare,
  Search,
  Map,
  Database,
  Layers,
  Lock,
  Shield,
  Bluetooth,
  Hammer,
  Users,
  Network,
  Eye,
  ShieldCheck,
  Globe,
} from "lucide-react";

type Tool = {
  name: string;
  line: string;
  detail: string;
  icon: React.ElementType;
};

const JOBS: Tool[] = [
  {
    name: "ask",
    line: "asherin chat",
    detail:
      "one place to ask. it answers with sources next to the answer, reads files you attach, and says when it does not know. search, maps and the rest sit behind the chat rather than as separate apps. you pick the model — refusal behaviour is the model's, not a switch we sell.",
    icon: MessageSquare,
  },
  {
    name: "keep",
    line: "library, projects, memory, guardian vault",
    detail:
      "what you save stays with your account: notes, files, project threads, and long-term memory. the vault holds credentials and documents. data is encrypted at rest with a key scoped to your account and TLS in transit — it is not zero-knowledge end-to-end, and we do not claim it is. export or delete at any time.",
    icon: Database,
  },
   {
     name: "look at a place",
     line: "asherin eye",
     detail:
       "public geospatial context, flights, earthquakes and other sourced layers opened from chat when you name a place. it does not locate anyone's phone.",
     icon: Globe,
   },
];

const TOOLS: Tool[] = [
  {
    name: "asherinx.eng",
    line: "public-index search",
    detail:
      "federated public indexes — wayback, nvd, github, wiki, and the rest of the public stack. it does not intercept login ips, sms, dms, or private mail.",
    icon: Globe,
  },
   {
     name: "asherin.cyber",
     line: "passive domain context",
     detail:
       "reads public dns, tls, headers and advisory indexes. it does not authenticate, exploit or scan hosts.",
     icon: Shield,
   },
  {
    name: "asherin.defender",
    line: "owned-device defence",
    detail:
      "bluetooth, wifi, and spy-software pattern checks on this device. it does not ship a keylogger and it does not remap keys consumed by apps or sites.",
    icon: ShieldCheck,
  },
  {
    name: "asherin.arvision",
    line: "camera intelligence hud",
    detail: "live user-facing camera overlays on this device. visual-intel labels, not a face database.",
    icon: Eye,
  },
  {
    name: "zophiel — search",
    line: "public engines, cited",
    detail:
      "queries public search endpoints and open registries, ranks what comes back by source credibility, and cites every hit. coverage is whatever those endpoints return that day, so we do not print a source count. lives at /dashboard/search once you are signed in.",
    icon: Search,
  },
  {
    name: "guardian vault",
    line: "credentials and documents",
    detail: "encrypted storage scoped to your account, with breach lookups against public indexes.",
    icon: Lock,
  },
  {
    name: "whiteboard",
    line: "infinite canvas, layers",
    detail: "pan, zoom, layer stack, sketching — for when a thread needs a picture.",
    icon: Layers,
  },
  {
    name: "connect (google)",
    line: "signed-in mesh",
    detail:
      "with your consent, asherin reads what google's apis actually give it — mail, calendar, drive — to summarise and draft. it does not locate phones or read anything google does not hand over.",
    icon: Network,
   },
   {
     name: "zanoem — design lab",
     line: "engineering briefs, no solver",
     detail:
       "material choices, assembly layouts and parametric sketches written up as a brief. it reasons about physics in text and geometry; it does not run a solver. no fea, thermal or cfd here — take the brief to a real solver before you build.",
     icon: Hammer,
   },
  {
    name: "zaxin — ble scout",
    line: "browser web bluetooth",
    detail:
      "sees the devices the browser picker and requestLEScan expose and plots coarse rssi proximity. rssi is a log-distance estimate with metres of error, not trilateration, and the tab graph is between your own tabs — not a phone mesh.",
    icon: Bluetooth,
  },
  {
    name: "team",
    line: "shared workspace, when billed",
    detail:
      "$39/month for the workspace plus $24 per member per month, minimum 2 seats. the owner pays the single invoice; members get pro-class access while it stays active.",
    icon: Users,
  },
];

const Card = ({ t }: { t: Tool }) => (
  <div className="flex h-full flex-col gap-3 rounded-2xl border border-border/25 bg-card/20 p-6">
    <t.icon className="h-4 w-4 text-foreground/60" strokeWidth={1.4} />
    <div>
      <h3 className="text-base font-light text-foreground">{t.name}</h3>
      <p className="text-[11px] font-extralight tracking-wide text-muted-foreground/70">{t.line}</p>
    </div>
    <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{t.detail}</p>
  </div>
);

const Software = () => {
  const { user } = useAuth();

  useEffect(() => {
    const id = "software-collection-jsonld";
    document.getElementById(id)?.remove();
    const el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "asherin — software",
       description:
         "rooms on a seat: chat, asherinx.eng, asherin.cyber, asherin.defender, asherin.arvision, asherin.eye, library, projects, memory, vault. $18/mo, $79/mo pro.",
      url: "https://asherin.com/software",
    });
    document.head.appendChild(el);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  return (
    <div className="landing-perf min-h-screen bg-background text-foreground">
      <Header />

      <main className="px-6 pt-32 pb-20">
        <div className="mx-auto max-w-5xl space-y-20">
          <header className="max-w-2xl space-y-5">
            <p className="text-[10px] font-extralight uppercase tracking-[0.35em] text-muted-foreground">software</p>
            <h1 className="text-4xl font-extralight leading-[1.1] tracking-tight sm:text-5xl">software | asherin</h1>
            <p className="text-2xl font-extralight tracking-tight text-foreground/80">three things, honestly.</p>
            <p className="text-base font-extralight leading-relaxed text-muted-foreground">
              asherin is one chat with a few rooms behind it. everything below runs after you sign in. if something is
              not listed here, it is not something we sell you today.
            </p>
          </header>

          <section className="grid gap-4 sm:grid-cols-3" aria-label="What asherin is for">
            {JOBS.map((t) => (
              <Card key={t.name} t={t} />
            ))}
          </section>

          <section className="space-y-6" aria-labelledby="rooms">
            <h2 id="rooms" className="text-2xl font-extralight tracking-tight">
              the rooms behind the chat
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {TOOLS.map((t) => (
                <Card key={t.name} t={t} />
              ))}
            </div>
          </section>

          <section className="space-y-5 rounded-2xl border border-border/25 bg-card/20 p-8">
            <h2 className="text-2xl font-extralight tracking-tight">$18 a month. $79 for pro.</h2>
            <p className="max-w-xl text-sm font-extralight leading-relaxed text-muted-foreground">
              pro raises message limits and opens the heavier research and forecasting work. there is no free trial.
              cancel in one click.
            </p>
            <div className="flex flex-wrap gap-3">
              {user ? (
                <Link
                  to="/dashboard"
                  className="rounded-full bg-foreground px-5 py-2.5 text-xs font-light uppercase tracking-[0.2em] text-background transition-colors hover:bg-foreground/90"
                >
                  go to dashboard
                </Link>
              ) : (
                <Link
                  to="/pricing"
                  className="rounded-full bg-foreground px-5 py-2.5 text-xs font-light uppercase tracking-[0.2em] text-background transition-colors hover:bg-foreground/90"
                >
                  create account
                </Link>
              )}
              <Link
                to="/pricing"
                className="rounded-full border border-border/40 px-5 py-2.5 text-xs font-light uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
              >
                pricing
              </Link>
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Software;
