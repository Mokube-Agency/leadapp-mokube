import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const token = searchParams.get('token');
        const type = searchParams.get('type');
        
        if (token && type) {
          // Verify the token with Supabase
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as any
          });
          
          if (error) {
            console.error('Auth verification error:', error);
            toast({
              title: 'Login Error',
              description: 'Failed to verify authentication token',
              variant: 'destructive'
            });
            navigate('/auth');
            return;
          }
          
          console.log('✅ Auth verification successful:', data);
          
          // Redirect to main app
          navigate('/');
        } else {
          // No auth params, redirect to login
          navigate('/auth');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/auth');
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted-foreground">Completing login...</div>
    </div>
  );
}