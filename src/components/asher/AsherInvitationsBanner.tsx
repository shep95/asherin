import { useEffect, useState } from "react";
import { Mail, Check } from "lucide-react";
import { listMyInvitations, acceptInvitation } from "@/lib/asherOrgs";
import { toast } from "sonner";

export default function AsherInvitationsBanner({ onAccepted }: { onAccepted?: () => void }) {
  const [invites, setInvites] = useState<any[]>([]);

  const refresh = async () => {
    try { setInvites(await listMyInvitations()); } catch {}
  };
  useEffect(() => { refresh(); }, []);

  // Auto-pick from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (!token) return;
    (async () => {
      try {
        await acceptInvitation(token);
        toast.success("Invitation accepted");
        params.delete("invite");
        const url = window.location.pathname + (params.toString() ? `?${params}` : "");
        window.history.replaceState({}, "", url);
        refresh();
        onAccepted?.();
      } catch (e: any) { toast.error(e.message); }
    })();
  }, []);

  if (invites.length === 0) return null;
  return (
    <div className="border-b border-amber-500/20 bg-amber-500/5 px-6 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Mail className="h-3.5 w-3.5 text-amber-400" strokeWidth={1.5} />
        <span className="text-[11px] font-light tracking-wider text-amber-200">
          You have {invites.length} pending invitation{invites.length>1?"s":""}
        </span>
        {invites.map((i) => (
          <button
            key={i.id}
            onClick={async () => {
              try { await acceptInvitation(i.token); toast.success(`Joined ${i.asher_orgs?.name || "organization"}`); await refresh(); onAccepted?.(); }
              catch (e: any) { toast.error(e.message); }
            }}
            className="text-[10px] tracking-[0.2em] uppercase px-2.5 py-1 border border-amber-500/30 rounded hover:bg-amber-500/10 flex items-center gap-1 text-amber-200"
          >
            <Check className="h-3 w-3" /> Accept · {i.asher_orgs?.name || "Org"} · {i.role}
          </button>
        ))}
      </div>
    </div>
  );
}
