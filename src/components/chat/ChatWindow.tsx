import { useState, useEffect } from 'react';
import { Bot, Pause, Play } from 'lucide-react';
import { Contact, Message } from '@/types/database';
import { MessageInput } from './MessageInput';
import MessageList from './MessageList';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAiPause } from '@/hooks/useAiPause';
import { Button } from '@/components/ui/button';

interface ChatWindowProps {
  contact: Contact;
  overrideMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
}

export function ChatWindow({ contact, overrideMessages, onMessagesChange }: ChatWindowProps) {
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const { toast } = useToast();
  const { aiPaused, toggleAiPause } = useAiPause();
  
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
        onMessagesChange?.(newMessages);
        setPage(1);
      } else {
        const updatedMessages = [...newMessages, ...messages];
        setMessages(updatedMessages);
        onMessagesChange?.(updatedMessages);
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
          const newMessages = [...messages, payload.new as Message];
          setMessages(newMessages);
          onMessagesChange?.(newMessages);
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
    <div className="flex flex-col h-full">
      {/* Navigation Bar */}
      <nav className="flex items-center justify-between bg-background border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{contact.full_name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            aiPaused 
              ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' 
              : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
          }`}>
            {aiPaused ? 'AI Gepauzeerd' : 'AI Actief'}
          </div>
          <Button
            onClick={toggleAiPause}
            variant={aiPaused ? "default" : "outline"}
            size="sm"
            className="flex items-center gap-2"
          >
            {aiPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {aiPaused ? "Activeren" : "Pauzeren"}
          </Button>
        </div>
      </nav>

      {/* Messages */}
      {(overrideMessages || messages).length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nog geen berichten</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <MessageList 
            messages={overrideMessages || messages} 
            onLoadMore={() => loadMessages(false)}
            hasMore={hasMore}
          />
        </div>
      )}

      {/* Message Input */}
      <MessageInput onSendMessage={handleSendMessage} disabled={sending} />
    </div>
  );
}