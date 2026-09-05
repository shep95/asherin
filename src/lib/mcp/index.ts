import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listConversations from "./tools/list-conversations";
import listDirectiveProfiles from "./tools/list-directive-profiles";
import createDirectiveProfile from "./tools/create-directive-profile";
import listSavedTargets from "./tools/list-saved-targets";
import createSavedTarget from "./tools/create-saved-target";
import listWatchlist from "./tools/list-watchlist";
import addWatchlistEntity from "./tools/add-watchlist-entity";
import searchCodeSnippets from "./tools/search-code-snippets";

// Issuer must be the direct Supabase host; the project ref is inlined at build time.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "asherin",
  title: "asherin",
  version: "0.1.0",
  instructions:
    "Tools for Asherin. Callers act as the signed-in Asherin user: read chat conversations, read and create directive profiles, read and create saved map targets, read and add watchlist entities, and search saved code snippets. All data is scoped to that user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listConversations,
    listDirectiveProfiles,
    createDirectiveProfile,
    listSavedTargets,
    createSavedTarget,
    listWatchlist,
    addWatchlistEntity,
    searchCodeSnippets,
  ],
});
