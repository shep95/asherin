import { useState, useEffect } from "react";
import { GitBranch, GitCommit, GitPullRequest, Upload, Download, FolderGit, Loader2, Check, X, RefreshCw, Plus, Trash2, Eye, ChevronRight } from "lucide-react";
import { useGitHub, type GitHubCommit, type GitHubBranch } from "@/hooks/useGitHub";
import { useToast } from "@/hooks/use-toast";
import type { IdeFile } from "./IdeFileTree";

interface Props {
  files: IdeFile[];
  onImportFiles?: (files: IdeFile[]) => void;
}

function flattenForPush(files: IdeFile[], prefix = ""): { path: string; content: string }[] {
  const result: { path: string; content: string }[] = [];
  for (const f of files) {
    const p = prefix ? `${prefix}/${f.name}` : f.name;
    if (f.type === "file" && f.content !== undefined) {
      result.push({ path: p, content: f.content });
    }
    if (f.children) result.push(...flattenForPush(f.children, p));
  }
  return result;
}

const IdeGitPanel = ({ files, onImportFiles }: Props) => {
  const { toast } = useToast();
  const { connection, loading: connLoading, isConnected, connect, disconnect, listBranches, getCommits, getContents, getFile, pushFiles, listRepos, createRepo } = useGitHub();

  const [tab, setTab] = useState<"status" | "branches" | "history" | "repos">("status");
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [repos, setRepos] = useState<any[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Connect form
  const [showConnect, setShowConnect] = useState(false);
  const [token, setToken] = useState("");
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [branch, setBranch] = useState("main");

  // New repo form
  const [showNewRepo, setShowNewRepo] = useState(false);
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoDesc, setNewRepoDesc] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);

  useEffect(() => {
    if (isConnected && tab === "branches") loadBranches();
    if (isConnected && tab === "history") loadCommits();
    if (isConnected && tab === "repos") loadRepos();
  }, [isConnected, tab]);

  const loadBranches = async () => {
    setLoadingAction("branches");
    try {
      const data = await listBranches();
      setBranches(data.branches || []);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    setLoadingAction(null);
  };

  const loadCommits = async () => {
    setLoadingAction("commits");
    try {
      const data = await getCommits();
      setCommits(data.commits || []);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    setLoadingAction(null);
  };

  const loadRepos = async () => {
    setLoadingAction("repos");
    try {
      const data = await listRepos();
      setRepos(data.repos || []);
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    setLoadingAction(null);
  };

  const handleConnect = async () => {
    if (!token || !repoOwner || !repoName) return;
    setLoadingAction("connect");
    try {
      await connect(token, repoOwner, repoName, branch);
      setShowConnect(false);
      setToken("");
      toast({ title: "Connected to GitHub", description: `${repoOwner}/${repoName}` });
    } catch (err: any) {
      toast({ title: "Connection failed", description: err.message, variant: "destructive" });
    }
    setLoadingAction(null);
  };

  const handleDisconnect = async () => {
    setLoadingAction("disconnect");
    try {
      await disconnect();
      toast({ title: "Disconnected from GitHub" });
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }); }
    setLoadingAction(null);
  };

  const handlePush = async () => {
    const allFiles = flattenForPush(files);
    if (allFiles.length === 0) { toast({ title: "No files to push" }); return; }
    setLoadingAction("push");
    try {
      await pushFiles(allFiles, `Push ${allFiles.length} files from Aureon IDE`);
      toast({ title: "Pushed to GitHub", description: `${allFiles.length} files updated` });
    } catch (err: any) { toast({ title: "Push failed", description: err.message, variant: "destructive" }); }
    setLoadingAction(null);
  };

  const handleImport = async () => {
    setLoadingAction("import");
    try {
      const data = await getContents();
      const contents = data.contents;
      if (!Array.isArray(contents)) { toast({ title: "Empty repo" }); setLoadingAction(null); return; }

      const importedFiles: IdeFile[] = [];
      for (const item of contents) {
        if (item.type === "file") {
          try {
            const fileData = await getFile(item.path);
            importedFiles.push({ id: item.sha, name: item.name, type: "file", content: fileData.content });
          } catch { /* skip binary files */ }
        } else if (item.type === "dir") {
          importedFiles.push({ id: item.sha, name: item.name, type: "folder", children: [] });
        }
      }

      if (onImportFiles && importedFiles.length > 0) {
        onImportFiles(importedFiles);
        toast({ title: "Imported from GitHub", description: `${importedFiles.length} items imported` });
      }
    } catch (err: any) { toast({ title: "Import failed", description: err.message, variant: "destructive" }); }
    setLoadingAction(null);
  };

  const handleCreateRepo = async () => {
    if (!newRepoName.trim()) return;
    setLoadingAction("create-repo");
    try {
      const data = await createRepo(newRepoName, newRepoDesc, newRepoPrivate);
      setShowNewRepo(false);
      setNewRepoName("");
      setNewRepoDesc("");
      toast({ title: "Repository created", description: data.repo.full_name });
      loadRepos();
    } catch (err: any) { toast({ title: "Failed", description: err.message, variant: "destructive" }); }
    setLoadingAction(null);
  };

  if (connLoading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" /></div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-border/10 flex items-center gap-1.5">
        <FolderGit className="h-3 w-3 text-muted-foreground/50" />
        <span className="text-[10px] font-light tracking-wider text-muted-foreground/60 uppercase">GitHub</span>
        {isConnected && (
          <span className="ml-auto text-[8px] text-emerald-500 flex items-center gap-0.5">
            <Check className="h-2 w-2" /> Connected
          </span>
        )}
      </div>

      {!isConnected ? (
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
          {!showConnect ? (
            <div className="text-center space-y-3 py-4">
              <FolderGit className="h-8 w-8 text-muted-foreground/20 mx-auto" />
              <p className="text-[10px] text-muted-foreground/50 font-light">Connect your GitHub account to import and export code</p>
              <button onClick={() => setShowConnect(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/20 bg-foreground/5 text-[10px] font-light text-foreground hover:bg-foreground/10 transition-colors">
                <GitBranch className="h-3 w-3" /> Connect GitHub
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[9px] font-light text-muted-foreground/50 uppercase tracking-wider">Connect Repository</p>
              <input value={token} onChange={e => setToken(e.target.value)} placeholder="GitHub Personal Access Token" type="password" className="w-full bg-card/20 border border-border/15 rounded-lg px-2 py-1.5 text-[10px] font-light text-foreground outline-none placeholder:text-muted-foreground/30" />
              <div className="flex gap-1.5">
                <input value={repoOwner} onChange={e => setRepoOwner(e.target.value)} placeholder="Owner" className="flex-1 bg-card/20 border border-border/15 rounded-lg px-2 py-1.5 text-[10px] font-light text-foreground outline-none placeholder:text-muted-foreground/30" />
                <input value={repoName} onChange={e => setRepoName(e.target.value)} placeholder="Repo name" className="flex-1 bg-card/20 border border-border/15 rounded-lg px-2 py-1.5 text-[10px] font-light text-foreground outline-none placeholder:text-muted-foreground/30" />
              </div>
              <input value={branch} onChange={e => setBranch(e.target.value)} placeholder="Branch (default: main)" className="w-full bg-card/20 border border-border/15 rounded-lg px-2 py-1.5 text-[10px] font-light text-foreground outline-none placeholder:text-muted-foreground/30" />
              <p className="text-[8px] text-muted-foreground/30 leading-relaxed">
                Create a token at github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens. Grant "Contents" read/write permission.
              </p>
              <div className="flex gap-1.5">
                <button onClick={handleConnect} disabled={!token || !repoOwner || !repoName || loadingAction === "connect"} className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-foreground/10 text-foreground text-[10px] font-light py-1.5 hover:bg-foreground/15 transition-colors disabled:opacity-30">
                  {loadingAction === "connect" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Connect
                </button>
                <button onClick={() => setShowConnect(false)} className="px-3 py-1.5 rounded-lg border border-border/15 text-[10px] font-light text-muted-foreground hover:text-foreground transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Repo info */}
          <div className="px-2 py-1.5 border-b border-border/10 flex items-center gap-1.5">
            <span className="text-[9px] font-light text-foreground truncate">{connection?.repo_owner}/{connection?.repo_name}</span>
            <span className="text-[8px] text-muted-foreground/40 bg-card/30 rounded px-1 py-0.5">{connection?.branch}</span>
            <button onClick={handleDisconnect} className="ml-auto p-0.5 text-muted-foreground/30 hover:text-destructive transition-colors" title="Disconnect">
              <X className="h-2.5 w-2.5" />
            </button>
          </div>

          {/* Actions bar */}
          <div className="flex gap-1 px-2 py-1.5 border-b border-border/10">
            <button onClick={handlePush} disabled={!!loadingAction} className="flex items-center gap-0.5 px-2 py-1 rounded text-[9px] font-light text-foreground bg-foreground/5 hover:bg-foreground/10 transition-colors disabled:opacity-30">
              {loadingAction === "push" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Upload className="h-2.5 w-2.5" />} Push
            </button>
            <button onClick={handleImport} disabled={!!loadingAction} className="flex items-center gap-0.5 px-2 py-1 rounded text-[9px] font-light text-foreground bg-foreground/5 hover:bg-foreground/10 transition-colors disabled:opacity-30">
              {loadingAction === "import" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Download className="h-2.5 w-2.5" />} Pull
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border/10">
            {([
              { id: "status" as const, label: "Status", icon: GitPullRequest },
              { id: "branches" as const, label: "Branches", icon: GitBranch },
              { id: "history" as const, label: "History", icon: GitCommit },
              { id: "repos" as const, label: "Repos", icon: FolderGit },
            ]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-0.5 py-1.5 text-[8px] font-light transition-colors ${tab === t.id ? "text-foreground border-b border-foreground/30" : "text-muted-foreground/40 hover:text-foreground"}`}
              >
                <t.icon className="h-2.5 w-2.5" /> {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
            {tab === "status" && (
              <div className="space-y-2">
                <div className="rounded-lg border border-border/10 bg-card/10 p-3 space-y-2">
                  <p className="text-[9px] font-light text-muted-foreground/50 uppercase tracking-wider">Working Tree</p>
                  <p className="text-[10px] text-foreground font-light">{flattenForPush(files).length} files in workspace</p>
                  {connection?.last_sync_at && (
                    <p className="text-[8px] text-muted-foreground/40">Last sync: {new Date(connection.last_sync_at).toLocaleString()}</p>
                  )}
                </div>
              </div>
            )}

            {tab === "branches" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-light text-muted-foreground/40 uppercase tracking-wider">Branches</p>
                  <button onClick={loadBranches} className="p-0.5 text-muted-foreground/30 hover:text-foreground transition-colors">
                    <RefreshCw className={`h-2.5 w-2.5 ${loadingAction === "branches" ? "animate-spin" : ""}`} />
                  </button>
                </div>
                {branches.map(b => (
                  <div key={b.name} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-light ${b.name === connection?.branch ? "border-foreground/20 bg-foreground/5 text-foreground" : "border-border/10 text-muted-foreground/60"}`}>
                    <GitBranch className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{b.name}</span>
                    {b.protected && <span className="text-[7px] text-muted-foreground/40 bg-card/30 rounded px-1">protected</span>}
                    {b.name === connection?.branch && <Check className="h-2.5 w-2.5 ml-auto shrink-0" />}
                  </div>
                ))}
                {branches.length === 0 && !loadingAction && <p className="text-[9px] text-muted-foreground/30 text-center py-4">No branches loaded</p>}
              </div>
            )}

            {tab === "history" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-light text-muted-foreground/40 uppercase tracking-wider">Commits</p>
                  <button onClick={loadCommits} className="p-0.5 text-muted-foreground/30 hover:text-foreground transition-colors">
                    <RefreshCw className={`h-2.5 w-2.5 ${loadingAction === "commits" ? "animate-spin" : ""}`} />
                  </button>
                </div>
                {commits.map(c => (
                  <div key={c.sha} className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg border border-border/10">
                    <GitCommit className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-light text-foreground truncate">{c.message}</p>
                      <p className="text-[8px] text-muted-foreground/40">{c.author} · {new Date(c.date).toLocaleDateString()}</p>
                    </div>
                    <span className="text-[7px] font-mono text-muted-foreground/30 shrink-0">{c.sha.slice(0, 7)}</span>
                  </div>
                ))}
                {commits.length === 0 && !loadingAction && <p className="text-[9px] text-muted-foreground/30 text-center py-4">No commits loaded</p>}
              </div>
            )}

            {tab === "repos" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-light text-muted-foreground/40 uppercase tracking-wider">Your Repos</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setShowNewRepo(!showNewRepo)} className="p-0.5 text-muted-foreground/30 hover:text-foreground transition-colors">
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                    <button onClick={loadRepos} className="p-0.5 text-muted-foreground/30 hover:text-foreground transition-colors">
                      <RefreshCw className={`h-2.5 w-2.5 ${loadingAction === "repos" ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                {showNewRepo && (
                  <div className="rounded-lg border border-border/15 bg-card/10 p-2 space-y-1.5">
                    <input value={newRepoName} onChange={e => setNewRepoName(e.target.value)} placeholder="Repository name" className="w-full bg-card/20 border border-border/15 rounded px-2 py-1 text-[10px] font-light text-foreground outline-none placeholder:text-muted-foreground/30" />
                    <input value={newRepoDesc} onChange={e => setNewRepoDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-card/20 border border-border/15 rounded px-2 py-1 text-[10px] font-light text-foreground outline-none placeholder:text-muted-foreground/30" />
                    <label className="flex items-center gap-1.5 text-[9px] text-muted-foreground/50 cursor-pointer">
                      <input type="checkbox" checked={newRepoPrivate} onChange={e => setNewRepoPrivate(e.target.checked)} className="rounded" /> Private
                    </label>
                    <button onClick={handleCreateRepo} disabled={!newRepoName.trim() || loadingAction === "create-repo"} className="w-full flex items-center justify-center gap-1 rounded bg-foreground/10 text-foreground text-[10px] font-light py-1 hover:bg-foreground/15 transition-colors disabled:opacity-30">
                      {loadingAction === "create-repo" ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Plus className="h-2.5 w-2.5" />} Create
                    </button>
                  </div>
                )}

                {repos.map(r => (
                  <div key={r.full_name} className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-light transition-colors ${r.full_name === `${connection?.repo_owner}/${connection?.repo_name}` ? "border-foreground/20 bg-foreground/5" : "border-border/10 hover:border-border/20"}`}>
                    <FolderGit className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-foreground truncate block">{r.full_name}</span>
                      {r.description && <p className="text-[8px] text-muted-foreground/40 truncate">{r.description}</p>}
                    </div>
                    {r.private && <span className="text-[7px] text-muted-foreground/40 bg-card/30 rounded px-1">private</span>}
                  </div>
                ))}
                {repos.length === 0 && !loadingAction && <p className="text-[9px] text-muted-foreground/30 text-center py-4">No repos loaded</p>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default IdeGitPanel;
