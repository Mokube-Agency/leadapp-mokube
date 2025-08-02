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
    const { user_id, provider, access_token, refresh_token } = await req.json();
    
    if (!user_id || !provider || !refresh_token) {
      return new Response("Missing required data: user_id, provider, and refresh_token are required", { 
        status: 400,
        headers: corsHeaders 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response("Supabase configuration missing", { 
        status: 500,
        headers: corsHeaders 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const update: any = {};
    
    if (provider === "google") {
      update.google_access_token = access_token;
      update.google_refresh_token = refresh_token;
    } else if (provider === "microsoft" || provider === "azure") {
      update.microsoft_access_token = access_token;
      update.microsoft_refresh_token = refresh_token;
    } else {
      return new Response(`Unsupported provider: ${provider}`, { 
        status: 400,
        headers: corsHeaders 
      });
    }

    console.log(`Saving ${provider} tokens for user: ${user_id}`);
    
    const { data, error } = await supabase
      .from("profiles")
      .update(update)
      .eq("user_id", user_id);

    if (error) {
      console.error("Error saving tokens:", error);
      return new Response(`Error saving tokens: ${error.message}`, { 
        status: 500,
        headers: corsHeaders 
      });
    }

    console.log(`Successfully saved ${provider} tokens for user: ${user_id}`);
    
    return new Response("Tokens saved successfully", { 
      status: 200,
      headers: corsHeaders 
    });

  } catch (error) {
    console.error("Save OAuth tokens error:", error);
    return new Response(`Error: ${error.message}`, { 
      status: 500,
      headers: corsHeaders 
    });
  }
});