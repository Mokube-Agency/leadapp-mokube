import { useState } from 'react';
import { Search, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSupabaseRealtime } from '@/hooks/useSupabaseRealtime';
import { Contact } from '@/types/database';
import { cn } from '@/lib/utils';

interface ContactsListProps {
  activeContactId?: string;
  onSelectContact: (contact: Contact) => void;
}

export function ContactsList({ activeContactId, onSelectContact }: ContactsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: contacts, loading } = useSupabaseRealtime<Contact>(
    'contacts',
    undefined,
    'last_message_at.desc'
  );

  const filteredContacts = contacts.filter(contact =>
    contact.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.whatsapp_number.includes(searchTerm)
  );

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString('nl-NL', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' });
    }
  };

  if (loading) {
    return (
      <aside className="w-80 border-r bg-muted/30 flex items-center justify-center">
        <div className="text-muted-foreground">Contacten laden...</div>
      </aside>
    );
  }

  return (
    <aside className="w-80 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-3">Chatgesprekken</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek contacten..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        {filteredContacts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nog geen contacten</p>
          </div>
        ) : (
          <div className="p-2">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => onSelectContact(contact)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent",
                  activeContactId === contact.id && "bg-accent"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium truncate">
                      {contact.full_name || contact.whatsapp_number.replace('whatsapp:', '')}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(contact.last_message_at)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {contact.whatsapp_number.replace('whatsapp:', '')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}