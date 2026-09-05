import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type AuthorizationDetails = {
  client?: { name?: string | null; client_uri?: string | null } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthNamespace = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

function oauthNamespace(): OAuthNamespace | null {
  const ns = (supabase.auth as unknown as { oauth?: OAuthNamespace }).oauth;
  return ns ?? null;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!authorizationId) {
        setError("This link is missing its authorization reference.");
        return;
      }
      const oauth = oauthNamespace();
      if (!oauth) {
        setError("This account service does not support app authorizations yet.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/auth?next=${encodeURIComponent(next)}`;
        return;
      }
      const { data, error: detailsError } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detailsError) {
        setError(detailsError.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    const oauth = oauthNamespace();
    if (!oauth) return;
    setBusy(true);
    const { data, error: decideError } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (decideError) {
      setBusy(false);
      setError(decideError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("the authorization server did not return a place to send you back to.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name?.trim() || "an application";

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-8">
        {error ? (
          <>
            <h1 className="text-xl font-extralight tracking-tight">authorization unavailable</h1>
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
            <a
              href="/dashboard"
              className="mt-6 inline-flex items-center rounded-xl border border-border/60 px-4 py-2 text-sm"
            >
              back to asherin
            </a>
          </>
        ) : !details ? (
          <p className="text-sm text-muted-foreground">loading this authorization request…</p>
        ) : (
          <>
            <h1 className="text-xl font-extralight tracking-tight">
              connect {clientName} to your account
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              this lets {clientName} use asherin as you: read and create the items your account
              already has access to. you can revoke it at any time.
            </p>
            <div className="mt-8 flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void decide(true)}
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void decide(false)}
                className="flex-1 rounded-xl border border-border/60 px-4 py-2 text-sm disabled:opacity-50"
              >
                deny
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
