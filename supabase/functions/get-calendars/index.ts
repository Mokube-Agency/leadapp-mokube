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

  if (req.method !== 'GET') {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const grantId = url.searchParams.get("grant_id");
    
    if (!grantId) {
      return new Response("grant_id parameter is required", { status: 400 });
    }

    const nylasApiKey = Deno.env.get("NYLAS_CLIENT_SECRET");
    if (!nylasApiKey) {
      return new Response("Nylas API key not configured", { status: 500 });
    }

    const response = await fetch(
      `https://api.us.nylas.com/v3/grants/${grantId}/calendars`,
      {
        headers: {
          'Authorization': `Bearer ${nylasApiKey}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Nylas API error:", errorText);
      return new Response(`Nylas API error: ${errorText}`, { status: response.status });
    }

    const data = await response.json();
    
    return new Response(JSON.stringify(data.data || data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Get calendars error:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});