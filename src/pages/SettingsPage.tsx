import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User, Mail } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
          
        if (error) {
          console.error("Error loading profile:", error);
        } else {
          setProfile(data);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleConnectCalendar = () => {
    // This will redirect to the Nylas OAuth flow
    window.location.href = `/functions/nylas-oauth-redirect?state=${user?.id}`;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Instellingen</h1>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Gebruikersprofiel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">E-mailadres</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              
              {profile.display_name && (
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Weergavenaam</p>
                    <p className="text-sm text-muted-foreground">{profile.display_name}</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <span className="h-4 w-4 text-muted-foreground">🏢</span>
                <div>
                  <p className="text-sm font-medium">Organisatie ID</p>
                  <p className="text-sm text-muted-foreground font-mono">{profile.organization_id}</p>
                </div>
              </div>
            </div>
          )}
          
          {!profile && (
            <p className="text-muted-foreground">Geen profielgegevens gevonden</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Kalenderintegratie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Verbind je agenda om afspraken te synchroniseren en te beheren vanuit Leadapp.
            </p>
            
            <Button
              onClick={handleConnectCalendar}
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Verbind Agenda
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}