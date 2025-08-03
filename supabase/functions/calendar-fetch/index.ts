import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("🔍 [calendar-fetch] Function invoked at", new Date().toISOString());
  console.log("🔍 [calendar-fetch] Request method:", req.method);
  console.log("🔍 [calendar-fetch] Request URL:", req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log("🔍 [calendar-fetch] Handling CORS preflight");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body for user_id
    const requestBody = await req.text();
    console.log("🔍 [calendar-fetch] Raw request body:", requestBody);
    
    let user_id;
    try {
      const parsed = JSON.parse(requestBody);
      user_id = parsed.user_id;
      console.log("🔍 [calendar-fetch] Parsed user_id:", user_id);
    } catch (parseError) {
      console.error("🔴 [calendar-fetch] Failed to parse request body:", parseError);
      return new Response("Invalid JSON in request body", { 
        status: 400,
        headers: corsHeaders 
      });
    }
    
    if (!user_id) {
      console.error("🔴 [calendar-fetch] No user_id provided in request");
      return new Response("user_id is required", { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    console.log("🔍 [calendar-fetch] Supabase URL configured:", !!supabaseUrl);
    console.log("🔍 [calendar-fetch] Service key configured:", !!supabaseServiceKey);
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("🔴 [calendar-fetch] Supabase configuration missing");
      return new Response("Supabase configuration missing", { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log("🔍 [calendar-fetch] Looking up Google tokens for user:", user_id);
    
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("google_refresh_token")
      .eq("user_id", user_id)
      .maybeSingle();
    
    console.log("🔍 [calendar-fetch] Profile lookup result:", { 
      hasProfile: !!profile, 
      hasToken: !!profile?.google_refresh_token, 
      error: profileError 
    });
    
    if (profileError) {
      console.error("🔴 [calendar-fetch] Database error:", profileError);
      return new Response(`Database error: ${profileError.message}`, { 
        status: 500,
        headers: corsHeaders 
      });
    }
    
    if (!profile) {
      console.log("🔴 [calendar-fetch] No profile found for user");
      
      // Try to create a profile for this user
      console.log("🔧 [calendar-fetch] Attempting to create profile for user");
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([
          {
            user_id: user_id,
            organization_id: '00000000-0000-0000-0000-000000000000' // Will need proper org assignment
          }
        ])
        .select()
        .single();

      if (createError) {
        console.error("🔴 [calendar-fetch] Failed to create profile:", createError);
        return new Response("No profile found and could not create one. Please complete registration.", { 
          status: 404,
          headers: corsHeaders 
        });
      }

      console.log("✅ [calendar-fetch] Created profile for user");
      return new Response("Profile created but no Google calendar connected. Please connect your Google account first.", { 
        status: 400,
        headers: corsHeaders 
      });
    }
    
    if (!profile.google_refresh_token) {
      console.log("🔴 [calendar-fetch] No Google refresh token found for user");
      return new Response("No Google tokens found for this user. Please reconnect your Google account.", { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    
    console.log("🔍 [calendar-fetch] Google credentials configured:", {
      clientId: !!googleClientId,
      clientSecret: !!googleClientSecret
    });
    
    if (!googleClientId || !googleClientSecret) {
      console.error("🔴 [calendar-fetch] Google OAuth credentials not configured");
      return new Response("Google OAuth credentials not configured", { 
        status: 500,
        headers: corsHeaders 
      });
    }

    console.log("🔍 [calendar-fetch] Refreshing Google access token...");

    // Get access token using refresh token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: profile.google_refresh_token,
        grant_type: "refresh_token",
      }),
    });

    console.log("🔍 [calendar-fetch] Token refresh response status:", tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("🔴 [calendar-fetch] Token refresh failed:", errorText);
      return new Response("Failed to refresh Google token. Please reconnect your Google account.", { 
        status: 401,
        headers: corsHeaders 
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log("🔍 [calendar-fetch] Successfully obtained access token");

    // Fetch Google Calendar events
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ahead

    console.log("🔍 [calendar-fetch] Fetching calendar events:", {
      timeMin,
      timeMax
    });

    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `maxResults=50&` +
      `singleEvents=true&` +
      `orderBy=startTime`,
      {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      }
    );

    console.log("🔍 [calendar-fetch] Calendar API response status:", calendarResponse.status);

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error("🔴 [calendar-fetch] Calendar API error:", errorText);
      return new Response("Failed to fetch calendar events", { 
        status: calendarResponse.status,
        headers: corsHeaders 
      });
    }

    const calendarData = await calendarResponse.json();
    console.log("🔍 [calendar-fetch] Calendar events count:", calendarData.items?.length || 0);
    
    return new Response(JSON.stringify(calendarData.items || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("🔴 [calendar-fetch] Unexpected error:", error);
    return new Response(`Error: ${error.message}`, { 
      status: 500,
      headers: corsHeaders 
    });
  }
});