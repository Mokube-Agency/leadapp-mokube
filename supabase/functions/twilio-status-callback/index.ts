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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing required environment variables');
      return new Response(JSON.stringify({ error: 'Missing configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse Twilio POST payload
    const form = await req.formData();
    const messageSid = form.get("MessageSid")?.toString();
    const messageStatus = form.get("MessageStatus")?.toString();

    console.log('Received status callback:', { messageSid, messageStatus });

    if (!messageSid || !messageStatus) {
      console.error('Missing MessageSid or MessageStatus');
      return new Response(JSON.stringify({ error: "Missing MessageSid or MessageStatus" }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update status in Supabase
    const { error } = await supabase
      .from("messages")
      .update({ twilio_status: messageStatus })
      .eq("twilio_sid", messageSid);

    if (error) {
      console.error("Status update failed:", error);
      return new Response(JSON.stringify({ error: "DB update error", details: error.message }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Status updated successfully for message:', messageSid);
    return new Response(JSON.stringify({ success: "Status bijgewerkt ✓" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing status callback:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});