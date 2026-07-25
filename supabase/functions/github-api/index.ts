import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";

const GITHUB_API = "https://api.github.com";

async function githubFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.message || `GitHub API error ${res.status}`);
  return data;
}

// Encode UTF-8 string to base64 (handles unicode safely)
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { action, ...params } = await req.json();

    async function getToken(connectionId?: string) {
      let query = supabase.from("github_connections").select("*").eq("user_id", user!.id);
      if (connectionId) query = query.eq("id", connectionId);
      const { data } = await query.order("created_at", { ascending: false }).limit(1).single();
      if (!data) throw new Error("No GitHub connection found");
      return data;
    }

    switch (action) {
      case "validate_token": {
        const { token } = params;
        const userData = await githubFetch("/user", token);
        return json({ valid: true, user: { login: userData.login, avatar_url: userData.avatar_url, name: userData.name } });
      }

      case "list_repos": {
        const conn = await getToken(params.connection_id);
        const repos = await githubFetch("/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator", conn.github_token);
        return json({ repos: repos.map((r: any) => ({ full_name: r.full_name, name: r.name, owner: r.owner.login, default_branch: r.default_branch, private: r.private, description: r.description, updated_at: r.updated_at })) });
      }

      case "get_contents": {
        const conn = await getToken(params.connection_id);
        const path = params.path || "";
        const branch = params.branch || conn.branch || "main";
        const contents = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${path}?ref=${branch}`, conn.github_token);
        return json({ contents });
      }

      case "get_file": {
        const conn = await getToken(params.connection_id);
        const branch = params.branch || conn.branch || "main";
        const file = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${encodeURIComponent(params.path)}?ref=${branch}`, conn.github_token);
        const content = file.content ? base64ToUtf8(file.content) : "";
        return json({ content, sha: file.sha, name: file.name, path: file.path, size: file.size });
      }

      // NEW: recursive tree walk — single API call returns full repo structure
      case "get_tree_recursive": {
        const conn = await getToken(params.connection_id);
        const branch = params.branch || conn.branch || "main";
        // Resolve branch HEAD commit -> tree sha
        const ref = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/branches/${encodeURIComponent(branch)}`, conn.github_token);
        const treeSha = ref.commit?.commit?.tree?.sha;
        if (!treeSha) throw new Error("Could not resolve tree sha");
        const tree = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/git/trees/${treeSha}?recursive=1`, conn.github_token);
        return json({ tree: tree.tree, truncated: tree.truncated, branch });
      }

      // NEW: batch fetch blobs by path (for full import)
      case "get_blobs": {
        const conn = await getToken(params.connection_id);
        const branch = params.branch || conn.branch || "main";
        const paths: string[] = params.paths || [];
        const out: { path: string; content: string; sha: string }[] = [];
        const errors: { path: string; error: string }[] = [];
        // Sequential to respect rate limits; cap at 200
        for (const p of paths.slice(0, 200)) {
          try {
            const file = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${encodeURIComponent(p)}?ref=${branch}`, conn.github_token);
            if (file.encoding === "base64" && typeof file.content === "string") {
              try {
                const content = base64ToUtf8(file.content);
                out.push({ path: p, content, sha: file.sha });
              } catch {
                errors.push({ path: p, error: "binary or non-utf8" });
              }
            } else {
              errors.push({ path: p, error: "unsupported encoding" });
            }
          } catch (e: any) {
            errors.push({ path: p, error: e.message });
          }
        }
        return json({ files: out, errors });
      }

      // NEW: return current shas for given paths so client can detect modifications
      case "get_path_shas": {
        const conn = await getToken(params.connection_id);
        const branch = params.branch || conn.branch || "main";
        const ref = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/branches/${encodeURIComponent(branch)}`, conn.github_token);
        const treeSha = ref.commit?.commit?.tree?.sha;
        if (!treeSha) return json({ shas: {} });
        const tree = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/git/trees/${treeSha}?recursive=1`, conn.github_token);
        const shas: Record<string, string> = {};
        for (const node of tree.tree || []) {
          if (node.type === "blob") shas[node.path] = node.sha;
        }
        return json({ shas });
      }

      case "push_file": {
        const conn = await getToken(params.connection_id);
        const branch = params.branch || conn.branch || "main";
        let sha: string | undefined;
        try {
          const existing = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${encodeURIComponent(params.path)}?ref=${branch}`, conn.github_token);
          sha = existing.sha;
        } catch { /* new file */ }

        const body: any = {
          message: params.message || `Update ${params.path}`,
          content: utf8ToBase64(params.content),
          branch,
        };
        if (sha) body.sha = sha;

        const result = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${encodeURIComponent(params.path)}`, conn.github_token, { method: "PUT", body: JSON.stringify(body) });
        await supabase.from("github_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", conn.id);
        return json({ success: true, sha: result.content?.sha });
      }

      case "push_files": {
        const conn = await getToken(params.connection_id);
        const branch = params.branch || conn.branch || "main";
        const files: { path: string; content: string }[] = params.files;
        const message: string = params.message || `Commit ${files.length} file(s) from Asherin IDE`;

        // Atomic commit via git data API: one tree, one commit, one ref update
        const refData = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/git/ref/heads/${encodeURIComponent(branch)}`, conn.github_token);
        const parentSha = refData.object.sha;
        const parentCommit = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/git/commits/${parentSha}`, conn.github_token);
        const baseTreeSha = parentCommit.tree.sha;

        // Create blobs
        const treeEntries: any[] = [];
        for (const f of files) {
          const blob = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/git/blobs`, conn.github_token, {
            method: "POST",
            body: JSON.stringify({ content: utf8ToBase64(f.content), encoding: "base64" }),
          });
          treeEntries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
        }

        const newTree = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/git/trees`, conn.github_token, {
          method: "POST",
          body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }),
        });

        const newCommit = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/git/commits`, conn.github_token, {
          method: "POST",
          body: JSON.stringify({ message, tree: newTree.sha, parents: [parentSha] }),
        });

        await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/git/refs/heads/${encodeURIComponent(branch)}`, conn.github_token, {
          method: "PATCH",
          body: JSON.stringify({ sha: newCommit.sha, force: false }),
        });

        await supabase.from("github_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", conn.id);
        return json({ success: true, commit_sha: newCommit.sha, file_count: files.length });
      }

      case "list_branches": {
        const conn = await getToken(params.connection_id);
        const branches = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/branches?per_page=100`, conn.github_token);
        return json({ branches: branches.map((b: any) => ({ name: b.name, protected: b.protected, sha: b.commit?.sha })) });
      }

      // NEW
      case "create_branch": {
        const conn = await getToken(params.connection_id);
        const fromBranch: string = params.from || conn.branch || "main";
        const newName: string = params.name;
        if (!newName) throw new Error("Branch name required");
        const refData = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/git/ref/heads/${encodeURIComponent(fromBranch)}`, conn.github_token);
        const created = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/git/refs`, conn.github_token, {
          method: "POST",
          body: JSON.stringify({ ref: `refs/heads/${newName}`, sha: refData.object.sha }),
        });
        return json({ success: true, ref: created.ref });
      }

      // NEW
      case "delete_branch": {
        const conn = await getToken(params.connection_id);
        const name: string = params.name;
        if (!name) throw new Error("Branch name required");
        await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/git/refs/heads/${encodeURIComponent(name)}`, conn.github_token, { method: "DELETE" });
        return json({ success: true });
      }

      // NEW: switch active branch on the connection
      case "switch_branch": {
        const conn = await getToken(params.connection_id);
        const name: string = params.name;
        if (!name) throw new Error("Branch name required");
        await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/branches/${encodeURIComponent(name)}`, conn.github_token);
        await supabase.from("github_connections").update({ branch: name }).eq("id", conn.id);
        return json({ success: true, branch: name });
      }

      case "get_commits": {
        const conn = await getToken(params.connection_id);
        const branch = params.branch || conn.branch || "main";
        const commits = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/commits?sha=${encodeURIComponent(branch)}&per_page=30`, conn.github_token);
        return json({ commits: commits.map((c: any) => ({ sha: c.sha, message: c.commit.message, author: c.commit.author.name, date: c.commit.author.date })) });
      }

      // NEW: list pull requests
      case "list_pull_requests": {
        const conn = await getToken(params.connection_id);
        const state = params.state || "open";
        const prs = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/pulls?state=${state}&per_page=30`, conn.github_token);
        return json({ pulls: prs.map((p: any) => ({
          number: p.number, title: p.title, state: p.state, html_url: p.html_url,
          head: p.head.ref, base: p.base.ref, user: p.user?.login, draft: p.draft,
          created_at: p.created_at, updated_at: p.updated_at,
        })) });
      }

      // NEW: open a PR
      case "create_pull_request": {
        const conn = await getToken(params.connection_id);
        const head: string = params.head || conn.branch;
        const base: string = params.base || "main";
        const title: string = params.title || `Asherin IDE: ${head} → ${base}`;
        const body: string = params.body || "Opened from Asherin IDE.";
        const draft: boolean = !!params.draft;
        const pr = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/pulls`, conn.github_token, {
          method: "POST",
          body: JSON.stringify({ title, head, base, body, draft }),
        });
        return json({ success: true, pull: { number: pr.number, html_url: pr.html_url, state: pr.state } });
      }

      case "create_repo": {
        const conn = await getToken(params.connection_id);
        const repo = await githubFetch("/user/repos", conn.github_token, {
          method: "POST",
          body: JSON.stringify({ name: params.name, description: params.description || "", private: params.is_private ?? true, auto_init: true }),
        });
        await supabase.from("github_connections").update({ repo_owner: repo.owner.login, repo_name: repo.name, branch: repo.default_branch }).eq("id", conn.id);
        return json({ repo: { full_name: repo.full_name, name: repo.name, owner: repo.owner.login, default_branch: repo.default_branch } });
      }

      case "delete_file": {
        const conn = await getToken(params.connection_id);
        const branch = params.branch || conn.branch || "main";
        const existing = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${encodeURIComponent(params.path)}?ref=${branch}`, conn.github_token);
        await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${encodeURIComponent(params.path)}`, conn.github_token, {
          method: "DELETE",
          body: JSON.stringify({ message: params.message || `Delete ${params.path}`, sha: existing.sha, branch }),
        });
        return json({ success: true });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err: any) {
    console.error("github-api error:", err);
    return json({ error: err.message }, 400);
  }
});
