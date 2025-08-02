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
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { grant_id, calendar_id, title, date, start_time, end_time } = body;
    
    console.log("🚀 [create-event] Creating event with data:", {
      grant_id,
      calendar_id,
      title,
      date,
      start_time,
      end_time
    });
    
    // Valideer alle verplichte velden
    if (!grant_id || !calendar_id || !title || !date || !start_time || !end_time) {
      console.error("❌ [create-event] Missing required fields:", { 
        grant_id: !!grant_id, 
        calendar_id: !!calendar_id, 
        title: !!title, 
        date: !!date, 
        start_time: !!start_time, 
        end_time: !!end_time 
      });
      return new Response("Missing required fields: grant_id, calendar_id, title, date, start_time, end_time", { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const nylasApiKey = Deno.env.get("NYLAS_CLIENT_SECRET");
    if (!nylasApiKey) {
      console.error("❌ [create-event] Nylas API key not configured");
      return new Response("Nylas API key not configured", { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // First check if the grant is still valid by testing the calendars endpoint
    console.log("🔍 [create-event] Validating grant:", grant_id);
    const testResponse = await fetch(
      `https://api.us.nylas.com/v3/grants/${grant_id}/calendars`,
      {
        headers: {
          'Authorization': `Bearer ${nylasApiKey}`,
          'Accept': 'application/json'
        }
      }
    );

    console.log("🔍 [create-event] Grant validation response:", testResponse.status);
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error("❌ [create-event] Grant validation failed:", errorText);
      
      // Mark the Nylas account as inactive if grant is invalid
      await supabase
        .from('nylas_accounts')
        .update({ is_active: false })
        .eq('nylas_grant_id', grant_id);
        
      return new Response("Calendar connection is no longer valid. Please reconnect your calendar.", { 
        status: 401,
        headers: corsHeaders
      });
    }

    // Bereken UNIX timestamps
    const startTs = Math.floor(new Date(`${date}T${start_time}:00`).getTime() / 1000);
    const endTs = Math.floor(new Date(`${date}T${end_time}:00`).getTime() / 1000);
    
    console.log("🕐 [create-event] Converted timestamps:", { startTs, endTs });

    // Verplicht `when`-object volgens Nylas v3 API
    const payload = {
      calendar_id,
      title,
      when: {
        start_time: startTs,
        end_time: endTs
      }
    };

    console.log("📦 [create-event] Payload for Nylas API:", JSON.stringify(payload, null, 2));

    console.log("🚀 [create-event] Making Nylas API call...");
    const url = `https://api.us.nylas.com/v3/grants/${grant_id}/events?calendar_id=${calendar_id}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${nylasApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    console.log("🚀 [create-event] Nylas API response status:", response.status);

    const responseData = await response.json();
    console.log("🚀 [create-event] Nylas API response body:", JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      console.error("❌ [create-event] Nylas API error:", responseData);
      
      // If this is also a 404, mark account as inactive
      if (response.status === 404) {
        await supabase
          .from('nylas_accounts')
          .update({ is_active: false })
          .eq('nylas_grant_id', grant_id);
      }
      
      return new Response(JSON.stringify({ 
        error: "create_failed", 
        details: responseData 
      }), { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("✅ [create-event] Event created successfully:", responseData);
    
    return new Response(JSON.stringify({ 
      event: responseData.data || responseData 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("❌ [create-event] Unexpected error:", error);
    return new Response(JSON.stringify({ 
      error: "internal_error", 
      message: error.message 
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});