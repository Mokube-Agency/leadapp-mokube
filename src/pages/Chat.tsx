import { useState, useEffect, useMemo } from 'react';
import { ContactsList } from '@/components/chat/ContactsList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Contact, Message } from '@/types/database';
import { MessageSquare, ArrowUpDown, ArrowDownUp, SortAsc, SortDesc, Trash2, Pause, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAiPause } from '@/hooks/useAiPause';

export default function Chat() {
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sortBy, setSortBy] = useState<'time-asc' | 'time-desc' | 'alpha-asc' | 'alpha-desc'>('time-desc');
  const { toast } = useToast();
  const { aiPaused, toggleAiPause } = useAiPause();

  // Sorted messages based on selected sort option
  const sortedMessages = useMemo(() => {
    const arr = [...messages];
    switch (sortBy) {
      case 'time-asc':
        return arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'time-desc':
        return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'alpha-asc':
        return arr.sort((a, b) => (a.body || '').localeCompare(b.body || ''));
      case 'alpha-desc':
        return arr.sort((a, b) => (b.body || '').localeCompare(a.body || ''));
      default:
        return arr;
    }
  }, [messages, sortBy]);

  // Auto-select most recent contact if none is selected
  useEffect(() => {
    if (!activeContact) {
      const loadMostRecentContact = async () => {
        const { data } = await supabase
          .from("contacts")
          .select("*")
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (data) {
          setActiveContact(data);
        }
      };
      
      loadMostRecentContact();
    }
  }, [activeContact]);

  // Delete conversation function
  const handleDeleteConversation = async () => {
    if (!activeContact) return;
    
    try {
      const { error } = await supabase.functions.invoke('delete-conversation', {
        body: { contact_id: activeContact.id }
      });

      if (error) throw error;

      setMessages([]);
      toast({
        title: "Gesprek verwijderd",
        description: "Het gesprek is succesvol verwijderd",
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Fout",
        description: "Kon het gesprek niet verwijderen",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-screen flex">
      <ContactsList
        activeContactId={activeContact?.id}
        onSelectContact={setActiveContact}
      />
      
      {activeContact ? (
        <div className="flex-1 flex flex-col">
          {/* AI Status Block */}
          <div className="p-4 border-b bg-muted/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {activeContact.full_name?.charAt(0)?.toUpperCase() || activeContact.whatsapp_number.slice(-2)}
                  </span>
                </div>
                <div>
                  <h3 className="font-medium">{activeContact.full_name || activeContact.whatsapp_number}</h3>
                  <p className="text-sm text-muted-foreground">{activeContact.whatsapp_number}</p>
                </div>
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
            </div>
          </div>

          {/* Sort and Action Controls */}
          <div className="flex gap-2 p-4 border-b bg-background">
            <Button
              onClick={() => setSortBy('time-desc')}
              variant={sortBy === 'time-desc' ? 'default' : 'outline'}
              size="sm"
            >
              <ArrowDownUp className="h-4 w-4 mr-1" />
              Nieuw→Oud
            </Button>
            <Button
              onClick={() => setSortBy('time-asc')}
              variant={sortBy === 'time-asc' ? 'default' : 'outline'}
              size="sm"
            >
              <ArrowUpDown className="h-4 w-4 mr-1" />
              Oud→Nieuw
            </Button>
            <Button
              onClick={() => setSortBy('alpha-asc')}
              variant={sortBy === 'alpha-asc' ? 'default' : 'outline'}
              size="sm"
            >
              <SortAsc className="h-4 w-4 mr-1" />
              A→Z
            </Button>
            <Button
              onClick={() => setSortBy('alpha-desc')}
              variant={sortBy === 'alpha-desc' ? 'default' : 'outline'}
              size="sm"
            >
              <SortDesc className="h-4 w-4 mr-1" />
              Z→A
            </Button>
            <Button
              onClick={handleDeleteConversation}
              variant="destructive"
              size="sm"
              className="ml-auto"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Verwijder gesprek
            </Button>
          </div>

          <ChatWindow contact={activeContact} overrideMessages={sortedMessages} onMessagesChange={setMessages} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-muted/10">
          <div className="text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">Selecteer een gesprek</h3>
            <p>Kies een contact uit de lijst om te beginnen met chatten</p>
          </div>
        </div>
      )}
    </div>
  );
}