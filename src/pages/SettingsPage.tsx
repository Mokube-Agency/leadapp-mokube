import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Settings, ExternalLink, Unlink2, User, Mail, Unlink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Calendar {
  id: string;
  name: string;
  description?: string;
  timezone?: string;
  is_primary?: boolean;
  read_only?: boolean;
}

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  nylas_connected: boolean;
  organization_id: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [grantId, setGrantId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  useEffect(() => {
    if (profile?.nylas_connected) {
      loadNylasAccount();
    }
  }, [profile]);

  useEffect(() => {
    if (!grantId) return;
    loadCalendars();
  }, [grantId]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, nylas_connected, organization_id')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        return;
      }

      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadNylasAccount = async () => {
    try {
      const { data, error } = await supabase
        .from('nylas_accounts')
        .select('nylas_grant_id')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        console.error('Error loading Nylas account:', error);
        return;
      }

      if (data && data.length > 0 && data[0].nylas_grant_id) {
        setGrantId(data[0].nylas_grant_id);
      }
    } catch (error) {
      console.error('Error loading Nylas account:', error);
    }
  };

  const loadCalendars = async () => {
    if (!grantId) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-calendars', {
        body: { grant_id: grantId }
      });

      if (error) {
        console.error('Error loading calendars:', error);
        return;
      }

      setCalendars(data || []);
    } catch (error) {
      console.error('Error loading calendars:', error);
    }
  };

  const handleConnectCalendar = async () => {
    if (!user) return;

    try {
      const response = await supabase.functions.invoke('nylas-oauth-redirect', {
        body: { user_id: user.id }
      });

      if (response.data?.auth_url) {
        window.location.href = response.data.auth_url;
      } else {
        console.error('No auth URL received:', response);
      }
    } catch (error) {
      console.error('Error initiating calendar connection:', error);
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!user) return;

    try {
      const response = await supabase.functions.invoke('disconnect-calendar', {
        body: { user_id: user.id }
      });

      if (response.error) {
        console.error('Error disconnecting calendar:', response.error);
        toast({
          title: "Fout",
          description: "Er is een fout opgetreden bij het ontkoppelen van de agenda.",
          variant: "destructive",
        });
      } else {
        // Refresh profile data from database to ensure accurate state
        await loadProfile();
        setCalendars([]);
        setGrantId(null);
        toast({
          title: "Succes",
          description: "Agenda succesvol ontkoppeld.",
        });
      }
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      toast({
        title: "Fout",
        description: "Er is een fout opgetreden bij het ontkoppelen van de agenda.",
        variant: "destructive",
      });
    }
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
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Verbind je agenda om afspraken te synchroniseren en te beheren vanuit Leadapp.
          </p>
          
          {profile?.nylas_connected ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  disabled
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Calendar className="h-4 w-4" />
                  Gekoppeld
                </Button>
                <Button
                  onClick={handleDisconnectCalendar}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <Unlink className="h-4 w-4" />
                  Ontkoppel Agenda
                </Button>
              </div>

              {calendars.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Verbonden kalenders ({calendars.length})</h4>
                  <div className="space-y-2">
                    {calendars.map((calendar) => (
                      <div key={calendar.id} className="p-3 rounded-lg border">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-medium">{calendar.name}</h5>
                            {calendar.description && (
                              <p className="text-sm text-muted-foreground">{calendar.description}</p>
                            )}
                            {calendar.timezone && (
                              <p className="text-sm text-muted-foreground">Tijdzone: {calendar.timezone}</p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {calendar.is_primary && (
                              <Badge variant="default" className="text-xs">
                                Primair
                              </Badge>
                            )}
                            {calendar.read_only && (
                              <Badge variant="secondary" className="text-xs">
                                Alleen lezen
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button
              onClick={handleConnectCalendar}
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Verbind Agenda
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}