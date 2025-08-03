import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

serve(async (req) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    
    if (!code || !state) {
      return new Response("Missing code or state", { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Exchange code for tokens with Nylas
    const nylasClientId = Deno.env.get("NYLAS_CLIENT_ID");
    const nylasClientSecret = Deno.env.get("NYLAS_CLIENT_SECRET");
    
    if (!nylasClientId || !nylasClientSecret) {
      return new Response("Nylas credentials not configured", { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    const redirectUri = `${url.origin}/functions/v1/nylas-oauth-redirect`;
    
    const tokenResponse = await fetch('https://api.us.nylas.com/v3/connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: nylasClientId,
        client_secret: nylasClientSecret,
        redirect_uri: redirectUri,
        code: code,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Nylas token exchange error:", errorText);
      return new Response(`Token exchange failed: ${errorText}`, { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    const tokenData = await tokenResponse.json();
    console.log("Token exchange successful:", tokenData);

    // Store in database
    const { error: dbError } = await supabase
      .from('nylas_accounts')
      .upsert({
        user_id: state, // state contains user ID
        nylas_grant_id: tokenData.grant_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
        provider: 'google', // or detect from token data
        is_active: true
      });

    if (dbError) {
      console.error("Database error:", dbError);
      return new Response(`Database error: ${dbError.message}`, { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Update profile to mark Nylas as connected
    await supabase
      .from('profiles')
      .update({ 
        nylas_connected: true,
        nylas_grant_id: tokenData.grant_id 
      })
      .eq('user_id', state);

    // Redirect back to settings page
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        "Location": `${url.origin}/settings?nylas=connected`
      }
    });

  } catch (error) {
    console.error("OAuth redirect error:", error);
    return new Response(`Error: ${error.message}`, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});