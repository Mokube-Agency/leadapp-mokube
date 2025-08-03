import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

serve(async (req) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const state = url.searchParams.get("state") || "";
    
    const nylasClientId = Deno.env.get("NYLAS_CLIENT_ID");
    if (!nylasClientId) {
      return new Response("Nylas Client ID not configured", { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Use the current site URL as redirect base
    const redirectUri = `${url.origin}/functions/v1/nylas-oauth-redirect`;
    
    const params = new URLSearchParams({
      client_id: nylasClientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: "email calendar messages",
      state: state
    });

    const authUrl = `https://api.us.nylas.com/v3/connect/auth?${params}`;
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": authUrl
      }
    });

  } catch (error) {
    console.error("Nylas OAuth init error:", error);
    return new Response(`Error: ${error.message}`, { 
      status: 500,
      headers: corsHeaders 
    });
  }
});