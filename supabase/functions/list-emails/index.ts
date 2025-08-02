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

  try {
    // Get user_id from query parameters
    const url = new URL(req.url);
    const user_id = url.searchParams.get("user_id");
    if (!user_id) {
      return new Response("user_id is required", { status: 400 });
    }

    // Get grant_id from profiles table
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("nylas_grant_id")
      .eq("user_id", user_id)
      .single();
      
    if (profileError || !profile?.nylas_grant_id) {
      console.error("Profile error:", profileError);
      return new Response("Geen kalender- of email-grant gekoppeld", { status: 400 });
    }
    
    const grantId = profile.nylas_grant_id;

    // Fetch messages via Nylas v3 API
    const nylasApiKey = Deno.env.get("NYLAS_CLIENT_SECRET");
    if (!nylasApiKey) {
      return new Response("Nylas API key not configured", { status: 500 });
    }

    const response = await fetch(
      `https://api.us.nylas.com/v3/grants/${grantId}/messages?limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${nylasApiKey}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Nylas API error:", response.status, errorText);
      return new Response(`Nylas API error: ${errorText}`, { status: response.status });
    }

    const json = await response.json();
    console.log("Fetched emails from Nylas:", json.data?.length || 0);

    return new Response(JSON.stringify(json.data || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("List emails error:", error);
    return new Response(`Error: ${error.message}`, { 
      status: 500,
      headers: corsHeaders
    });
  }
});