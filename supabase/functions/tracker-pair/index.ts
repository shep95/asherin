import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Just redirect to the Aureon home page immediately
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      "Location": "https://aureonai.app/",
    },
  });
});
