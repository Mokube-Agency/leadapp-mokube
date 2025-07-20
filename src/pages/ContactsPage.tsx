import { useState } from 'react';
import { useContacts } from '@/hooks/useContacts';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Contact } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Plus, Search } from 'lucide-react';

export default function ContactsPage() {
  const { data: contacts, loading } = useContacts();
  const { user } = useAuth();
  const { toast } = useToast();
  const [active, setActive] = useState<Contact | null>(null);
  const [isNewContact, setIsNewContact] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    whatsapp_number: '',
  });

  const filteredContacts = contacts?.filter(contact => 
    contact.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.whatsapp_number.includes(searchTerm)
  ) || [];

  const handleNewContact = () => {
    setFormData({ full_name: '', whatsapp_number: '' });
    setIsNewContact(true);
    setActive({} as Contact);
  };

  const handleEditContact = (contact: Contact) => {
    setFormData({
      full_name: contact.full_name || '',
      whatsapp_number: contact.whatsapp_number,
    });
    setIsNewContact(false);
    setActive(contact);
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      if (isNewContact) {
        const { error } = await supabase
          .from('contacts')
          .insert(formData);

        if (error) throw error;
        
        toast({
          title: 'Contact toegevoegd',
          description: 'Het contact is succesvol toegevoegd',
        });
      } else {
        const { error } = await supabase
          .from('contacts')
          .update(formData)
          .eq('id', active?.id);

        if (error) throw error;
        
        toast({
          title: 'Contact bijgewerkt',
          description: 'Het contact is succesvol bijgewerkt',
        });
      }
      
      setActive(null);
    } catch (error) {
      toast({
        title: 'Fout',
        description: 'Er is een fout opgetreden',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b flex items-center gap-3">
        <h2 className="text-lg font-semibold flex-1">Contacten</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek contacten..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-64"
          />
        </div>
        <Button onClick={handleNewContact}>
          <Plus className="h-4 w-4 mr-2" />
          Nieuw contact
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {filteredContacts.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {contacts?.length === 0 ? 'Nog geen contacten' : 'Geen contacten gevonden'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredContacts.map(contact => (
              <div
                key={contact.id}
                className="p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleEditContact(contact)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium">
                      {contact.full_name || 'Onbekend'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {contact.whatsapp_number}
                    </p>
                  </div>
                  <div className="text-right">
                    {contact.last_message_at ? (
                      <Badge variant="secondary" className="text-xs">
                        {formatDistanceToNow(new Date(contact.last_message_at), { 
                          addSuffix: true, 
                          locale: nl 
                        })}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Nog geen berichten
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!active} onOpenChange={() => setActive(null)}>
        <SheetContent side="right" className="w-[26rem]">
          <SheetHeader>
            <SheetTitle>
              {isNewContact ? 'Nieuw contact' : 'Contact bewerken'}
            </SheetTitle>
          </SheetHeader>
          
          <div className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="full_name">Volledige naam</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Voer volledige naam in"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="whatsapp_number">WhatsApp nummer</Label>
              <Input
                id="whatsapp_number"
                value={formData.whatsapp_number}
                onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_number: e.target.value }))}
                placeholder="whatsapp:+31612345678"
              />
            </div>
            
            <Button onClick={handleSave} className="w-full">
              {isNewContact ? 'Contact toevoegen' : 'Wijzigingen opslaan'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}