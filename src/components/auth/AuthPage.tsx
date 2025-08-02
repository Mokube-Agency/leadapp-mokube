import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Mail } from 'lucide-react';

export function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        
        if (error) throw error;
        
        toast({
          title: "Account aangemaakt",
          description: "Check je email voor bevestiging"
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (error) throw error;
        
        toast({
          title: "Ingelogd",
          description: "Welkom terug!"
        });
      }
    } catch (error: any) {
      toast({
        title: "Fout",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'azure') => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });
      
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Fout",
        description: error.message,
        variant: "destructive"
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
            <MessageSquare className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Leadapp</CardTitle>
          <CardDescription>
            WhatsApp leadopvolging met AI-agenten
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Social Login Buttons */}
          <div className="space-y-3 mb-6">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleSocialLogin('google')}
              disabled={loading}
            >
              <Mail className="mr-2 h-4 w-4" />
              Inloggen met Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleSocialLogin('azure')}
              disabled={loading}
            >
              <Mail className="mr-2 h-4 w-4" />
              Inloggen met Microsoft
            </Button>
          </div>

          <div className="relative">
            <Separator />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="bg-background px-2 text-muted-foreground text-sm">
                of met email
              </span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 mt-6">
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Wachtwoord"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Bezig...' : isSignUp ? 'Account aanmaken' : 'Inloggen'}
            </Button>
          </form>
          
          <div className="mt-4 text-center">
            <Button
              variant="link"
              onClick={() => setIsSignUp(!isSignUp)}
              disabled={loading}
            >
              {isSignUp 
                ? 'Al een account? Inloggen' 
                : 'Nog geen account? Registreren'
              }
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}