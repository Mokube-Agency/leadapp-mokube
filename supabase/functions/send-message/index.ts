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
    const SUPABASE_URL = "https://ipjrhuijvgchbezcjhsk.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwanJodWlqdmdjaGJlemNqaHNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMjg2ODIsImV4cCI6MjA2ODYwNDY4Mn0.6ixbyuGbnB0mGp2HEWEwPcQt8G_6yWsP-muuJ9Hk_rc";
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
      return new Response('Twilio not configured', { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') ?? ''
        }
      }
    });

    // Get the user from the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const { contactId, message } = await req.json();

    if (!contactId || !message) {
      return new Response('Missing contactId or message', { status: 400, headers: corsHeaders });
    }

    // Get user's organization from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return new Response('Profile not found', { status: 404, headers: corsHeaders });
    }

    // Get contact details
    const { data: contact } = await supabase
      .from('contacts')
      .select('whatsapp_number, organization_id')
      .eq('id', contactId)
      .eq('organization_id', profile.organization_id)
      .single();

    if (!contact) {
      return new Response('Contact not found', { status: 404, headers: corsHeaders });
    }

    // Store human message
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        organization_id: contact.organization_id,
        contact_id: contactId,
        role: 'human',
        body: message
      });

    if (messageError) {
      console.error('Error storing message:', messageError);
      return new Response('Database error', { status: 500, headers: corsHeaders });
    }

    // Send via Twilio
    const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams({
      From: TWILIO_WHATSAPP_NUMBER,
      To: contact.whatsapp_number,
      Body: message,
    });

    const twilioResponse = await fetch(twilioEndpoint, {
      method: "POST",
      body: params,
      headers: {
        Authorization: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
    });

    if (!twilioResponse.ok) {
      console.error('Twilio API error:', await twilioResponse.text());
      return new Response('Messaging service error', { status: 500, headers: corsHeaders });
    }

    const twilioData = await twilioResponse.json();

    // Update message with Twilio SID
    await supabase
      .from('messages')
      .update({ twilio_sid: twilioData.sid })
      .eq('contact_id', contactId)
      .eq('role', 'human')
      .eq('body', message);

    // Update contact's last message time
    await supabase
      .from('contacts')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', contactId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Send message error:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
});