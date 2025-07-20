import { useState } from 'react';
import { ContactsList } from '@/components/chat/ContactsList';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { Contact } from '@/types/database';
import { MessageSquare } from 'lucide-react';

export default function Chat() {
  const [activeContact, setActiveContact] = useState<Contact | null>(null);

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