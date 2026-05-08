import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  MapPin, Navigation, Globe, Shield, ArrowRight, ArrowLeft,
  Clock, Radio, Layers, Lock, Cpu, Wifi, ScanLine, Database,
} from "lucide-react";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const capabilities = [
  {
    icon: Navigation,
    title: "Real-Time Geolocation",
    description:
      "Capture precise GPS coordinates directly from the browser with accuracy readings. Log timestamped location pings with a single interaction — no hardware required.",
  },
  {
    icon: MapPin,
    title: "Reverse Geocoding",
    description:
      "Every coordinate pair is automatically resolved to a full human-readable address via OpenStreetMap Nominatim — street, city, region, and country extracted automatically.",
  },
  {
    icon: Globe,
    title: "Interactive Map Viewer",
    description:
      "Visualise every logged location on an embedded live map. Jump between pings, inspect coordinates, and open any location directly in Google Maps for extended navigation.",
  },
  {
    icon: Clock,
    title: "Location History Log",
    description:
      "Every ping is persisted to your encrypted backend with full timestamp, accuracy, address, and coordinate metadata — creating an auditable chain of location records.",
  },
  {
    icon: Radio,
    title: "Signal Accuracy Monitoring",
    description:
      "Each ping captures GPS accuracy in metres. Monitor signal quality across pings to distinguish high-confidence fixed locations from lower-certainty mobile readings.",
  },
  {
    icon: Shield,
    title: "Privacy-First Architecture",
    description:
      "Location data is stored securely against your authenticated identity with row-level access control. No third-party tracking — your coordinates never leave the Aureon ecosystem.",
  },
];

const useCases = [
  {
    icon: ScanLine,
    title: "Field Operations Logging",
    desc: "Log your location at each site visit during field operations. Build an immutable timestamped record of presence — useful for compliance, evidence, and operational audits.",
  },
  {
    icon: Layers,
    title: "Route & Checkpoint Tracking",
    desc: "Record movement across multiple waypoints and review the full location history in sequence. Identify patterns, durations, and gaps across any operational period.",
  },
  {
    icon: Lock,
    title: "Incident Location Documentation",
    desc: "Capture and preserve the exact coordinates and resolved address of any incident at the moment it occurs — with machine-precision rather than manual recall.",
  },
  {
    icon: Wifi,
    title: "Remote Verification & Presence Proof",
    desc: "Generate a timestamped location record that can be used to verify physical presence at a location — paired with address resolution and accuracy confidence.",
  },
];

const workflow = [
  { step: "01", label: "Register Device", desc: "Name your device and enter a phone number for identification in the tracking interface." },
  { step: "02", label: "Log Location Ping", desc: "Browser requests GPS coordinates with accuracy. A ping is logged instantly to the secure database." },
  { step: "03", label: "Reverse Geocode", desc: "Coordinates are automatically resolved to a full address via OpenStreetMap — no manual input required." },
  { step: "04", label: "Map & Review", desc: "View all pings on the live interactive map. Jump to any historical location and open it in Google Maps." },
];

