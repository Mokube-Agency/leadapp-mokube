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
    let grantId: string;
    let calendarId: string;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      grantId = url.searchParams.get("grant_id") || '';
      calendarId = url.searchParams.get("calendar_id") || '';
    } else if (req.method === 'POST') {
      const body = await req.json();
      grantId = body.grant_id || '';
      calendarId = body.calendar_id || '';
    } else {
      return new Response("Method not allowed", { status: 405 });
    }
    
    if (!grantId || !calendarId) {
      return new Response("grant_id and calendar_id parameters are required", { status: 400 });
    }

    const nylasApiKey = Deno.env.get("NYLAS_CLIENT_SECRET");
    if (!nylasApiKey) {
      return new Response("Nylas API key not configured", { status: 500 });
    }

    const response = await fetch(
      `https://api.us.nylas.com/v3/grants/${grantId}/events?calendar_id=${calendarId}`,
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
    console.error("Get events error:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});