import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Invite {
  id: string;
  organization_id: string;
  email: string;
  status: string;
  created_at: string;
  organization: {
    name: string;
  };
}

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const inviteId = searchParams.get('invite_id');

  useEffect(() => {
    if (!inviteId) {
      setError('Geen uitnodiging ID gevonden');
      setLoading(false);
      return;
    }

    const fetchInvite = async () => {
      try {
        const { data, error } = await supabase
          .from('organization_invites')
          .select(`
            id,
            organization_id,
            email,
            status,
            created_at,
            organizations (
              name
            )
          `)
          .eq('id', inviteId)
          .single();

        if (error) throw error;

        if (!data) {
          setError('Uitnodiging niet gevonden');
          return;
        }

        if (data.status !== 'pending') {
          setError('Deze uitnodiging is al gebruikt of verlopen');
          return;
        }

        setInvite({
          ...data,
          organization: data.organizations
        } as Invite);
      } catch (err) {
        console.error('Error fetching invite:', err);
        setError('Kon uitnodiging niet laden');
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [inviteId]);

  const handleAcceptInvite = async () => {
    if (!invite || !user) return;

    setAccepting(true);
    try {
      // Update user's profile with new organization
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ organization_id: invite.organization_id })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      // Mark invitation as accepted
      const { error: inviteError } = await supabase
        .from('organization_invites')
        .update({ status: 'accepted' })
        .eq('id', invite.id);

      if (inviteError) throw inviteError;

      // Update user metadata
      const { error: metadataError } = await supabase.functions.invoke('update-user-metadata', {
        body: {
          userId: user.id,
          organizationId: invite.organization_id
        }
      });

      if (metadataError) {
        console.error('Error updating user metadata:', metadataError);
      }

      toast({
        title: "Uitnodiging geaccepteerd",
        description: `Je bent nu lid van ${invite.organization.name}`,
      });

      // Redirect to main app
      navigate('/chats');
    } catch (err) {
      console.error('Error accepting invite:', err);
      toast({
        title: "Fout",
        description: "Kon uitnodiging niet accepteren",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Uitnodiging laden...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Fout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Terug naar start
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Inloggen vereist</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Je moet inloggen om deze uitnodiging te accepteren.
            </p>
            <Button onClick={() => navigate('/')} className="w-full">
              Inloggen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user's email matches invite email
  const emailMatches = user.email === invite?.email;
  if (!emailMatches) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              Verkeerd account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Deze uitnodiging is verstuurd naar {invite?.email}, maar je bent ingelogd als {user.email}.
            </p>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Uitloggen en opnieuw inloggen
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Uitnodiging Accepteren
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Je bent uitgenodigd voor:</p>
            <p className="font-semibold text-lg">{invite?.organization.name}</p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground">E-mail:</p>
            <p>{invite?.email}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Uitgenodigd op:</p>
            <p>{invite && new Date(invite.created_at).toLocaleDateString()}</p>
          </div>

          <div className="pt-4">
            <Button 
              onClick={handleAcceptInvite}
              disabled={accepting}
              className="w-full"
            >
              {accepting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Accepteren...
                </>
              ) : (
                'Uitnodiging Accepteren'
              )}
            </Button>
          </div>

          <Button 
            onClick={() => navigate('/')}
            variant="outline"
            className="w-full"
          >
            Annuleren
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}