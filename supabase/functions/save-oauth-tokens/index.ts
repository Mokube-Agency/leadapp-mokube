import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log("🔍 [save-oauth-tokens] Function invoked at", new Date().toISOString());
  console.log("🔍 [save-oauth-tokens] Request method:", req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("🔴 [save-oauth-tokens] Supabase configuration missing");
      return new Response("Supabase configuration missing", { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Parse webhook payload or direct API call
    const payload = await req.json();
    console.log("🔍 [save-oauth-tokens] Received payload structure:", {
      keys: Object.keys(payload),
      hasUser: !!payload.user,
      hasSession: !!payload.session,
      eventType: payload.event_type
    });

    let user_id, provider, access_token, refresh_token, user_metadata;

    // Check if this is an auth webhook from Supabase
    if (payload.user && payload.session) {
      // This is an auth webhook payload
      const user = payload.user;
      const session = payload.session;
      
      user_id = user.id;
      provider = user.app_metadata?.provider;
      access_token = session.provider_token;
      refresh_token = session.provider_refresh_token;
      user_metadata = user.raw_user_meta_data || {};
      
      console.log("🔍 [save-oauth-tokens] Auth webhook data:", {
        provider,
        user_id,
        hasAccessToken: !!access_token,
        hasRefreshToken: !!refresh_token
      });
      
      // First, ensure profile exists
      if (provider === 'google' || provider === 'azure' || provider === 'microsoft') {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({
            user_id: user_id,
            display_name: user_metadata.full_name || user_metadata.name || user.email,
            organization_id: '00000000-0000-0000-0000-000000000000' // Default org
          });

        if (profileError) {
          console.error("🔴 [save-oauth-tokens] Error creating profile:", profileError);
        } else {
          console.log("✅ [save-oauth-tokens] Profile created/updated for user:", user_id);
        }

        // Save OAuth tokens if available
        if (refresh_token) {
          const tokenUpdate: any = {};
          
          if (provider === "google") {
            tokenUpdate.google_access_token = access_token;
            tokenUpdate.google_refresh_token = refresh_token;
          } else if (provider === "microsoft" || provider === "azure") {
            tokenUpdate.microsoft_access_token = access_token;
            tokenUpdate.microsoft_refresh_token = refresh_token;
          }

          const { error: tokenError } = await supabase
            .from("profiles")
            .update(tokenUpdate)
            .eq("user_id", user_id);

          if (tokenError) {
            console.error("🔴 [save-oauth-tokens] Error saving tokens:", tokenError);
          } else {
            console.log(`✅ [save-oauth-tokens] Saved ${provider} tokens via webhook`);
          }
        }
      }
      
      return new Response("Auth webhook processed", { 
        status: 200,
        headers: corsHeaders 
      });
    }

    // Handle direct API calls (existing functionality)
    user_id = payload.user_id;
    provider = payload.provider;
    access_token = payload.access_token;
    refresh_token = payload.refresh_token;
    
    if (!user_id || !provider || !refresh_token) {
      console.error("🔴 [save-oauth-tokens] Missing required data:", { 
        user_id: !!user_id, 
        provider: !!provider, 
        refresh_token: !!refresh_token 
      });
      return new Response("Missing required data: user_id, provider, and refresh_token are required", { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const update: any = {};
    
    if (provider === "google") {
      update.google_access_token = access_token;
      update.google_refresh_token = refresh_token;
    } else if (provider === "microsoft" || provider === "azure") {
      update.microsoft_access_token = access_token;
      update.microsoft_refresh_token = refresh_token;
    } else {
      console.error("🔴 [save-oauth-tokens] Unsupported provider:", provider);
      return new Response(`Unsupported provider: ${provider}`, { 
        status: 400,
        headers: corsHeaders 
      });
    }

    console.log(`🔍 [save-oauth-tokens] Saving ${provider} tokens for user: ${user_id}`);
    
    const { data, error } = await supabase
      .from("profiles")
      .update(update)
      .eq("user_id", user_id);

    if (error) {
      console.error("🔴 [save-oauth-tokens] Error saving tokens:", error);
      return new Response(`Error saving tokens: ${error.message}`, { 
        status: 500,
        headers: corsHeaders 
      });
    }

    console.log(`✅ [save-oauth-tokens] Successfully saved ${provider} tokens for user: ${user_id}`);
    
    return new Response("Tokens saved successfully", { 
      status: 200,
      headers: corsHeaders 
    });

  } catch (error) {
    console.error("🔴 [save-oauth-tokens] Unexpected error:", error);
    return new Response(`Error: ${error.message}`, { 
      status: 500,
      headers: corsHeaders 
    });
  }
});