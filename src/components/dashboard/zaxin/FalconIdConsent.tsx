// Zaxin Falcon — BIPA/DPPA consent gate for ID Mode
// ---------------------------------------------------
// Blocks camera+decode until the operator explicitly acknowledges:
//   - Face templates (Illinois BIPA, Texas CUBI, Washington)
//   - DMV data redisclosure (federal DPPA 18 U.S.C. §2721)
// Consent is persisted per-device in localStorage with a 24 h TTL.

import { useEffect, useState } from "react";
import { ShieldCheck, AlertOctagon } from "lucide-react";

const KEY = "falcon_id_consent_v1";
const TTL_MS = 24 * 60 * 60 * 1000;

export function hasIdConsent(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed?.ts && (Date.now() - parsed.ts) < TTL_MS;
  } catch { return false; }
}

export function grantIdConsent(): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ts: Date.now() })); } catch { /* */ }
}

export function revokeIdConsent(): void {
  try { localStorage.removeItem(KEY); } catch { /* */ }
}

export default function FalconIdConsent({ onGrant }: { onGrant: () => void }) {
  const [reviewed, setReviewed] = useState(false);
  const [checked, setChecked] = useState({ bipa: false, dppa: false, retention: false });
  const allChecked = checked.bipa && checked.dppa && checked.retention;

  useEffect(() => {
    const t = setTimeout(() => setReviewed(true), 800);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="rounded-2xl border border-amber-300/20 bg-gradient-to-b from-amber-500/[0.04] to-transparent p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertOctagon className="h-4 w-4 text-amber-300" strokeWidth={1.5} />
        <p className="text-[11px] tracking-[0.3em] uppercase text-amber-100/90 font-light">
          Falcon ID · Legal Consent Required
        </p>
      </div>
      <div className="space-y-2 text-[11px] text-foreground/75 font-light leading-relaxed">
        <p>
          <strong className="text-amber-100/90">Driver's Privacy Protection Act (18 U.S.C. §2721)</strong> —
          personal information decoded from a DL/ID barcode may not be redisclosed
          or reused outside the DPPA's permitted purposes. Some states (TX, NJ, NH,
          and others) add barcode-scanning specific restrictions.
        </p>
        <p>
          <strong className="text-amber-100/90">Biometric Information Privacy Acts</strong> —
          Illinois BIPA, Texas CUBI, and Washington law require informed consent
          before capturing biometric identifiers (face geometry). Face-crop
          matching in Falcon Phase 2 will require an additional per-subject
          consent flow.
        </p>
        <p>
          <strong className="text-amber-100/90">Data at rest</strong> — Falcon stores
          only irreversible SHA-256 hashes of the document number + DOB.
          Plaintext name, address, and document number live only in this browser
          tab's memory and are wiped when the tab closes.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <label className="flex items-start gap-2 text-[10.5px] text-foreground/80">
          <input type="checkbox" className="mt-0.5" checked={checked.dppa} onChange={(e) => setChecked({ ...checked, dppa: e.target.checked })} />
          <span>I have a DPPA-permitted purpose for reading this credential.</span>
        </label>
        <label className="flex items-start gap-2 text-[10.5px] text-foreground/80">
          <input type="checkbox" className="mt-0.5" checked={checked.bipa} onChange={(e) => setChecked({ ...checked, bipa: e.target.checked })} />
          <span>I acknowledge state biometric laws (BIPA/CUBI/WA) apply if I later enable face-match.</span>
        </label>
        <label className="flex items-start gap-2 text-[10.5px] text-foreground/80">
          <input type="checkbox" className="mt-0.5" checked={checked.retention} onChange={(e) => setChecked({ ...checked, retention: e.target.checked })} />
          <span>I understand plaintext data is session-scoped; only hashes persist.</span>
        </label>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          disabled={!allChecked || !reviewed}
          onClick={() => { grantIdConsent(); onGrant(); }}
          className="flex items-center gap-1.5 text-[10px] tracking-[0.22em] uppercase px-3 py-1.5 rounded-md bg-amber-500/25 text-amber-100 border border-amber-300/40 hover:bg-amber-500/35 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ShieldCheck className="h-3 w-3" strokeWidth={1.5} /> Acknowledge & Enable
        </button>
        <span className="text-[9px] text-muted-foreground/60">Consent lapses after 24 h.</span>
      </div>
    </div>
  );
}
