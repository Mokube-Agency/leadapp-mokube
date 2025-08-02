import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("=== TWILIO WEBHOOK CALLED ===");
  console.log("Request method:", req.method);
  
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
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers.entries()));
    console.log('Form data entries:');
    for (const [key, value] of form.entries()) {
      console.log(`  ${key}: ${value}`);
    }
    console.log('Parsed values:', { from, body, twilioSid });

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
      console.log('AI is gepauzeerd – geen reply versturen');
      // Return 204 No Content to silently handle without sending any message
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 4) Get conversation history for context
    const { data: messages } = await supabase
      .from("messages")
      .select("role, body")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: true })
      .limit(10);

    // Build conversation context
    const conversationMessages = [
      { 
        role: 'system', 
        content: `Je bent een vriendelijke klantenservice agent voor een onderhoud- en renovatiebedrijf. 
        
        Je kunt de volgende functies gebruiken:
        - Beantwoord vragen over onze diensten
        - Geef advies over onderhoud
        - Help klanten met het inplannen van afspraken
        
        Als iemand een afspraak wil inplannen, vraag dan naar:
        - De gewenste datum (YYYY-MM-DD formaat)
        - Starttijd (HH:MM formaat)
        - Eindtijd (HH:MM formaat)
        
        Antwoord in het Nederlands en houd het kort en professioneel.
        De contactpersoon heet: ${contact.full_name}`
      }
    ];

    // Add conversation history
    if (messages) {
      messages.forEach(msg => {
        conversationMessages.push({
          role: msg.role === 'agent' ? 'assistant' : 'user',
          content: msg.body || ''
        });
      });
    }

    // Add current message
    conversationMessages.push({ role: 'user', content: body });

    // Define function for appointment scheduling
    const functions = [
      {
        name: "create_appointment",
        description: "Maak een nieuwe kalenderafspraak aan wanneer de klant een afspraak wil inplannen",
        parameters: {
          type: "object",
          properties: {
            date: { 
              type: "string", 
              description: "Datum van de afspraak in YYYY-MM-DD formaat" 
            },
            start_time: { 
              type: "string", 
              description: "Starttijd in HH:MM formaat (24-uurs)" 
            },
            end_time: { 
              type: "string", 
              description: "Eindtijd in HH:MM formaat (24-uurs)" 
            }
          },
          required: ["date", "start_time", "end_time"]
        }
      }
    ];

    // 5) Generate AI response with function calling
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: conversationMessages,
        functions,
        function_call: "auto",
        max_tokens: 500,
        temperature: 0.7
      }),
    });

    if (!openAIResponse.ok) {
      console.error('OpenAI API error:', await openAIResponse.text());
      return new Response('AI service error', { status: 500, headers: corsHeaders });
    }

    const aiData = await openAIResponse.json();
    const message = aiData.choices[0]?.message;

    let reply = "Sorry, ik kon geen antwoord genereren.";

    // Check if AI wants to call a function
    if (message?.function_call) {
      const functionName = message.function_call.name;
      console.log("🚀 AI called function:", functionName);
      console.log("🚀 Function arguments:", message.function_call.arguments);
      
      if (functionName === "create_appointment") {
        try {
          const args = JSON.parse(message.function_call.arguments);
          console.log("📅 Parsed event data:", args);
          
          // Get user's Nylas account and default calendar for appointment creation
          const { data: profileWithNylas } = await supabase
            .from("profiles")
            .select("nylas_grant_id, default_calendar_id")
            .eq("organization_id", contact.organization_id)
            .eq("nylas_connected", true)
            .limit(1)
            .maybeSingle();

          if (!profileWithNylas?.nylas_grant_id || !profileWithNylas?.default_calendar_id) {
            console.error("❌ No Nylas connection or default calendar found for organization:", contact.organization_id);
            reply = "Sorry, er is geen kalender gekoppeld of geen standaard agenda ingesteld. Koppel eerst je agenda om afspraken te kunnen maken.";
          } else {
            console.log("📅 Using default calendar:", profileWithNylas.default_calendar_id);
            
            // Prepare create-event payload with ALL required fields including default calendar
            const createEventPayload = {
              grant_id: profileWithNylas.nylas_grant_id,
              calendar_id: profileWithNylas.default_calendar_id,
              title: `Afspraak: ${contact.full_name}`,
              date: args.date,
              start_time: args.start_time,
              end_time: args.end_time
            };

            console.log("🛠️ [twilio-webhook] create-event payload:", createEventPayload);

            // Validate all required fields are present
            const requiredFields = ['grant_id', 'calendar_id', 'title', 'date', 'start_time', 'end_time'];
            const missingFields = requiredFields.filter(field => !createEventPayload[field]);
            
            if (missingFields.length > 0) {
              console.error("❌ Missing required fields for create-event:", missingFields);
              reply = "Sorry, er ontbreken gegevens om de afspraak in te plannen. Probeer het opnieuw.";
            } else {
              // Create the event with all required fields
              const { data: eventData, error: eventError } = await supabase.functions.invoke('create-event', {
                body: createEventPayload
              });

              if (eventError) {
                console.error("❌ Error creating event:", eventError);
                reply = "Sorry, er ging iets mis bij het inplannen van je afspraak. Probeer het later opnieuw.";
              } else {
                console.log("✅ Event created successfully:", eventData);
                reply = `Perfect! Je afspraak is ingepland voor ${args.date} van ${args.start_time} tot ${args.end_time}. We zien je dan graag!`;
              }
            }
          }
        } catch (error) {
          console.error("❌ Error processing appointment:", error);
          reply = "Sorry, er ging iets mis bij het verwerken van je afspraak.";
        }
      }
    } else {
      // Regular AI response
      console.log("💬 AI provided text response:", message?.content);
      reply = message?.content || "Sorry, ik kon geen antwoord genereren.";
    }

    // 6) Store AI response
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

    // 7) Send response via Twilio
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
    return new Response(null, { status: 204, headers: corsHeaders });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
});