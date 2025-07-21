import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !SUPABASE_URL) {
      console.error('Missing required environment variables');
      return new Response(JSON.stringify({ error: 'Missing configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const TWILIO_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/twilio-webhook`;

    console.log('Configuring Twilio Sandbox with webhook:', TWILIO_WEBHOOK_URL);

    // Configure Twilio Sandbox
    const url = `https://preview.twilio.com/WhatsApp/Sandboxes/${TWILIO_ACCOUNT_SID}`;
    const params = new URLSearchParams({
      InboundMessageUrl: TWILIO_WEBHOOK_URL,
      StatusCallback: TWILIO_WEBHOOK_URL,
    });

    const response = await fetch(url, {
      method: "POST",
      body: params,
      headers: {
        Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sandbox configuration failed:', errorText);
      return new Response(JSON.stringify({ 
        error: 'Failed to configure sandbox', 
        details: errorText 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.text();
    console.log('Sandbox configured successfully:', result);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Sandbox geconfigureerd ✓',
      webhookUrl: TWILIO_WEBHOOK_URL
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error configuring sandbox:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});