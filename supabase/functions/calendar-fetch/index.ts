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
    // Parse request body for user_id
    const { user_id } = await req.json();
    
    console.log('📅 [calendar-fetch] Received request for user:', user_id);
    
    if (!user_id) {
      console.error('📅 [calendar-fetch] No user_id provided');
      return new Response("user_id is required", { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response("Supabase configuration missing", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('📅 [calendar-fetch] Looking up Google tokens for user:', user_id);
    
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("google_refresh_token")
      .eq("user_id", user_id)
      .single();
    
    console.log('📅 [calendar-fetch] Profile lookup result:', { hasToken: !!profile?.google_refresh_token, error: profileError });
    
    if (profileError) {
      console.error('📅 [calendar-fetch] Database error:', profileError);
      return new Response(`Database error: ${profileError.message}`, { 
        status: 500,
        headers: corsHeaders 
      });
    }
    
    if (!profile?.google_refresh_token) {
      console.log('📅 [calendar-fetch] No Google refresh token found for user');
      return new Response("No Google tokens found for this user", { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    
    if (!googleClientId || !googleClientSecret) {
      return new Response("Google OAuth credentials not configured", { 
        status: 500,
        headers: corsHeaders 
      });
    }

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

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token refresh failed:", errorText);
      return new Response("Failed to refresh Google token", { status: 401 });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Fetch Google Calendar events
    const now = new Date();
    const timeMin = now.toISOString();
    const timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ahead

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

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text();
      console.error("Calendar API error:", errorText);
      return new Response("Failed to fetch calendar events", { status: calendarResponse.status });
    }

    const calendarData = await calendarResponse.json();
    
    return new Response(JSON.stringify(calendarData.items || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Calendar fetch error:", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});