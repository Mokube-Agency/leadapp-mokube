import { useState, useEffect } from 'react';
import { ContactsList } from '@/components/chat/ContactsList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Contact } from '@/types/database';
import { MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Chat() {
  const [activeContact, setActiveContact] = useState<Contact | null>(null);

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

  return (
    <div className="h-screen flex">
      <ContactsList
        activeContactId={activeContact?.id}
        onSelectContact={setActiveContact}
      />
      
      {activeContact ? (
        <ChatWindow contact={activeContact} />
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