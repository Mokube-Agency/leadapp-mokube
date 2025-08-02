import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invite_id } = await req.json();
    
    if (!invite_id) {
      return new Response(
        JSON.stringify({ error: "invite_id required" }), 
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }), 
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create supabase client with user JWT for auth
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Get current user from JWT
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid user token" }), 
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log('Processing invite acceptance for user:', user.id, 'invite:', invite_id);

    // 1) Get invite details
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("organization_invites")
      .select("organization_id, status, email")
      .eq("id", invite_id)
      .single();

    if (inviteError || !invite) {
      console.error('Invite not found:', inviteError);
      return new Response(
        JSON.stringify({ error: "Invalid invite" }), 
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (invite.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Invite already used or expired" }), 
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user email matches invite email
    if (user.email !== invite.email) {
      return new Response(
        JSON.stringify({ error: "Email mismatch - this invite is for a different email address" }), 
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 2) Add user to organization_users (using admin client to bypass RLS)
    const { error: memberError } = await supabaseAdmin
      .from("organization_users")
      .insert({
        organization_id: invite.organization_id,
        user_id: user.id,
        role: 'member'
      });

    if (memberError) {
      console.error('Error adding user to organization:', memberError);
      return new Response(
        JSON.stringify({ error: "Failed to add user to organization" }), 
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 3) Update user profile with organization_id
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ organization_id: invite.organization_id })
      .eq("user_id", user.id);

    if (profileError) {
      console.error('Error updating user profile:', profileError);
      // Non-fatal error, continue
    }

    // 4) Update invite status to accepted
    const { error: updateError } = await supabaseAdmin
      .from("organization_invites")
      .update({ status: "accepted" })
      .eq("id", invite_id);

    if (updateError) {
      console.error('Error updating invite status:', updateError);
      // Non-fatal error, continue
    }

    console.log('Invite accepted successfully for user:', user.id);

    return new Response(
      JSON.stringify({ success: true, message: "Invite accepted successfully" }), 
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    console.error('Error in accept-invite function:', error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }), 
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);