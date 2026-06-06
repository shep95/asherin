import { useEffect, useState } from "react";
import FeaturePageShell from "@/components/landing/FeaturePageShell";
import {
  Shield, KeyRound, Lock, Activity, Fingerprint, Cpu, ServerCog,
  Network, Database, FileLock, Zap, ExternalLink,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// NOMAD CYBER ALGORITHM — frontend surface for the post-quantum sovereign stack
// Repo: https://github.com/houseofasher/nomad_cyber_algorithm
// The actual server (Node/TS, Kyber1024 + Dilithium5, liboqs, HSM/TPM, vaults)
// runs out-of-band. This page documents the architecture and renders a live
// simulated "Sovereign Organism" pulse so operators can preview vitals.
// ─────────────────────────────────────────────────────────────────────────────

const ORGANS = [
  { key: "crypto",  name: "Crypto Core",     glyph: "♥",  role: "liboqs Kyber1024 + Dilithium5 self-test" },
  { key: "spleen",  name: "Supply Spleen",   glyph: "◈",  role: "SBOM hash verification" },
  { key: "immune",  name: "Audit Immune",    glyph: "🛡", role: "Chained HMAC tamper-evident log" },
  { key: "tpm",     name: "TPM Skeletal",    glyph: "◉",  role: "Boot PCR attestation" },
  { key: "hsm",     name: "HSM Heart",       glyph: "♥",  role: "Non-extractable hardware keys" },
  { key: "ca",      name: "CA Liver",        glyph: "◆",  role: "QS-CA + Certificate Transparency" },
  { key: "console", name: "Console Brain",   glyph: "◯",  role: "Argon2id + WebAuthn + ZK proof" },
  { key: "nerves",  name: "Rate Nerves",     glyph: "⚡", role: "Distributed Redis rate limits" },
  { key: "lungs",   name: "PQC Lungs",       glyph: "◐",  role: "Kyber/Dilithium secure channels" },
  { key: "skin",    name: "Gateway Skin",    glyph: "▣",  role: "RBAC perimeter + session auth" },
  { key: "marrow",  name: "Vault Marrow",    glyph: "▤",  role: "Encrypted data-at-rest" },
];

const OrganismPulse = () => {
  const [pulse, setPulse] = useState(0);
  const [verdict, setVerdict] = useState<"VITAL" | "PULSING">("VITAL");

  useEffect(() => {
    const id = setInterval(() => {
      setPulse((p) => p + 1);
      setVerdict("PULSING");
      setTimeout(() => setVerdict("VITAL"), 900);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="rounded-3xl border border-border/35 bg-card/55 backdrop-blur-2xl p-8 shadow-[0_18px_55px_-25px_hsl(var(--foreground)/0.45)]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Sovereign Organism</div>
            <h2 className="text-xl font-extralight mt-1">
              Pulse #{pulse} —{" "}
              <span className={verdict === "VITAL" ? "text-emerald-400" : "text-amber-400"}>{verdict}</span>
            </h2>
          </div>
          <a
            href="https://github.com/houseofasher/nomad_cyber_algorithm"
            target="_blank" rel="noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-light"
          >
            Source <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <p className="text-xs font-light text-muted-foreground mb-6 max-w-3xl leading-relaxed">
          Eleven organs re-verified every 30 seconds. Partial compromise = total shutdown. Vault
          encryption binds to the organism fingerprint — data sealed under one pulse cannot be read
          under another.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {ORGANS.map((o) => (
            <div
              key={o.key}
              className="rounded-xl border border-border/30 bg-background/30 p-3 transition-all hover:border-border/60"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none">{o.glyph}</span>
                <span className="text-sm font-light">{o.name}</span>
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400/80 animate-pulse" />
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground font-light leading-relaxed">{o.role}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid md:grid-cols-3 gap-3 text-[10px] font-light text-muted-foreground">
          <div className="rounded-xl border border-border/30 bg-background/30 p-3">
            <div className="uppercase tracking-[0.25em] mb-1">KEM</div>
            <div className="text-foreground/80 font-mono">Kyber1024 (ML-KEM)</div>
          </div>
          <div className="rounded-xl border border-border/30 bg-background/30 p-3">
            <div className="uppercase tracking-[0.25em] mb-1">Signature</div>
            <div className="text-foreground/80 font-mono">Dilithium5</div>
          </div>
          <div className="rounded-xl border border-border/30 bg-background/30 p-3">
            <div className="uppercase tracking-[0.25em] mb-1">Record</div>
            <div className="text-foreground/80 font-mono">AES-256-GCM + HKDF</div>
          </div>
        </div>
      </div>
    </section>
  );
};

const FeatureNomadCyber = () => (
  <FeaturePageShell
    documentTitle="Nomad Cyber Algorithm — Post-Quantum Sovereign Stack | Aureon"
    eyebrow="Post-Quantum Defence"
    headline={<>Quantum-Resistant.<br /><span className="text-muted-foreground">Sovereign by design.</span></>}
    subheadline="Nomad Cyber Algorithm is the post-quantum cryptography stack powering Aureon's secure microservice mesh — Kyber1024 KEM, Dilithium5 signatures, chaos-mode wire patterns, and an eleven-organ sovereign organism that re-verifies itself every 30 seconds. Built by Aureon Software, used by ARVOR for zero-knowledge messaging."
    tierLabel="Aureon — $199/mo"
    capabilities={[
      { icon: KeyRound,    title: "Kyber1024 Key Exchange",       description: "ML-KEM lattice key encapsulation via liboqs. Forward-secret session keys resistant to Shor's algorithm." },
      { icon: Fingerprint, title: "Dilithium5 Signatures",        description: "NIST-selected post-quantum signature scheme for authentication and certificate transparency log entries." },
      { icon: Lock,        title: "Imperial 7-Layer Cipher",      description: "Seven historical cipher layers stacked beneath AES-256-GCM, wrapped in an Aureon occult veil for plaintext indistinguishability." },
      { icon: Zap,         title: "Chaos Mode",                   description: "Per-message unpredictable layer order, padding, and timing jitter. No wire patterns for traffic-analysis adversaries." },
      { icon: Cpu,         title: "HSM + TPM Attestation",        description: "Non-extractable hardware keys plus boot-time PCR attestation. Tamper of either organ triggers immediate lockdown." },
      { icon: Shield,      title: "QS-CA Certificate Pinning",    description: "Quantum-safe internal CA with mutual TLS, allowlists, and chained HMAC tamper-evident audit." },
      { icon: ServerCog,   title: "Sovereign Gateway",            description: "RBAC API gateway + MFA console (Argon2id, WebAuthn, RFC 6238 TOTP, ZK proofs) with distributed Redis rate limits." },
      { icon: Database,    title: "DB Field Vault",               description: "Per-field encryption bound to the organism fingerprint — data sealed under one pulse cannot be read under another." },
      { icon: FileLock,    title: "File Vault",                   description: "Encrypted data-at-rest with chunked streaming, key rotation, and TPM-sealed master secrets." },
      { icon: Network,     title: "PQC Sidecar",                  description: "Length-prefixed TCP framing with optional sidecar for legacy services that cannot embed the PQC core directly." },
      { icon: Activity,    title: "Sovereign Organism",           description: "Eleven organs pulsed every 30s. Breach the audit chain, lose TPM, or disconnect the HSM → total lockdown." },
      { icon: Shield,      title: "SBOM + SAST/DAST Gates",       description: "Software bill of materials hash verification plus CI security gates. Supply chain integrity, enforced at deploy." },
    ]}
    useCases={[
      "Air-gapped SCI/TS workloads with post-quantum forward secrecy",
      "Zero-knowledge messaging and private vault operations (ARVOR)",
      "Microservice mesh with mutual PQC authentication",
      "Long-lived secret protection against harvest-now-decrypt-later",
      "High-assurance gateways with hardware-rooted trust",
    ]}
    ctaTitle="Sovereign. Quantum-Safe. Alive."
    ctaSubtitle="Nomad Cyber Algorithm is open source on GitHub and powers the secure layer of Aureon ($199/mo) and above."
  >
    <OrganismPulse />
  </FeaturePageShell>
);

export default FeatureNomadCyber;
