import { useState } from 'react';
import { Bot, User, UserCheck, Play, Pause } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';
import { Contact, Message, Organization } from '@/types/database';
import { MessageInput } from './MessageInput';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ChatWindowProps {
  contact: Contact;
}

export function ChatWindow({ contact }: ChatWindowProps) {
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  
  const { data: messages } = useSupabaseRealtime<Message>(
    'messages',
    `contact_id.eq.${contact.id}`,
    'created_at.asc'
  );

  const { data: organizations } = useSupabaseRealtime<Organization>(
    'organizations',
    `id.eq.${contact.organization_id}`
  );
  
  const organization = organizations[0];

  const handleSendMessage = async (message: string) => {
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Fout",
          description: "Je moet ingelogd zijn om berichten te verzenden",
          variant: "destructive"
        });
        return;
      }

      const response = await supabase.functions.invoke('send-message', {
        body: { contactId: contact.id, message },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: "Succes",
        description: "Bericht verzonden"
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Fout",
        description: "Kon bericht niet verzenden",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const handleToggleAI = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Fout",
          description: "Je moet ingelogd zijn",
          variant: "destructive"
        });
        return;
      }

      const response = await supabase.functions.invoke('toggle-ai-pause', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: "Succes",
        description: response.data.message
      });
    } catch (error) {
      console.error('Error toggling AI:', error);
      toast({
        title: "Fout",
        description: "Kon AI-status niet wijzigen",
        variant: "destructive"
      });
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('nl-NL', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessageIcon = (role: Message['role']) => {
    switch (role) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'agent':
        return <Bot className="h-4 w-4" />;
      case 'human':
        return <UserCheck className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getMessageBubbleClass = (role: Message['role']) => {
    switch (role) {
      case 'user':
        return "bg-primary text-primary-foreground ml-auto";
      case 'agent':
        return "bg-muted";
      case 'human':
        return "bg-green-500 text-white ml-auto";
      default:
        return "bg-muted";
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">
            {contact.full_name || contact.whatsapp_number.replace('whatsapp:', '')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {contact.whatsapp_number.replace('whatsapp:', '')}
          </p>
        </div>
        
        <Button
          variant={organization?.ai_paused ? "destructive" : "default"}
          size="sm"
          onClick={handleToggleAI}
          className="flex items-center gap-2"
        >
          {organization?.ai_paused ? (
            <>
              <Play className="h-4 w-4" />
              AI Gepauzeerd
            </>
          ) : (
            <>
              <Pause className="h-4 w-4" />
              AI Actief
            </>
          )}
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground mt-8">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nog geen berichten</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2",
                  (message.role === 'user' || message.role === 'human') ? "justify-end" : "justify-start"
                )}
              >
                {(message.role === 'agent' || message.role === 'system') && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {getMessageIcon(message.role)}
                  </div>
                )}
                
                <div className={cn(
                  "max-w-[70%] rounded-lg p-3",
                  getMessageBubbleClass(message.role)
                )}>
                  <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                  <p className={cn(
                    "text-xs mt-1 opacity-70",
                    message.role === 'user' || message.role === 'human' 
                      ? "text-right" 
                      : "text-left"
                  )}>
                    {formatTime(message.created_at)}
                  </p>
                </div>

                {(message.role === 'user' || message.role === 'human') && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {getMessageIcon(message.role)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Message Input */}
      <MessageInput onSendMessage={handleSendMessage} disabled={sending} />
    </div>
  );
}