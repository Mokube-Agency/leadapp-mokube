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

  if (req.method !== 'POST') {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { grant_id, calendar_id, title, date, start_time, end_time, ...eventData } = body;
    
    console.log("Creating event with grant_id:", grant_id, "calendar_id:", calendar_id);
    
    if (!grant_id || !calendar_id) {
      return new Response("grant_id and calendar_id are required", { status: 400 });
    }

    const nylasApiKey = Deno.env.get("NYLAS_CLIENT_SECRET");
    if (!nylasApiKey) {
      return new Response("Nylas API key not configured", { status: 500 });
    }

    // First check if the grant is still valid by testing the calendars endpoint
    const testResponse = await fetch(
      `https://api.us.nylas.com/v3/grants/${grant_id}/calendars`,
      {
        headers: {
          'Authorization': `Bearer ${nylasApiKey}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!testResponse.ok) {
      console.error("Grant validation failed:", await testResponse.text());
      
      // Mark the Nylas account as inactive if grant is invalid
      await supabase
        .from('nylas_accounts')
        .update({ is_active: false })
        .eq('nylas_grant_id', grant_id);
        
      return new Response("Calendar connection is no longer valid. Please reconnect your calendar.", { status: 401 });
    }

    // Convert date and time to timestamps
    const startTs = Math.floor(new Date(`${date}T${start_time}`).getTime() / 1000);
    const endTs = Math.floor(new Date(`${date}T${end_time}`).getTime() / 1000);

    const response = await fetch(
      `https://api.us.nylas.com/v3/grants/${grant_id}/events?calendar_id=${calendar_id}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nylasApiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          title,
          when: { start_time: startTs, end_time: endTs }
        })
      }
    );
    
    console.log("Nylas create-event response", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Nylas API error:", errorText);
      
      // If this is also a 404, mark account as inactive
      if (response.status === 404) {
        await supabase
          .from('nylas_accounts')
          .update({ is_active: false })
          .eq('nylas_grant_id', grant_id);
      }
      
      return new Response(`Nylas API error: ${errorText}`, { status: response.status });
    }

    const data = await response.json();
    console.log("Event created successfully:", data);
    
    return new Response(JSON.stringify(data.data || data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Create event error:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});