import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === 'POST') {
    try {
      const { user_id } = await req.json();
      
      if (!user_id) {
        return new Response("Missing user_id", { status: 400 });
      }

      // Generate unique state for this OAuth flow
      const state = crypto.randomUUID();

      // Store state in database
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { error: stateError } = await supabase
        .from("oauth_states")
        .insert({ state, user_id });

      if (stateError) {
        console.error("Failed to store OAuth state:", stateError);
        return new Response("Failed to initialize OAuth", { status: 500 });
      }

      // Build Nylas OAuth URL with proper state
      const redirectUri = `https://ipjrhuijvgchbezcjhsk.supabase.co/functions/v1/nylas-oauth-redirect`;
      
      const authUrl = new URL("https://api.us.nylas.com/v3/connect/auth");
      authUrl.searchParams.set("client_id", Deno.env.get("NYLAS_CLIENT_ID")!);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("access_type", "offline");

      console.log("🔐 Generated OAuth state:", state, "for user:", user_id);

      return new Response(JSON.stringify({ auth_url: authUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error("OAuth init error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});