const FeatureTracker = () => {
  useEffect(() => {
    document.title = "Location Tracker — Aureon";
  }, []);

  return (
    <LandingBackground>
      <Header />

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
      <section className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-6 pt-24 text-center">
        <div className="rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-4 py-1.5 mb-8">
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">
            Geolocation & Address Intelligence
          </span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Coordinates Resolved.
          <br />
          <span className="text-muted-foreground">Location Recorded.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Aureon's Location Tracker converts raw GPS coordinates into actionable intelligence —
          reverse-geocoding every ping to a full address, displaying each location on a live
          interactive map, and preserving a timestamped history for audit, compliance, or operational use.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/pricing"
            className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90"
          >
            Get Access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/features"
            className="rounded-xl border border-border/30 px-8 py-3 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/5"
          >
            All Features
          </Link>
        </div>
      </section>

      {/* Workflow */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {workflow.map((w) => (
              <div
                key={w.step}
                className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-6 transition-all hover:border-border/40 hover:bg-card/30"
              >
                <span className="text-3xl font-extralight text-muted-foreground/30 tracking-widest">{w.step}</span>
                <h3 className="mt-3 text-sm font-light tracking-wide text-foreground">{w.label}</h3>
                <p className="mt-2 text-xs font-extralight leading-relaxed text-muted-foreground">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Core Capabilities
          </h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            Every layer of the Location Tracker is built for operational precision — from raw coordinate capture
            to automatic address resolution, live map visualisation, and permanent encrypted history storage.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap) => (
              <div
                key={cap.title}
                className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 transition-all hover:border-border/40 hover:bg-card/30"
              >
                <cap.icon className="h-6 w-6 text-foreground/80 mb-4" />
                <h3 className="text-base font-light tracking-wide text-foreground mb-3">{cap.title}</h3>
                <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{cap.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            Use Cases
          </h2>
          <div className="space-y-6">
            {useCases.map((uc) => (
              <div
                key={uc.title}
                className="flex items-start gap-6 rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 transition-all hover:border-border/40"
              >
                <div className="mt-0.5 shrink-0 rounded-xl border border-border/20 bg-card/40 p-3">
                  <uc.icon className="h-5 w-5 text-foreground/70" />
                </div>
                <div>
                  <h3 className="text-base font-light tracking-wide text-foreground mb-2">{uc.title}</h3>
                  <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{uc.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Diagram */}
      <AgentArchitectureDiagram
        title="Location Tracker Architecture"
        subtitle="A layered geolocation pipeline. Browser coordinates flow through reverse geocoding, encrypted persistence, and live map rendering — every step automatic."
        layers={[
          {
            label: "Input Layer",
            nodes: [
              { id: "in1", label: "Browser GPS API", sublabel: "Navigator.geolocation request", type: "input", icon: Navigation },
              { id: "in2", label: "Device Identity", sublabel: "Named device + phone number", type: "input", icon: Radio },
            ],
          },
          {
            label: "Processing Modules",
            nodes: [
              { id: "m1", label: "Coordinate Capture", sublabel: "Lat/lon + accuracy extraction", type: "agent", icon: MapPin, accent: "text-accent/70" },
              { id: "m2", label: "Reverse Geocoder", sublabel: "Nominatim API address resolution", type: "agent", icon: Globe, accent: "text-accent/70" },
              { id: "m3", label: "Signal Quality", sublabel: "Accuracy rating in metres", type: "agent", icon: Wifi, accent: "text-accent/70" },
            ],
          },
          {
            label: "Intelligence & Storage",
            nodes: [
              { id: "e1", label: "Encrypted Persistence", sublabel: "Row-level secure location history", type: "engine", icon: Database, accent: "text-accent/60" },
              { id: "e2", label: "Privacy Routing", sublabel: "Zero third-party data transfer", type: "engine", icon: Lock, accent: "text-accent/60" },
            ],
          },
          {
            label: "Output Interface",
            nodes: [
              { id: "o1", label: "Interactive Map", sublabel: "Live OpenStreetMap embed", type: "output", icon: Globe },
              { id: "o2", label: "Address Display", sublabel: "Full resolved address per ping", type: "output", icon: MapPin },
              { id: "o3", label: "Location History", sublabel: "Timestamped audit trail", type: "output", icon: Clock },
            ],
          },
        ]}
        features={["real-time geocoding", "encrypted storage", "privacy-first", "no third-party tracking", "audit-grade history"]}
      />

      {/* Tier Badge */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-12 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/20 bg-card/30 px-4 py-1.5">
            <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-light tracking-[0.25em] text-muted-foreground uppercase">Pro & Advisor</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Precision Location Intelligence.
          </h2>
          <p className="text-sm font-extralight text-muted-foreground mb-8 max-w-xl mx-auto">
            Location Tracker is included on Pro and Advisor plans. Unlimited pings, reverse geocoding,
            interactive map view, and full encrypted location history are included at every access tier.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/pricing"
              className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90"
            >
              View Plans <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/features"
              className="rounded-xl border border-border/30 px-8 py-3 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/5"
            >
              All Features
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/10 py-8 text-center">
        <p className="text-xs font-extralight text-muted-foreground/50">
          © {new Date().getFullYear()} Aureon. All rights reserved.
        </p>
      </footer>
    </LandingBackground>
  );
};

export default FeatureTracker;
