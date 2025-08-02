import { supabase } from "@/integrations/supabase/client";

// Auto-capture and save OAuth tokens when user signs in with social providers
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('🔍 [AuthListener] Auth state change:', event, session?.user?.id);
  
  if (event === "SIGNED_IN" && session?.user) {
    console.log('🔍 [AuthListener] User signed in:', session.user.id);
    console.log('🔍 [AuthListener] Session data:', {
      provider_token: session.provider_token,
      provider_refresh_token: session.provider_refresh_token,
      provider: session.user.app_metadata?.provider
    });
    
    // Check if this is a social login with provider tokens
    const providerToken = session.provider_token;
    const providerRefreshToken = session.provider_refresh_token;
    const provider = session.user.app_metadata?.provider;

    if (provider && (provider === "google" || provider === "azure") && providerRefreshToken) {
      try {
        console.log(`🔍 [AuthListener] Saving ${provider} tokens for user:`, session.user.id);
        
        const response = await supabase.functions.invoke('save-oauth-tokens', {
          body: {
            user_id: session.user.id,
            provider: provider,
            access_token: providerToken,
            refresh_token: providerRefreshToken
          }
        });

        console.log('🔍 [AuthListener] Save tokens response:', response);

        if (response.error) {
          console.error("🔴 [AuthListener] Error saving OAuth tokens:", response.error);
        } else {
          console.log(`✅ [AuthListener] Successfully saved ${provider} tokens`);
        }
      } catch (error) {
        console.error("🔴 [AuthListener] Failed to save OAuth tokens:", error);
      }
    } else {
      console.log('🔍 [AuthListener] No provider tokens to save. Provider:', provider, 'Has refresh token:', !!providerRefreshToken);
    }
  }
});