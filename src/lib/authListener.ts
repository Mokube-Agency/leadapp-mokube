import { supabase } from "@/integrations/supabase/client";

console.log('🚀 [AuthListener] Module loaded - setting up auth state listener');

// Auto-capture and save OAuth tokens when user signs in with social providers
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('🔍 [AuthListener] Auth state change:', event, {
    userId: session?.user?.id,
    provider: session?.user?.app_metadata?.provider,
    hasProviderToken: !!session?.provider_token,
    hasRefreshToken: !!session?.provider_refresh_token,
    sessionKeys: session ? Object.keys(session) : null
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
      hasRefreshToken: !!refreshToken,
      accessTokenLength: accessToken?.length || 0,
      refreshTokenLength: refreshToken?.length || 0
    });
    
    // Check if this is a social login with provider tokens
    if (provider && (provider === "google" || provider === "azure" || provider === "microsoft") && refreshToken) {
      try {
        console.log(`🔍 [AuthListener] Attempting to save ${provider} tokens for user:`, userId);
        
        // Use direct fetch to the edge function with full URL
        const functionUrl = `https://ipjrhuijvgchbezcjhsk.supabase.co/functions/v1/save-oauth-tokens`;
        console.log('🔍 [AuthListener] Calling function URL:', functionUrl);
        
        const requestBody = {
          user_id: userId,
          provider: provider,
          access_token: accessToken,
          refresh_token: refreshToken
        };
        
        console.log('🔍 [AuthListener] Request body:', {
          ...requestBody,
          access_token: accessToken ? `${accessToken.substring(0, 10)}...` : null,
          refresh_token: refreshToken ? `${refreshToken.substring(0, 10)}...` : null
        });

        const response = await fetch(functionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwanJodWlqdmdjaGJlemNqaHNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMjg2ODIsImV4cCI6MjA2ODYwNDY4Mn0.6ixbyuGbnB0mGp2HEWEwPcQt8G_6yWsP-muuJ9Hk_rc`
          },
          body: JSON.stringify(requestBody)
        });

        const responseText = await response.text();
        console.log('🔍 [AuthListener] Function response:', {
          status: response.status,
          statusText: response.statusText,
          body: responseText
        });

        if (!response.ok) {
          console.error("🔴 [AuthListener] Error response from save-oauth-tokens:", response.status, responseText);
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