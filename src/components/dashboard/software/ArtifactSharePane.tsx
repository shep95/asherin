// Who can reach this artifact, and what leaves asherin with it.
//
// Sharing names a person and gives them a role. Publishing changes who can
// discover it. Export builds a package from what the artifact owns and refuses
// to build one that carries credentials or private session data.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Link2, Loader2, Send, ShieldOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { listFiles } from "@/lib/software/files";
import {
  INVITATION_PROBLEM_TEXT,
  VISIBILITY_MEANING,
  checkInvitation,
  createInvitation,
  createShareLink,
  invitationIsLive,
  invitationUrl,
  listInvitations,
  listMembers,
  listShareLinks,
  removeMember,
  revokeInvitation,
  revokeShareLink,
  setMemberRole,
  shareLinkIsLive,
  shareLinkUrl,
  type ArtifactMember,
} from "@/lib/software/sharing";
import {
  EXPORT_LABEL,
  buildExport,
  downloadPackage,
  formatAvailability,
  recordExport,
  scanExport,
  type ExportFormat,
} from "@/lib/software/exportPackage";
import { forkArtifact } from "@/lib/software/fork";
import type {
  ArtifactFile,
  ArtifactInvitation,
  ArtifactRole,
  InvitableRole,
  ShareLink,
  SoftwareArtifact,
  SoftwareVersion,
} from "@/lib/software/types";

const card = "rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm";
const chip = "rounded-lg border border-border/20 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground";

const INVITE_ROLES: InvitableRole[] = ["admin", "editor", "commenter", "viewer", "installer"];
const MEMBER_ROLES: ArtifactRole[] = ["admin", "editor", "commenter", "viewer", "installer"];

