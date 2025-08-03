import { supabase } from "@/integrations/supabase/client";

console.log('🚀 [AuthListener] Module loaded - setting up auth state listener');

// Auto-capture and save OAuth tokens when user signs in with social providers
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('🔍 [AuthListener] Auth state change:', event, {
    userId: session?.user?.id,
    provider: session?.user?.app_metadata?.provider,
    hasProviderToken: !!session?.provider_token,
    hasRefreshToken: !!session?.provider_refresh_token
  });
  
  if (event === "SIGNED_IN" && session?.user) {
    const userId = session.user.id;
    const provider = session.user.app_metadata?.provider;
    const accessToken = session.provider_token;
    const refreshToken = session.provider_refresh_token;

    console.log('🔍 [AuthListener] User signed in:', {
      userId,
      provider,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken
    });
    
    // Check if this is a social login with provider tokens
    if (provider && (provider === "google" || provider === "azure" || provider === "microsoft") && refreshToken) {
      try {
        console.log(`🔍 [AuthListener] Saving ${provider} tokens for user:`, userId);
        
        // Use supabase.functions.invoke for proper authentication and error handling
        const response = await supabase.functions.invoke('save-oauth-tokens', {
          body: {
            user_id: userId,
            provider: provider,
            access_token: accessToken,
            refresh_token: refreshToken
          }
        });

        console.log('🔍 [AuthListener] Save tokens response:', {
          error: response.error,
          data: response.data
        });

        if (response.error) {
          console.error("🔴 [AuthListener] Error saving OAuth tokens:", response.error);
        } else {
          console.log(`✅ [AuthListener] Successfully saved ${provider} tokens`);
        }
      } catch (error) {
        console.error("🔴 [AuthListener] Failed to save OAuth tokens:", error);
      }
    } else {
      console.log('🔍 [AuthListener] No provider tokens to save:', {
        provider,
        hasRefreshToken: !!refreshToken,
        supportedProvider: provider === "google" || provider === "azure" || provider === "microsoft"
      });
    }
  }
});