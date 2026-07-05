import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";

interface AuditRow {
  id: string; actor_id: string | null; action: string;
  target_type: string | null; target_id: string | null;
  metadata: Record<string, unknown>; created_at: string;
}

export default function AuditLogView() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  useEffect(() => {
    supabase.from("ziaassets_audit").select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setRows((data ?? []) as AuditRow[]));
  }, []);
  return (
    <div className="space-y-2">
      <Card className="p-4 bg-background/40 backdrop-blur border-white/10 flex items-center gap-2">
        <ScrollText className="w-5 h-5" />
        <div className="font-semibold">Audit Log</div>
        <span className="text-xs text-muted-foreground ml-auto">Last 200 events</span>
      </Card>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.id} className="p-2 rounded border border-white/10 bg-background/40 text-xs font-mono flex items-center gap-2">
            <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
            <Badge variant="outline">{r.action}</Badge>
            <span className="text-muted-foreground">{r.target_type ?? "-"}</span>
            <span className="text-muted-foreground/70 truncate">{r.actor_id?.slice(0, 8) ?? "system"}</span>
          </div>
        ))}
        {!rows.length && <div className="text-xs text-muted-foreground">No audit events recorded.</div>}
      </div>
    </div>
  );
}
