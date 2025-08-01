import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Plus, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Calendar {
  id: string;
  name: string;
  description?: string;
  is_primary?: boolean;
  read_only?: boolean;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  when: {
    start_time: number;
    end_time: number;
  };
  location?: string;
}

interface NylasAccount {
  nylas_grant_id: string;
  email_address?: string;
  provider?: string;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<Calendar | null>(null);
  const [nylasAccount, setNylasAccount] = useState<NylasAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [isCreateEventOpen, setIsCreateEventOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    location: ''
  });

  useEffect(() => {
    if (user) {
      loadNylasAccount();
    }
  }, [user]);

  useEffect(() => {
    if (nylasAccount?.nylas_grant_id) {
      loadCalendars();
    }
  }, [nylasAccount]);

  const loadNylasAccount = async () => {
    try {
      const { data, error } = await supabase
        .from('nylas_accounts')
        .select('nylas_grant_id, email_address, provider')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        console.error('Error loading Nylas account:', error);
        return;
      }

      if (data && data.length > 0) {
        setNylasAccount(data[0]);
      }
    } catch (error) {
      console.error('Error loading Nylas account:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendars = async () => {
    if (!nylasAccount?.nylas_grant_id) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-calendars', {
        body: { grant_id: nylasAccount.nylas_grant_id }
      });

      if (error) {
        console.error('Error loading calendars:', error);
        toast({
          title: 'Fout',
          description: 'Kon kalenders niet laden',
          variant: 'destructive'
        });
        return;
      }

      setCalendars(data || []);
    } catch (error) {
      console.error('Error loading calendars:', error);
      toast({
        title: 'Fout',
        description: 'Kon kalenders niet laden',
        variant: 'destructive'
      });
    }
  };

  const loadEvents = async (calendar: Calendar) => {
    if (!nylasAccount?.nylas_grant_id) return;

    setSelectedCalendar(calendar);
    setEventsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('get-events', {
        body: { 
          grant_id: nylasAccount.nylas_grant_id,
          calendar_id: calendar.id
        }
      });

      if (error) {
        console.error('Error loading events:', error);
        toast({
          title: 'Fout',
          description: 'Kon events niet laden',
          variant: 'destructive'
        });
        return;
      }

      setEvents(data || []);
    } catch (error) {
      console.error('Error loading events:', error);
      toast({
        title: 'Fout',
        description: 'Kon events niet laden',
        variant: 'destructive'
      });
    } finally {
      setEventsLoading(false);
    }
  };

  const createEvent = async () => {
    if (!nylasAccount?.nylas_grant_id || !selectedCalendar) return;

    try {
      const eventData = {
        grant_id: nylasAccount.nylas_grant_id,
        calendar_id: selectedCalendar.id,
        title: newEvent.title,
        description: newEvent.description,
        when: {
          start_time: Math.floor(new Date(newEvent.start_time).getTime() / 1000),
          end_time: Math.floor(new Date(newEvent.end_time).getTime() / 1000)
        },
        location: newEvent.location || undefined
      };

      const { data, error } = await supabase.functions.invoke('create-event', {
        body: eventData
      });

      if (error) {
        console.error('Error creating event:', error);
        toast({
          title: 'Fout',
          description: 'Kon event niet aanmaken',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Success',
        description: 'Event succesvol aangemaakt'
      });

      setIsCreateEventOpen(false);
      setNewEvent({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        location: ''
      });
      
      // Reload events
      loadEvents(selectedCalendar);
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: 'Fout',
        description: 'Kon event niet aanmaken',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }

  if (!nylasAccount) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Kalender
            </CardTitle>
            <CardDescription>
              Je hebt nog geen kalender verbonden. Ga naar instellingen om je kalender te verbinden.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Kalender</h1>
          <p className="text-muted-foreground">
            Beheer je kalenders en events
          </p>
        </div>
        <Button onClick={loadCalendars} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Ververs
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendars */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Kalenders
            </CardTitle>
            <CardDescription>
              Verbonden account: {nylasAccount.email_address} ({nylasAccount.provider})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {calendars.map((calendar) => (
              <div
                key={calendar.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent ${
                  selectedCalendar?.id === calendar.id ? 'bg-accent' : ''
                }`}
                onClick={() => loadEvents(calendar)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{calendar.name}</h3>
                    {calendar.description && (
                      <p className="text-sm text-muted-foreground">{calendar.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {calendar.is_primary && (
                      <Badge variant="default" className="text-xs">
                        Primair
                      </Badge>
                    )}
                    {calendar.read_only && (
                      <Badge variant="secondary" className="text-xs">
                        Alleen lezen
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Events */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Events
                </CardTitle>
                <CardDescription>
                  {selectedCalendar ? `Events in ${selectedCalendar.name}` : 'Selecteer een kalender'}
                </CardDescription>
              </div>
              {selectedCalendar && !selectedCalendar.read_only && (
                <Dialog open={isCreateEventOpen} onOpenChange={setIsCreateEventOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Nieuw Event
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nieuw Event Aanmaken</DialogTitle>
                      <DialogDescription>
                        Maak een nieuw event aan in {selectedCalendar.name}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="title">Titel</Label>
                        <Input
                          id="title"
                          value={newEvent.title}
                          onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Event titel"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Beschrijving</Label>
                        <Textarea
                          id="description"
                          value={newEvent.description}
                          onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Event beschrijving"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="start_time">Start tijd</Label>
                          <Input
                            id="start_time"
                            type="datetime-local"
                            value={newEvent.start_time}
                            onChange={(e) => setNewEvent(prev => ({ ...prev, start_time: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="end_time">Eind tijd</Label>
                          <Input
                            id="end_time"
                            type="datetime-local"
                            value={newEvent.end_time}
                            onChange={(e) => setNewEvent(prev => ({ ...prev, end_time: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="location">Locatie</Label>
                        <Input
                          id="location"
                          value={newEvent.location}
                          onChange={(e) => setNewEvent(prev => ({ ...prev, location: e.target.value }))}
                          placeholder="Event locatie"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsCreateEventOpen(false)}>
                          Annuleren
                        </Button>
                        <Button onClick={createEvent} disabled={!newEvent.title || !newEvent.start_time || !newEvent.end_time}>
                          Event Aanmaken
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="flex justify-center py-8">
                <div className="text-muted-foreground">Events laden...</div>
              </div>
            ) : !selectedCalendar ? (
              <div className="text-center py-8 text-muted-foreground">
                Selecteer een kalender om events te bekijken
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Geen events gevonden in deze kalender
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="p-3 rounded-lg border">
                    <h3 className="font-medium">{event.title}</h3>
                    {event.description && (
                      <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span>
                        {new Date(event.when.start_time * 1000).toLocaleString('nl-NL')}
                      </span>
                      <span>→</span>
                      <span>
                        {new Date(event.when.end_time * 1000).toLocaleString('nl-NL')}
                      </span>
                    </div>
                    {event.location && (
                      <p className="text-sm text-muted-foreground mt-1">📍 {event.location}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}