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
    const state = searchParams.get("state");
    
    if (!code || !state) {
      return new Response("Invalid OAuth callback", { status: 400 });
    }

    try {
      console.log("Received OAuth callback with code:", code, "and state:", state);

      // Validate state and get user_id from database
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: stateRecord, error: stateError } = await supabase
        .from("oauth_states")
        .select("user_id")
        .eq("state", state)
        .single();

      if (stateError || !stateRecord) {
        console.error("Invalid or expired state:", state, stateError);
        return new Response("Invalid or expired OAuth state", { status: 400 });
      }

      const userId = stateRecord.user_id;
      console.log("✅ Valid state found for user:", userId);

      // Remove state to prevent reuse
      await supabase.from("oauth_states").delete().eq("state", state);

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

      // Use validated userId from state record
      let authUser = null;
      
      if (tokenData.email_address) {
        console.log("🔍 Creating/finding user for email:", tokenData.email_address);
        
        // Try to create user in Supabase Auth
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email: tokenData.email_address,
          email_confirm: true,
          user_metadata: {
            nylas_grant_id: tokenData.grant_id,
            provider: tokenData.provider || "gmail",
            full_name: tokenData.email_address.split('@')[0]
          }
        });
        
        if (createError) {
          if (createError.message.includes('already registered')) {
            // User exists, get existing user
            console.log("✅ User already exists, fetching existing user");
            const { data: users } = await supabase.auth.admin.listUsers();
            authUser = users.users.find(u => u.email === tokenData.email_address);
            userId = authUser?.id;
          } else {
            console.error("Failed to create user:", createError);
            return new Response("Failed to create user account", { status: 500 });
          }
        } else {
          console.log("✅ New user created successfully");
          authUser = newUser.user;
          userId = newUser.user.id;
        }
      }

      if (!userId || !authUser) {
        console.error("Failed to get user ID or auth user");
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

      // Simpele redirect naar settings pagina
      console.log("✅ OAuth flow completed successfully for user:", userId);
      console.log("🔗 Redirecting to settings page");
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': 'https://preview--leadapp-mokube.lovable.app/settings?nylas=connected'
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