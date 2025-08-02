import { supabase } from "@/integrations/supabase/client";

// Auto-capture and save OAuth tokens when user signs in with social providers
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === "SIGNED_IN" && session?.user) {
    // Check if this is a social login with provider tokens
    const providerToken = session.provider_token;
    const providerRefreshToken = session.provider_refresh_token;
    const provider = session.user.app_metadata?.provider;

    if (provider && (provider === "google" || provider === "azure") && providerRefreshToken) {
      try {
        console.log(`Saving ${provider} tokens for user:`, session.user.id);
        
        const response = await supabase.functions.invoke('save-oauth-tokens', {
          body: {
            user_id: session.user.id,
            provider: provider,
            access_token: providerToken,
            refresh_token: providerRefreshToken
          }
        });

        if (response.error) {
          console.error("Error saving OAuth tokens:", response.error);
        } else {
          console.log(`Successfully saved ${provider} tokens`);
        }
      } catch (error) {
        console.error("Failed to save OAuth tokens:", error);
      }
    }
  }
});