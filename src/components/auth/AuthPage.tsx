import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Mail, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to the main page
  useEffect(() => {
    if (user) {
      console.log("✅ User authenticated, redirecting to main app");
      navigate("/");
    }
  }, [user, navigate]);

  const handleNylasLogin = () => {
    // Start the Nylas OAuth via our Edge Function using the full Supabase URL
    console.log("🔵 Starting Nylas login...");
    window.location.href = "https://ipjrhuijvgchbezcjhsk.supabase.co/functions/v1/nylas-sso-init";
  };

  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to Leadapp</CardTitle>
          <p className="text-muted-foreground">
            Connect your calendar and email to get started
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <div className="flex justify-center space-x-4 text-muted-foreground mb-4">
              <Calendar className="h-8 w-8" />
              <Mail className="h-8 w-8" />
              <User className="h-8 w-8" />
            </div>
            <p className="text-sm text-muted-foreground">
              Get access to your calendar, email, and contacts all in one place
            </p>
          </div>
          
          <Button
            onClick={handleNylasLogin}
            className="w-full"
            size="lg"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Log in with Nylas
          </Button>
          
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              By logging in, you agree to connect your calendar and email account
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}