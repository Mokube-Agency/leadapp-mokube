import { useState, useEffect } from 'react';
import { Bot } from 'lucide-react';
import { Contact, Message } from '@/types/database';
import { MessageInput } from './MessageInput';
import MessageList from './MessageList';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChatWindowProps {
  contact: Contact;
}

export function ChatWindow({ contact }: ChatWindowProps) {
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const { toast } = useToast();
  
  const PAGE_SIZE = 50;

  // Load messages with pagination
  const loadMessages = async (initial = false) => {
    const currentPage = initial ? 0 : page;
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    if (data) {
      const newMessages = data.reverse(); // Reverse to show oldest first
      if (initial) {
        setMessages(newMessages);
        setPage(1);
      } else {
        setMessages(prev => [...newMessages, ...prev]);
        setPage(prev => prev + 1);
      }
      
      setHasMore(data.length === PAGE_SIZE);
    }
  };

  // Initial load
  useEffect(() => {
    if (contact.id) {
      loadMessages(true);
    }
  }, [contact.id]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!contact.id) return;
    
    const channel = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        { 
          event: "INSERT", 
          schema: "public", 
          table: "messages", 
          filter: `contact_id=eq.${contact.id}` 
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contact.id]);

  const handleSendMessage = async (message: string) => {
    setSending(true);
    try {
      const response = await supabase.functions.invoke('send-human-message', {
        body: { contact_id: contact.id, text: message }
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
      </div>

      {/* Messages */}
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nog geen berichten</p>
          </div>
        </div>
      ) : (
        <MessageList 
          messages={messages} 
          onLoadMore={() => loadMessages(false)}
          hasMore={hasMore}
        />
      )}

      {/* Message Input */}
      <MessageInput onSendMessage={handleSendMessage} disabled={sending} />
    </div>
  );
}