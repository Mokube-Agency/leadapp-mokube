import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.error("🔴 [list-emails] START", { url: req.url, method: req.method, time: new Date().toISOString() });
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.error("🔴 [list-emails] CORS preflight request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user_id from query parameters or request body
    let user_id;
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      user_id = url.searchParams.get("user_id");
      console.error("🔴 [list-emails] GET request, user_id from query:", user_id);
    } else if (req.method === 'POST') {
      const body = await req.json();
      user_id = body.user_id;
      console.error("🔴 [list-emails] POST request, user_id from body:", user_id);
    }
    
    if (!user_id) {
      console.error("🔴 [list-emails] Missing user_id");
      return new Response("user_id is required", { 
        status: 400,
        headers: corsHeaders 
      });
    }

    // Get grant_id from profiles table
    console.error("🔴 [list-emails] Creating Supabase client...");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    console.error("🔴 [list-emails] Fetching profile for user_id:", user_id);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("nylas_grant_id")
      .eq("user_id", user_id)
      .single();
      
    console.error("🔴 [list-emails] Profile query result:", { profile, profileError });
      
    if (profileError || !profile?.nylas_grant_id) {
      console.error("🔴 [list-emails] No grant_id for user", user_id, profileError);
      return new Response("Geen kalender- of email-grant gekoppeld", { 
        status: 400,
        headers: corsHeaders 
      });
    }
    
    const grantId = profile.nylas_grant_id;
    console.error("🔴 [list-emails] Using grant_id:", grantId);

    // Fetch messages via Nylas v3 API
    const nylasApiKey = Deno.env.get("NYLAS_CLIENT_SECRET");
    console.error("🔴 [list-emails] Nylas API key exists:", !!nylasApiKey);
    
    if (!nylasApiKey) {
      console.error("🔴 [list-emails] Nylas API key not configured");
      return new Response("Nylas API key not configured", { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const nylasUrl = `https://api.us.nylas.com/v3/grants/${grantId}/messages?limit=50`;
    console.error("🔴 [list-emails] Calling Nylas API:", nylasUrl);

    const response = await fetch(nylasUrl, {
      headers: {
        'Authorization': `Bearer ${nylasApiKey}`,
        'Accept': 'application/json'
      }
    });

    const json = await response.json();
    console.error("📨 [list-emails] Nylas response:", { 
      status: response.status, 
      ok: response.ok,
      dataLength: json.data?.length || 0,
      error: json.error || null
    });

    if (!response.ok) {
      console.error("🔴 [list-emails] Nylas API error:", response.status, json);
      return new Response(JSON.stringify({ error: json }), { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.error("✅ [list-emails] SUCCESS - returning", json.data?.length || 0, "emails");
    return new Response(JSON.stringify(json.data || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("🔴 [list-emails] UNCAUGHT ERROR", error);
    return new Response(`Error: ${error.message}`, { 
      status: 500,
      headers: corsHeaders
    });
  }
});