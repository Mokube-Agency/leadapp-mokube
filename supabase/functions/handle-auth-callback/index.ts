import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🔴 [handle-auth-callback] Webhook received");
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const payload = await req.json()
    console.log("🔴 [handle-auth-callback] Payload:", payload);
    
    const { type, record: user } = payload

    if (type !== 'INSERT') {
      console.log("🔴 [handle-auth-callback] Not an INSERT event, skipping");
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    console.log("🔴 [handle-auth-callback] Processing new user:", user.id);

    // Create organization first
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: user.email || 'Nieuwe Organisatie'
      })
      .select()
      .single()

    if (orgError) {
      console.error("🔴 [handle-auth-callback] Error creating organization:", orgError);
      throw orgError;
    }

    console.log("✅ [handle-auth-callback] Organization created:", org.id);

    // Create or update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        user_id: user.id,
        organization_id: org.id,
        display_name: user.user_metadata?.full_name || user.email,
      })

    if (profileError) {
      console.error("🔴 [handle-auth-callback] Error creating profile:", profileError);
      throw profileError;
    }

    console.log("✅ [handle-auth-callback] Profile created for user:", user.id);

    // Update user metadata with organization_id
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: { 
        ...user.user_metadata,
        organization_id: org.id 
      }
    })

    if (updateError) {
      console.error("🔴 [handle-auth-callback] Error updating user metadata:", updateError);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error("🔴 [handle-auth-callback] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})