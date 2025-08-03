import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("🔍 [nylas-sso-init] Function invoked:", req.method, req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const state = url.searchParams.get("state") || crypto.randomUUID();
    
    const nylasClientId = Deno.env.get("NYLAS_CLIENT_ID");
    const redirectUri = "https://ipjrhuijvgchbezcjhsk.supabase.co/functions/v1/nylas-oauth-redirect";
    
    if (!nylasClientId) {
      console.error("🔴 [nylas-sso-init] NYLAS_CLIENT_ID not configured");
      return new Response("Server configuration error", { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Build Nylas OAuth URL
    const authParams = new URLSearchParams({
      client_id: nylasClientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: "email.read calendar.read calendar.edit",
      state: state,
      access_type: "offline"
    });

    const authUrl = `https://api.us.nylas.com/v3/connect/auth?${authParams.toString()}`;
    
    console.log("✅ [nylas-sso-init] Redirecting to Nylas OAuth:", authUrl);
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': authUrl
      }
    });

  } catch (error) {
    console.error("🔴 [nylas-sso-init] Error:", error);
    return new Response(`Server error: ${error.message}`, { 
      status: 500,
      headers: corsHeaders 
    });
  }
});