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
    const url = new URL(req.url);
    const user_id = url.searchParams.get("user_id");
    
    if (!user_id) {
      return new Response("user_id parameter is required", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response("Supabase configuration missing", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("google_refresh_token")
      .eq("user_id", user_id)
      .single();
    
    if (!profile?.google_refresh_token) {
      return new Response("No Google tokens found", { status: 400 });
    }

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    
    if (!googleClientId || !googleClientSecret) {
      return new Response("Google OAuth credentials not configured", { status: 500 });
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