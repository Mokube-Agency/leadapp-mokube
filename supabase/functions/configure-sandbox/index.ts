import { serve } from "https://deno.land/x/sift/mod.ts";
import { encode } from "https://deno.land/std@0.207.0/encoding/base64.ts";

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
    const {
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      SUPABASE_URL,
    } = Deno.env.toObject();

    if (!TWILIO_ACCOUNT_SID?.startsWith("AC")) {
      return new Response(JSON.stringify({ 
        error: "TWILIO_ACCOUNT_SID moet met AC beginnen" 
      }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!TWILIO_AUTH_TOKEN || !SUPABASE_URL) {
      return new Response(JSON.stringify({ 
        error: 'Missing required environment variables' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const TWILIO_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/twilio-webhook`;

    console.log('Configuring Twilio Sandbox with webhook:', TWILIO_WEBHOOK_URL);

    const url = `https://preview.twilio.com/WhatsApp/Sandboxes/${TWILIO_ACCOUNT_SID}`;
    const params = new URLSearchParams({
      InboundMessageUrl: TWILIO_WEBHOOK_URL,
      StatusCallback: TWILIO_WEBHOOK_URL,
    });

    const response = await fetch(url, {
      method: "POST",
      body: params,
      headers: {
        Authorization: "Basic " + encode(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
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
        status: response.status,
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
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});