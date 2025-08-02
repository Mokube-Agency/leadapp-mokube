import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import dayjs from "dayjs";
import "dayjs/locale/nl";

dayjs.locale("nl");

interface EmailMessage {
  id: string;
  nylas_message_id: string;
  from_address: string;
  to_address: string;
  subject: string | null;
  body: string | null;
  received_at: string;
  is_read: boolean;
  created_at: string;
}

export default function EmailPage() {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchEmails();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('email_messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_messages'
        },
        () => {
          fetchEmails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEmails = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from('email_messages')
        .select('*')
        .eq('user_id', user.user.id)
        .order('received_at', { ascending: false });

      if (error) throw error;

      setEmails(data || []);
    } catch (error) {
      console.error('Error fetching emails:', error);
      toast({
        title: "Fout",
        description: "Kon e-mailberichten niet laden",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (emailId: string) => {
    try {
      const { error } = await supabase
        .from('email_messages')
        .update({ is_read: true })
        .eq('id', emailId);

      if (error) throw error;

      // Update local state
      setEmails(prev => 
        prev.map(email => 
          email.id === emailId 
            ? { ...email, is_read: true }
            : email
        )
      );
    } catch (error) {
      console.error('Error marking email as read:', error);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">E-mailberichten laden...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">E-mailberichten</h1>
        <Badge variant="outline" className="text-sm">
          {emails.length} berichten
        </Badge>
      </div>

      <ScrollArea className="flex-1">
        {emails.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">Geen e-mailberichten gevonden</p>
                <p className="text-sm text-muted-foreground">
                  E-mailberichten verschijnen hier zodra ze zijn gesynchroniseerd via Nylas
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {emails.map((email) => (
              <Card 
                key={email.id} 
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  !email.is_read ? 'border-primary/50 bg-primary/5' : ''
                }`}
                onClick={() => markAsRead(email.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-lg line-clamp-1">
                        {email.subject || "(Geen onderwerp)"}
                      </CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span><strong>Van:</strong> {email.from_address}</span>
                        <span><strong>Aan:</strong> {email.to_address}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {!email.is_read && (
                        <Badge variant="default" className="text-xs">
                          Nieuw
                        </Badge>
                      )}
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {dayjs(email.received_at).format("DD MMM YYYY HH:mm")}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                {email.body && (
                  <CardContent className="pt-0">
                    <div className="text-sm text-muted-foreground line-clamp-3">
                      {email.body}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}