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

  if (req.method === 'GET') {
    // Handle OAuth callback from Nylas
    const url = new URL(req.url);
    const searchParams = url.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // bevat user_id
    
    if (!code || !state) {
      return new Response("Invalid OAuth callback", { status: 400 });
    }

    try {
      console.log("Received OAuth callback with code:", code, "and state:", state);

      // Ruil code in voor access_token bij Nylas
      const tokenResponse = await fetch("https://api.us.nylas.com/v3/connect/token", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id: Deno.env.get("NYLAS_CLIENT_ID"),
          client_secret: Deno.env.get("NYLAS_CLIENT_SECRET"),
          grant_type: "authorization_code",
          code: code,
          redirect_uri: `https://ipjrhuijvgchbezcjhsk.supabase.co/functions/v1/nylas-oauth-redirect`
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Nylas token exchange failed:", errorText);
        return new Response(`Token exchange failed: ${errorText}`, { status: 400 });
      }

      const tokenData = await tokenResponse.json();
      console.log("Token exchange successful:", tokenData);

      // Haal user profiel op via grant_id
      if (tokenData.grant_id) {
        const profileResponse = await fetch(`https://api.us.nylas.com/v3/grants/${tokenData.grant_id}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${tokenData.access_token}`,
            "Accept": "application/json"
          }
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          tokenData.email_address = profileData.email;
          tokenData.provider = profileData.provider;
        }
      }

      // Sla tokens op in Supabase en creëer/login user
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Get or create user profile from email
      let userId = state; // If state contains user_id, use it
      
      if (tokenData.email_address && !state) {
        // Try to find existing user by email or create new one
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const foundUser = existingUser.users.find(u => u.email === tokenData.email_address);
        
        if (foundUser) {
          userId = foundUser.id;
        } else {
          // Create new user in Supabase Auth
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: tokenData.email_address,
            email_confirm: true
          });
          
          if (createError || !newUser.user) {
            console.error("Failed to create user:", createError);
            return new Response("Failed to create user account", { status: 500 });
          }
          
          userId = newUser.user.id;
        }
      }

      if (!userId) {
        return new Response("Unable to determine user identity", { status: 400 });
      }

      // Get or create organization for this user
      let { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, id")
        .eq("user_id", userId)
        .single();

      let organizationId = profile?.organization_id;

      if (!profile) {
        // Create organization first
        const { data: newOrg, error: orgError } = await supabase
          .from("organizations")
          .insert({ name: `${tokenData.email_address || 'User'}'s Organization` })
          .select()
          .single();

        if (orgError || !newOrg) {
          console.error("Failed to create organization:", orgError);
          return new Response("Failed to create organization", { status: 500 });
        }

        organizationId = newOrg.id;

        // Create profile
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: userId,
            organization_id: organizationId,
            display_name: tokenData.email_address?.split('@')[0],
            nylas_connected: true,
            nylas_grant_id: tokenData.grant_id
          });

        if (profileError) {
          console.error("Failed to create profile:", profileError);
          return new Response("Failed to create profile", { status: 500 });
        }
      } else {
        // Update existing profile
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ 
            nylas_connected: true,
            nylas_grant_id: tokenData.grant_id
          })
          .eq("user_id", userId);

        if (updateError) {
          console.error("Failed to update profile:", updateError);
        }
        
        organizationId = profile.organization_id;
      }

      const { error } = await supabase.from("nylas_accounts").upsert({
        user_id: userId,
        organization_id: organizationId,
        nylas_grant_id: tokenData.grant_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        email_address: tokenData.email_address || null,
        provider: tokenData.provider || null,
        provider_email_address: tokenData.email_address || null,
        connected_at: new Date().toISOString(),
        expires_at: tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : null,
        is_active: true
      });

      if (error) {
        console.error("Database error:", error);
        return new Response(`Database error: ${error.message}`, { status: 500 });
      }

      // Get available calendars and set default
      console.log("📅 Fetching calendars for grant:", tokenData.grant_id);
      let defaultCalendarId = null;
      
      if (tokenData.access_token) {
        const calendarResponse = await fetch(
          `https://api.us.nylas.com/v3/grants/${tokenData.grant_id}/calendars`,
          {
            headers: {
              'Authorization': `Bearer ${Deno.env.get("NYLAS_CLIENT_SECRET")}`,
              'Accept': 'application/json'
            }
          }
        );

        if (calendarResponse.ok) {
          const calendarData = await calendarResponse.json();
          console.log("📅 Available calendars:", calendarData);
          
          if (calendarData.data && calendarData.data.length > 0) {
            // Use the primary calendar if available, otherwise the first one
            const primaryCalendar = calendarData.data.find(cal => cal.is_primary);
            defaultCalendarId = primaryCalendar ? primaryCalendar.id : calendarData.data[0].id;
            console.log("📅 Selected default calendar:", defaultCalendarId);
          }
        } else {
          console.error("Failed to fetch calendars:", await calendarResponse.text());
        }
      }

      // Update profile to mark calendar as connected and save grant_id + default_calendar_id
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ 
          nylas_connected: true,
          nylas_grant_id: tokenData.grant_id,
          default_calendar_id: defaultCalendarId
        })
        .eq("user_id", userId);

      // Create a direct login session using Supabase Admin API
      console.log("🔐 Creating direct login session for user:", userId);
      
      try {
        // Sign in the user directly using admin API
        const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: tokenData.email_address
        });

        if (sessionError) {
          console.error("Failed to generate login link:", sessionError);
        }
        
        console.log("✅ OAuth flow completed successfully for user:", userId);
        
        // Use magic link for instant login
        if (sessionData?.properties?.action_link) {
          console.log("🔗 Redirecting with magic link for auto-login");
          return new Response(null, {
            status: 302,
            headers: {
              ...corsHeaders,
              'Location': sessionData.properties.action_link
            }
          });
        }
      } catch (linkError) {
        console.error("Error generating magic link:", linkError);
      }
      
      // Fallback: redirect to main app
      console.log("⚠️ Using fallback redirect to main app");
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': 'https://preview--leadapp-mokube.lovable.app/'
        }
      });

    } catch (error) {
      console.error("OAuth callback error:", error);
      return new Response(`OAuth error: ${error.message}`, { status: 500 });
    }
  }

  if (req.method === 'POST') {
    // Handle OAuth initiate request
    try {
      const { user_id } = await req.json();
      
      if (!user_id) {
        return new Response("Missing user_id", { status: 400 });
      }

      
      const redirectUri = `https://ipjrhuijvgchbezcjhsk.supabase.co/functions/v1/nylas-oauth-redirect`;
      
      // Nylas OAuth URL voor hosted authentication
      const authUrl = new URL("https://api.us.nylas.com/v3/connect/auth");
      authUrl.searchParams.set("client_id", Deno.env.get("NYLAS_CLIENT_ID")!);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("state", user_id);
      authUrl.searchParams.set("access_type", "offline");

      return new Response(JSON.stringify({ auth_url: authUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      console.error("OAuth initiate error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});