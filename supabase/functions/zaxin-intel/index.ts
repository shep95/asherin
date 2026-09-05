// asherin.zaxin is retired — the room is off sale and off access, and this
// feed proxy goes with it. 410, not 404: the surface existed and is gone.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(() =>
  new Response(JSON.stringify({ error: "asherin.zaxin is retired and no longer served." }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  }),
);
