import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

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
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `GitHub API error ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { action, ...params } = await req.json();

    // Helper to get token from connection
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
        return new Response(JSON.stringify({ valid: true, user: { login: userData.login, avatar_url: userData.avatar_url, name: userData.name } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "list_repos": {
        const conn = await getToken(params.connection_id);
        const repos = await githubFetch("/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator", conn.github_token);
        return new Response(JSON.stringify({ repos: repos.map((r: any) => ({ full_name: r.full_name, name: r.name, owner: r.owner.login, default_branch: r.default_branch, private: r.private, description: r.description, updated_at: r.updated_at })) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "get_contents": {
        const conn = await getToken(params.connection_id);
        const path = params.path || "";
        const branch = params.branch || conn.branch || "main";
        const contents = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${path}?ref=${branch}`, conn.github_token);
        return new Response(JSON.stringify({ contents }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "get_file": {
        const conn = await getToken(params.connection_id);
        const branch = params.branch || conn.branch || "main";
        const file = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${params.path}?ref=${branch}`, conn.github_token);
        const content = file.content ? atob(file.content) : "";
        return new Response(JSON.stringify({ content, sha: file.sha, name: file.name, path: file.path, size: file.size }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "push_file": {
        const conn = await getToken(params.connection_id);
        const branch = params.branch || conn.branch || "main";
        // Check if file exists to get sha
        let sha: string | undefined;
        try {
          const existing = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${params.path}?ref=${branch}`, conn.github_token);
          sha = existing.sha;
        } catch { /* new file */ }

        const body: any = {
          message: params.message || `Update ${params.path}`,
          content: btoa(params.content),
          branch,
        };
        if (sha) body.sha = sha;

        const result = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${params.path}`, conn.github_token, { method: "PUT", body: JSON.stringify(body) });
        
        // Update last_sync_at
        await supabase.from("github_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", conn.id);
        
        return new Response(JSON.stringify({ success: true, sha: result.content?.sha }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "push_files": {
        const conn = await getToken(params.connection_id);
        const branch = params.branch || conn.branch || "main";
        const files: { path: string; content: string }[] = params.files;
        const results = [];

        for (const file of files) {
          let sha: string | undefined;
          try {
            const existing = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${file.path}?ref=${branch}`, conn.github_token);
            sha = existing.sha;
          } catch { /* new file */ }

          const body: any = { message: params.message || `Update ${file.path}`, content: btoa(file.content), branch };
          if (sha) body.sha = sha;

          const result = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${file.path}`, conn.github_token, { method: "PUT", body: JSON.stringify(body) });
          results.push({ path: file.path, sha: result.content?.sha });
        }

        await supabase.from("github_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", conn.id);

        return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "list_branches": {
        const conn = await getToken(params.connection_id);
        const branches = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/branches?per_page=50`, conn.github_token);
        return new Response(JSON.stringify({ branches: branches.map((b: any) => ({ name: b.name, protected: b.protected })) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "get_commits": {
        const conn = await getToken(params.connection_id);
        const branch = params.branch || conn.branch || "main";
        const commits = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/commits?sha=${branch}&per_page=20`, conn.github_token);
        return new Response(JSON.stringify({ commits: commits.map((c: any) => ({ sha: c.sha, message: c.commit.message, author: c.commit.author.name, date: c.commit.author.date })) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "create_repo": {
        const conn = await getToken(params.connection_id);
        const repo = await githubFetch("/user/repos", conn.github_token, {
          method: "POST",
          body: JSON.stringify({ name: params.name, description: params.description || "", private: params.is_private ?? true, auto_init: true }),
        });

        // Update connection with new repo
        await supabase.from("github_connections").update({ repo_owner: repo.owner.login, repo_name: repo.name, branch: repo.default_branch }).eq("id", conn.id);

        return new Response(JSON.stringify({ repo: { full_name: repo.full_name, name: repo.name, owner: repo.owner.login, default_branch: repo.default_branch } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "delete_file": {
        const conn = await getToken(params.connection_id);
        const branch = params.branch || conn.branch || "main";
        const existing = await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${params.path}?ref=${branch}`, conn.github_token);
        
        await githubFetch(`/repos/${conn.repo_owner}/${conn.repo_name}/contents/${params.path}`, conn.github_token, {
          method: "DELETE",
          body: JSON.stringify({ message: params.message || `Delete ${params.path}`, sha: existing.sha, branch }),
        });

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err: any) {
    console.error("github-api error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
