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

  if (req.method === 'POST') {
    try {
      const { user_id } = await req.json();
      
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id missing" }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      // Verwijder Nylas-account record
      const { error: deleteError } = await supabase
        .from("nylas_accounts")
        .delete()
        .eq("user_id", user_id);

      if (deleteError) {
        console.error("Error deleting nylas account:", deleteError);
        return new Response(JSON.stringify({ error: deleteError.message }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Zet nylas_connected flag af in profiles
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ nylas_connected: false })
        .eq("user_id", user_id);

      if (updateError) {
        console.error("Error updating profile:", updateError);
        return new Response(JSON.stringify({ error: updateError.message }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ message: "Disconnected successfully" }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error("Disconnect calendar error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});