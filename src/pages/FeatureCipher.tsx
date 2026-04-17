import FeaturePageShell from "@/components/landing/FeaturePageShell";
import { Lock, Key, FileLock, Hash, Shield, Fingerprint, Layers, Eye, Zap } from "lucide-react";

const FeatureCipher = () => (
  <FeaturePageShell
    documentTitle="Cipher — Cryptographic Operations Suite | Aureon"
    eyebrow="Cryptographic Intelligence"
    headline={<>Cryptography Without<br /><span className="text-muted-foreground">the PhD.</span></>}
    subheadline="Cipher is the operations suite for symmetric, asymmetric, hashing, and post-quantum primitives. AES-256-GCM, Ed25519, lattice-based KEM, plus HMAC verification and steganographic hiding — all in one console."
    tierLabel="Aureon — $199/mo"
    capabilities={[
      { icon: Lock, title: "Symmetric Encryption", description: "AES-256-GCM with authenticated encryption, IV management, and AAD support." },
      { icon: Key, title: "Asymmetric Operations", description: "Ed25519 / X25519 / ECDSA key generation, signing, and verification flows." },
      { icon: Shield, title: "Post-Quantum Primitives", description: "Lattice-based KEM (Kyber-style) for forward secrecy against quantum adversaries." },
      { icon: Hash, title: "Hashing & MACs", description: "SHA-256 / SHA-3 / BLAKE3 / HMAC with constant-time comparison." },
      { icon: FileLock, title: "File Encryption", description: "Drag-drop file encryption with chunked streaming for large payloads." },
      { icon: Fingerprint, title: "Key Fingerprinting", description: "Visual fingerprints, QR exchange, and trust-on-first-use management." },
      { icon: Layers, title: "Steganography", description: "Hide payloads inside images, audio, and code comments with detection metrics." },
      { icon: Eye, title: "Side-Channel Awareness", description: "Constant-time operations, memory wiping, and timing-attack prevention built in." },
      { icon: Zap, title: "Real-World Recipes", description: "One-click recipes for messaging, file vault, signed releases, and hardware-token auth." },
    ]}
    useCases={[
      "End-to-end encrypted messaging without trusting a vendor",
      "Secure file vaults with per-recipient keys",
      "Signed release artifacts for software distribution",
      "Quantum-resilient key exchange for long-lived secrets",
      "Steganographic payload delivery for high-OPSEC operations",
    ]}
    ctaTitle="Real Cryptography. Operationalized."
    ctaSubtitle="Cipher is included in Aureon ($199/mo) and above."
  />
);

export default FeatureCipher;
