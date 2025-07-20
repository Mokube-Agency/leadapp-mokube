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
    const SUPABASE_URL = "https://ipjrhuijvgchbezcjhsk.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwanJodWlqdmdjaGJlemNqaHNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMjg2ODIsImV4cCI6MjA2ODYwNDY4Mn0.6ixbyuGbnB0mGp2HEWEwPcQt8G_6yWsP-muuJ9Hk_rc";
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') ?? ''
        }
      }
    });

    // Get the user from the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // Get user's organization from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return new Response('Profile not found', { status: 404, headers: corsHeaders });
    }

    // Get current AI pause status
    const { data: org } = await supabase
      .from('organizations')
      .select('ai_paused')
      .eq('id', profile.organization_id)
      .single();

    if (!org) {
      return new Response('Organization not found', { status: 404, headers: corsHeaders });
    }

    // Toggle AI pause status
    const newStatus = !org.ai_paused;
    
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ ai_paused: newStatus })
      .eq('id', profile.organization_id);

    if (updateError) {
      console.error('Error updating AI pause status:', updateError);
      return new Response('Database error', { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ 
      ai_paused: newStatus,
      message: newStatus ? 'AI agent gepauzeerd' : 'AI agent geactiveerd'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Toggle AI pause error:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
});