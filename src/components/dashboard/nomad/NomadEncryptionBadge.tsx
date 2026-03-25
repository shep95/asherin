import { Lock } from "lucide-react";

const NomadEncryptionBadge = () => (
  <div className="flex items-center gap-1.5 text-[9px] font-extralight text-emerald-400/60" title="Investigation data encrypted at rest (AES-256-GCM)">
    <Lock className="h-3 w-3" />
    <span>E2E Encrypted</span>
  </div>
);

export default NomadEncryptionBadge;
