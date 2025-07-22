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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

    if (!SUPABASE_SERVICE_KEY || !OPENAI_API_KEY || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error('Missing required environment variables');
      return new Response('Server configuration error', { status: 500, headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const form = await req.formData();
    const from = form.get("From")?.toString(); // e.g. whatsapp:+316...
    const body = form.get("Body")?.toString() || "";
    const twilioSid = form.get("MessageSid")?.toString();

    console.log('=== TWILIO WEBHOOK CALLED ===');
    console.log('Received webhook:', { from, body, twilioSid });

    if (!from) {
      return new Response('Missing From parameter', { status: 400, headers: corsHeaders });
    }

    // 1) Look-up or create contact
    let { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("id, organization_id, full_name")
      .eq("whatsapp_number", from)
      .maybeSingle();

    if (contactError) {
      console.error('Error fetching contact:', contactError);
      return new Response('Database error', { status: 500, headers: corsHeaders });
    }

    // If contact doesn't exist, we need an organization to create it
    // For demo purposes, we'll use the first organization or create a default one
    if (!contact) {
      let { data: org } = await supabase
        .from("organizations")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (!org) {
        // Create a default organization for demo
        const { data: newOrg } = await supabase
          .from("organizations")
          .insert({ name: "Demo Organization" })
          .select("id")
          .single();
        org = newOrg;
      }

      // Create new contact
      const { data: newContact } = await supabase
        .from("contacts")
        .insert({
          organization_id: org.id,
          whatsapp_number: from,
          full_name: from.replace('whatsapp:', ''),
          last_message_at: new Date().toISOString()
        })
        .select("id, organization_id, full_name")
        .single();

      contact = newContact;
    } else {
      // Update last message time
      await supabase
        .from("contacts")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", contact.id);
    }

    // 2) Store incoming message
    const { error: messageError } = await supabase
      .from("messages")
      .insert({
        organization_id: contact.organization_id,
        contact_id: contact.id,
        role: "user",
        body,
        twilio_sid: twilioSid
      });

    if (messageError) {
      console.error('Error storing message:', messageError);
      return new Response('Database error', { status: 500, headers: corsHeaders });
    }

    // 3) Check if AI is paused for this organization
    const { data: org } = await supabase
      .from("organizations")
      .select("ai_paused")
      .eq("id", contact.organization_id)
      .single();

    if (org?.ai_paused) {
      console.log('AI is paused for organization');
      return new Response("AI paused", { headers: corsHeaders });
    }

    // 4) Generate AI response
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `Je bent een vriendelijke klantenservice agent voor een onderhoud- en renovatiebedrijf. Beantwoord vragen over onze diensten, geef advies over onderhoud en help klanten met het inplannen van afspraken. Antwoord in het Nederlands en houd het kort en professioneel.`
          },
          { role: 'user', content: body }
        ],
        max_tokens: 500,
        temperature: 0.7
      }),
    });

    if (!openAIResponse.ok) {
      console.error('OpenAI API error:', await openAIResponse.text());
      return new Response('AI service error', { status: 500, headers: corsHeaders });
    }

    const aiData = await openAIResponse.json();
    const reply = aiData.choices[0]?.message?.content || "Sorry, ik kon geen antwoord genereren.";

    // 5) Store AI response
    const { error: aiMessageError } = await supabase
      .from("messages")
      .insert({
        organization_id: contact.organization_id,
        contact_id: contact.id,
        role: "agent",
        body: reply
      });

    if (aiMessageError) {
      console.error('Error storing AI message:', aiMessageError);
    }

    // 6) Send response via Twilio
    const twilioEndpoint = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams({
      From: TWILIO_WHATSAPP_NUMBER || '',
      To: from,
      Body: reply,
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

    console.log('Successfully processed webhook and sent reply');
    return new Response("OK", { headers: corsHeaders });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
});