import { isOwnerEmail } from "@/lib/adminEmail";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, LogOut } from "lucide-react";

const ALLOWED_EMAILS = new Set([ADMIN_EMAIL, "ekk447@gmail.com", "28numberofmoney@gmail.com"]);
const RESTRICTED_HOSTS = new Set(["aureonai.app", "www.aureonai.app"]);

/**
 * Hard restriction: on the aureonai.app production domain, ONLY
 * ashernewtonx@gmail.com is permitted. Everyone else sees a lockout
 * screen and is signed out. Other hosts (preview, lovable.app, custom
 * staging) are unaffected.
 */
const AureonDomainGate = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const [host, setHost] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHost(window.location.hostname.toLowerCase());
    }
  }, []);

  const isRestricted = RESTRICTED_HOSTS.has(host);
  if (!isRestricted) return <>{children}</>;
  // SECURITY: render nothing while auth resolves so child components do not
  // fire data requests with whatever JWT happens to be in storage.
  if (loading) return null;

  const email = (user?.email || "").toLowerCase();
  const allowed = ALLOWED_EMAILS.has(email);
  if (allowed) return <>{children}</>;

  // Block everyone else on this domain. Redirect to a stable internal path
  // (NOT an external Lovable preview URL — that project could be reclaimed).
  const handleSignOut = async () => {
    try { await supabase.auth.signOut(); } catch { /* ignore */ }
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full rounded-2xl border border-red-400/30 bg-gradient-to-br from-red-500/[0.04] via-card/40 to-card/10 backdrop-blur-xl p-8 text-center space-y-4">
        <div className="mx-auto h-12 w-12 rounded-xl bg-red-500/15 border border-red-400/30 flex items-center justify-center">
          <ShieldAlert className="h-6 w-6 text-red-300" />
        </div>
        <div className="space-y-1">
          <div className="text-[10px] font-mono tracking-[0.3em] text-red-300/80 uppercase">Restricted Domain</div>
          <h1 className="text-base font-light tracking-wide text-foreground">aureonai.app is private</h1>
        </div>
        <p className="text-[11px] font-extralight text-muted-foreground/80 leading-relaxed">
          This domain is reserved for the platform owner. Access from any other account is denied.
        </p>
        {user && (
          <div className="rounded-lg border border-border/30 bg-background/40 px-3 py-2 text-[10px] font-mono tracking-wide text-muted-foreground/70 break-all">
            Signed in as: <span className="text-foreground/80">{user.email}</span>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 hover:bg-foreground/5 px-4 py-2 text-[11px] font-light tracking-wide text-foreground/90 transition"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out & leave
        </button>
      </div>
    </div>
  );
};

export default AureonDomainGate;
