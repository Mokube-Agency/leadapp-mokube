import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSupabaseRealtime } from "@/hooks/useSupabaseRealtime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, Building } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Organization {
  id: string;
  name: string;
  created_at: string;
}

interface Profile {
  id: string;
  display_name: string;
  user_id: string;
  created_at: string;
}

interface Invite {
  id: string;
  email: string;
  status: string;
  created_at: string;
  invited_by: string;
}

export default function OrganizationPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  
  const { data: invites } = useSupabaseRealtime<Invite>(
    "organization_invites",
    profile?.organization_id ? `organization_id.eq.${profile.organization_id}` : undefined,
    "created_at.desc"
  );

  useEffect(() => {
    if (!profile?.organization_id) return;

    const fetchOrganizationData = async () => {
      try {
        // Fetch organization details
        const { data: orgData, error: orgError } = await supabase
          .from("organizations")
          .select("id, name, created_at")
          .eq("id", profile.organization_id)
          .single();

        if (orgError) throw orgError;
        setOrganization(orgData);

        // Fetch organization members
        const { data: membersData, error: membersError } = await supabase
          .from("profiles")
          .select("id, display_name, user_id, created_at")
          .eq("organization_id", profile.organization_id);

        if (membersError) throw membersError;
        setMembers(membersData || []);
      } catch (error) {
        console.error("Error fetching organization data:", error);
        toast({
          title: "Fout",
          description: "Kon organisatiegegevens niet laden",
          variant: "destructive",
        });
      }
    };

    fetchOrganizationData();
  }, [profile?.organization_id, toast]);

  const handleInvite = async () => {
    if (!email.trim() || !organization) return;

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-invite", {
        body: {
          organization_id: organization.id,
          email: email.trim(),
          invited_by: user?.id
        }
      });

      if (error) throw error;

      toast({
        title: "Uitnodiging verzonden",
        description: `Uitnodiging is verzonden naar ${email}`,
      });
      setEmail("");
    } catch (error) {
      console.error("Error sending invite:", error);
      toast({
        title: "Fout",
        description: "Kon uitnodiging niet verzenden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!organization) {
    return (
      <div className="p-6">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Building className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Mijn Organisatie</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Organisatiedetails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Naam:</strong> {organization.name}</p>
            <p><strong>Aangemaakt:</strong> {new Date(organization.created_at).toLocaleDateString()}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Teamleden ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.length > 0 ? (
              members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-2 border rounded">
                  <span>{member.display_name || "Naam niet ingesteld"}</span>
                  <Badge variant="secondary">
                    Lid sinds {new Date(member.created_at).toLocaleDateString()}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Geen teamleden gevonden</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Nieuwe gebruiker uitnodigen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="E-mailadres van gebruiker"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              className="flex-1"
            />
            <Button
              onClick={handleInvite}
              disabled={!email.trim() || loading}
              className="min-w-[100px]"
            >
              {loading ? "Bezig..." : "Uitnodigen"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Openstaande uitnodigingen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {invites && invites.length > 0 ? (
              invites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between p-2 border rounded">
                  <span>{invite.email}</span>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={invite.status === "pending" ? "default" : 
                              invite.status === "accepted" ? "secondary" : "destructive"}
                    >
                      {invite.status === "pending" ? "In behandeling" :
                       invite.status === "accepted" ? "Geaccepteerd" : "Verlopen"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(invite.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Geen openstaande uitnodigingen</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}