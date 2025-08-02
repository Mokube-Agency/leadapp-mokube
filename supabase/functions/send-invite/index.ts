import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const nylasClientId = Deno.env.get('NYLAS_CLIENT_ID')!;
    const nylasClientSecret = Deno.env.get('NYLAS_CLIENT_SECRET')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { organization_id, email, invited_by } = await req.json();

    if (!organization_id || !email || !invited_by) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Check if user is already invited or exists
    const { data: existingInvite } = await supabase
      .from('organization_invites')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('email', email)
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: 'User already invited' }),
        { 
          status: 400,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Insert invitation record
    const { data: invite, error } = await supabase
      .from('organization_invites')
      .insert({
        organization_id,
        email,
        invited_by,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Invite insert failed:', error);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { 
          status: 500,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Get organization name and inviter details
    const { data: orgData } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organization_id)
      .single();

    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', invited_by)
      .single();

    // Generate acceptance link
    const acceptLink = `${supabaseUrl.replace('.supabase.co', '.vercel.app')}/accept-invite?invite_id=${invite.id}`;

    // Get a Nylas account from the organization to send emails
    const { data: nylasAccount } = await supabase
      .from('nylas_accounts')
      .select('nylas_grant_id, email_address')
      .eq('organization_id', organization_id)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!nylasAccount) {
      console.log('No Nylas account found for organization, skipping email send');
      return new Response(
        JSON.stringify({ 
          success: true, 
          invite,
          message: 'Invitation created successfully (email not sent - no Nylas account configured)' 
        }),
        { 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    // Send email via Nylas API
    try {
      const emailBody = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2563eb;">Uitnodiging voor ${orgData?.name || 'de organisatie'}</h2>
              
              <p>Hallo,</p>
              
              <p>${inviterProfile?.display_name || 'Een teamlid'} heeft je uitgenodigd om deel te nemen aan <strong>${orgData?.name || 'de organisatie'}</strong> in Leadapp.</p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${acceptLink}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Uitnodiging Accepteren
                </a>
              </div>
              
              <p>Of kopieer en plak deze link in je browser:</p>
              <p style="background-color: #f3f4f6; padding: 10px; border-radius: 4px; word-break: break-all;">
                ${acceptLink}
              </p>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                Als je deze uitnodiging niet verwachtte, kun je deze e-mail negeren.
              </p>
            </div>
          </body>
        </html>
      `;

      const mailResponse = await fetch(`https://api.us.nylas.com/v3/grants/${nylasAccount.nylas_grant_id}/messages/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${nylasClientSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: [{ email: email }],
          from: [{ email: nylasAccount.email_address }],
          subject: `Uitnodiging voor ${orgData?.name || 'Leadapp'}`,
          body: emailBody
        })
      });

      const mailResult = await mailResponse.json();
      
      if (!mailResponse.ok) {
        console.error('Failed to send email via Nylas:', mailResult);
        return new Response(
          JSON.stringify({ 
            success: true, 
            invite,
            message: 'Invitation created successfully (email sending failed)',
            email_error: mailResult
          }),
          { 
            headers: { 
              ...corsHeaders,
              'Content-Type': 'application/json' 
            } 
          }
        );
      }

      console.log('📧 Invite email sent successfully via Nylas:', mailResult);
      
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      return new Response(
        JSON.stringify({ 
          success: true, 
          invite,
          message: 'Invitation created successfully (email sending failed)',
          email_error: emailError.message
        }),
        { 
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          } 
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        invite,
        message: 'Invitation sent successfully with email' 
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in send-invite function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});