const ArtifactSharePane = ({
  artifact,
  currentVersion,
  role,
  isOwner,
  onForked,
}: {
  artifact: SoftwareArtifact;
  currentVersion: SoftwareVersion | null;
  role: ArtifactRole | null;
  isOwner: boolean;
  onForked?: (artifactId: string) => void;
}) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<ArtifactMember[]>([]);
  const [invitations, setInvitations] = useState<ArtifactInvitation[]>([]);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [files, setFiles] = useState<ArtifactFile[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InvitableRole>("viewer");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const canManage = isOwner || role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, i, l, f] = await Promise.all([
        listMembers(artifact.id),
        canManage ? listInvitations(artifact.id) : Promise.resolve([] as ArtifactInvitation[]),
        canManage ? listShareLinks(artifact.id) : Promise.resolve([] as ShareLink[]),
        listFiles(artifact.id),
      ]);
      setMembers(m);
      setInvitations(i);
      setLinks(l);
      setFiles(f);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "could not load access");
    } finally {
      setLoading(false);
    }
  }, [artifact.id, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const availability = useMemo(() => formatAvailability(artifact, files), [artifact, files]);
  const scan = useMemo(() => scanExport({ artifact, files }), [artifact, files]);

  const guard = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : label);
    } finally {
      setBusy(false);
    }
  };

  const invite = () =>
    void guard("could not create the invitation", async () => {
      const problem = checkInvitation({
        email,
        actorRole: isOwner ? "owner" : role,
        actorEmail: user?.email ?? null,
        memberEmails: [],
        pendingEmails: invitations.filter((i) => invitationIsLive(i)).map((i) => i.inviteeEmail),
      });
      if (problem) {
        toast.error(INVITATION_PROBLEM_TEXT[problem]);
        return;
      }
      const inv = await createInvitation({ artifactId: artifact.id, email, role: inviteRole, actorUserId: user!.id });
      setEmail("");
      await load();
      // no invite mailer is configured for this project, so nothing claims an
      // email went out — the inviter passes the link on themselves.
      await navigator.clipboard.writeText(invitationUrl(inv.token)).catch(() => undefined);
      toast.success("invitation created and its link copied — email delivery is not configured, so send it yourself");
    });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("copied");
    } catch {
      toast.error("your browser would not let asherin copy that");
    }
  };

  const runExport = (format: ExportFormat) =>
    void guard("export failed", async () => {
      try {
        const pkg = buildExport({ artifact, version: currentVersion, files, format });
        downloadPackage(pkg);
        await recordExport({
          artifactId: artifact.id,
          versionId: currentVersion?.id ?? null,
          actorUserId: user!.id,
          format,
          status: "created",
          manifest: pkg.manifest as unknown as Record<string, unknown>,
          findings: pkg.findings,
        });
        toast.success(`${EXPORT_LABEL[format]} downloaded`);
      } catch (e) {
        await recordExport({
          artifactId: artifact.id,
          versionId: currentVersion?.id ?? null,
          actorUserId: user!.id,
          format,
          status: "blocked",
          manifest: {},
          findings: scan.findings,
        });
        throw e;
      }
    });

  const fork = () =>
    void guard("fork failed", async () => {
      const created = await forkArtifact({ source: artifact, sourceVersion: currentVersion, userId: user!.id });
      toast.success("forked — the copy has its own identity, versions and data");
      onForked?.(created.id);
    });

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> loading access
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={`${card} p-5`}>
        <h2 className="mb-1 text-sm tracking-wide text-foreground">people with access</h2>
        <p className="mb-3 text-[11px] text-muted-foreground">
          visibility is {artifact.visibility} — {VISIBILITY_MEANING[artifact.visibility]}
        </p>

        {canManage && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email address"
              className="min-w-[12rem] flex-1 rounded-lg border border-border/20 bg-background/40 px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary/40"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as InvitableRole)}
              className="rounded-lg border border-border/20 bg-background/40 px-2 py-1.5 text-xs text-foreground"
            >
              {INVITE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              disabled={busy || !email.trim()}
              onClick={invite}
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-xs text-primary disabled:opacity-40 hover:bg-primary/10"
            >
              <Send className="h-3.5 w-3.5" /> invite
            </button>
          </div>
        )}

        <ul className="space-y-2 text-xs">
          <li className="flex items-center justify-between rounded-lg border border-border/15 px-3 py-2">
            <span className="text-foreground/80">owner</span>
            <span className={chip}>owner</span>
          </li>
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/15 px-3 py-2">
              <span className="truncate text-foreground/80">{m.userId}</span>
              <div className="flex items-center gap-2">
                <select
                  disabled={!canManage || busy}
                  value={m.role}
                  onChange={(e) =>
                    void guard("could not change that role", async () => {
                      await setMemberRole({ member: m, role: e.target.value as ArtifactRole, actorUserId: user!.id });
                      await load();
                      toast.success("role changed — the change is in this artifact's history");
                    })
                  }
                  className="rounded-lg border border-border/20 bg-background/40 px-2 py-1 text-[11px] text-foreground disabled:opacity-50"
                >
                  {MEMBER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                {canManage && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void guard("could not remove access", async () => {
                        await removeMember(m, user!.id);
                        await load();
                        toast.success("access removed — it is re-checked on every request");
                      })
                    }
                    className="text-destructive/70 hover:text-destructive"
                    aria-label="remove access"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
          {!members.length && <li className="text-[11px] text-muted-foreground">nobody else has access yet</li>}
        </ul>

        {canManage && !!invitations.length && (
          <>
            <h3 className="mt-5 mb-2 text-xs tracking-wide text-foreground">invitations</h3>
            <ul className="space-y-2 text-xs">
              {invitations.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/15 px-3 py-2">
                  <span className="truncate text-foreground/80">{i.inviteeEmail}</span>
                  <div className="flex items-center gap-2">
                    <span className={chip}>
                      {i.role} · {invitationIsLive(i) ? "pending" : i.status}
                      {i.delivery === "pending" ? " · not emailed" : ""}
                    </span>
                    {invitationIsLive(i) && (
                      <>
                        <button onClick={() => void copy(invitationUrl(i.token))} className="text-muted-foreground hover:text-foreground" aria-label="copy invitation link">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void guard("could not revoke", async () => {
                              await revokeInvitation(i, user!.id);
                              await load();
                            })
                          }
                          className="text-destructive/70 hover:text-destructive"
                          aria-label="revoke invitation"
                        >
                          <ShieldOff className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {canManage && (
          <>
            <h3 className="mt-5 mb-2 text-xs tracking-wide text-foreground">share links</h3>
            <p className="mb-2 text-[11px] text-muted-foreground">
              a link carries its own secret token — the artifact id alone never opens anything.
            </p>
            <button
              disabled={busy}
              onClick={() =>
                void guard("could not create a link", async () => {
                  const link = await createShareLink({ artifactId: artifact.id, role: "viewer", actorUserId: user!.id });
                  await load();
                  await copy(shareLinkUrl(link.token));
                })
              }
              className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-border/25 px-3 py-1.5 text-xs text-foreground/80 hover:bg-foreground/5"
            >
              <Link2 className="h-3.5 w-3.5" /> create view link
            </button>
            <ul className="space-y-2 text-xs">
              {links.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/15 px-3 py-2">
                  <span className="truncate text-foreground/70">…{l.token.slice(-8)}</span>
                  <div className="flex items-center gap-2">
                    <span className={chip}>{shareLinkIsLive(l) ? l.role : "revoked"}</span>
                    <button onClick={() => void copy(shareLinkUrl(l.token))} className="text-muted-foreground hover:text-foreground" aria-label="copy share link">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    {shareLinkIsLive(l) && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void guard("could not revoke that link", async () => {
                            await revokeShareLink(l, user!.id);
                            await load();
                          })
                        }
                        className="text-destructive/70 hover:text-destructive"
                        aria-label="revoke share link"
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
              {!links.length && <li className="text-[11px] text-muted-foreground">no links yet</li>}
            </ul>
          </>
        )}
      </section>

      <section className={`${card} p-5`}>
        <h2 className="mb-1 text-sm tracking-wide text-foreground">download and export</h2>
        <p className="mb-3 text-[11px] text-muted-foreground">
          every package is scanned before it is built. keys, tokens and private session data are never included.
        </p>

        <ul className="mb-4 space-y-1 text-[11px]">
          {scan.findings.map((f, idx) => (
            <li
              key={idx}
              className={
                f.severity === "block" ? "text-destructive" : f.severity === "warn" ? "text-amber-400/90" : "text-primary"
              }
            >
              {f.scan} — {f.detail}
              {f.path ? ` (${f.path})` : ""}
            </li>
          ))}
        </ul>

        <div className="grid gap-2 sm:grid-cols-2">
          {availability.map((a) => (
            <button
              key={a.format}
              disabled={busy || !a.available || scan.blocked}
              title={a.available ? "" : a.reason}
              onClick={() => runExport(a.format)}
              className="rounded-lg border border-border/25 px-3 py-2 text-left text-xs text-foreground/80 disabled:opacity-40 hover:bg-foreground/5"
            >
              {EXPORT_LABEL[a.format]}
              <span className="block text-[10px] text-muted-foreground">{a.available ? "available" : `unavailable — ${a.reason}`}</span>
            </button>
          ))}
        </div>
        {scan.blocked && (
          <p className="mt-3 text-[11px] text-destructive">
            exporting is blocked until the findings above are cleared.
          </p>
        )}

        <h3 className="mt-6 mb-2 text-xs tracking-wide text-foreground">fork</h3>
        <p className="mb-2 text-[11px] text-muted-foreground">
          a fork is a new artifact with its own id, versions, data and installations. it remembers this one as upstream.
        </p>
        {artifact.parentArtifactId && (
          <p className="mb-2 text-[11px] text-muted-foreground">
            this artifact was itself forked from {artifact.parentArtifactId}
          </p>
        )}
        <button
          disabled={busy}
          onClick={fork}
          className="rounded-lg border border-border/25 px-3 py-1.5 text-xs text-foreground/80 disabled:opacity-40 hover:bg-foreground/5"
        >
          fork this artifact
        </button>
      </section>
    </div>
  );
};

export default ArtifactSharePane;
