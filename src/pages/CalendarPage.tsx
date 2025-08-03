import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Plus, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import dayjs from 'dayjs';
import weekday from 'dayjs/plugin/weekday';
import isoWeek from 'dayjs/plugin/isoWeek';
import localeData from 'dayjs/plugin/localeData';
import 'dayjs/locale/nl';

dayjs.extend(weekday);
dayjs.extend(isoWeek);
dayjs.extend(localeData);
dayjs.locale('nl');

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
  const [nylasAccount, setNylasAccount] = useState<NylasAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(dayjs());
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [newEventStartTime, setNewEventStartTime] = useState('09:00');
  const [newEventEndTime, setNewEventEndTime] = useState('10:00');
  const [selectedCalendarId, setSelectedCalendarId] = useState('');

  useEffect(() => {
    if (user) {
      loadNylasAccount();
    }
  }, [user]);

  const loadCalendars = async (grantId: string) => {
    try {
      console.log('🔍 [CalendarPage] Loading calendars for grant:', grantId);
      
      const response = await supabase.functions.invoke('get-calendars', {
        body: { grant_id: grantId }
      });
      
      if (response.error) {
        console.error('Error loading calendars:', response.error);
        return;
      }
      
      console.log('✅ [CalendarPage] Calendars loaded:', response.data);
      setCalendars(response.data || []);
      
      // Set first calendar as default selection
      if (response.data && response.data.length > 0) {
        setSelectedCalendarId(response.data[0].id);
      }
    } catch (error) {
      console.error('Error loading calendars:', error);
    }
  };

  useEffect(() => {
    if (nylasAccount) {
      loadCalendarEvents();
    }
  }, [nylasAccount, currentWeek]);

  const loadNylasAccount = async () => {
    try {
      console.log('🔍 [CalendarPage] Checking Nylas account for user:', user?.id);
      
      const { data, error } = await supabase
        .from('nylas_accounts')
        .select('nylas_grant_id, email_address, provider')
        .eq('user_id', user?.id)
        .eq('is_active', true)
        .single();

      console.log('🔍 [CalendarPage] Nylas account data:', data);
      console.log('🔍 [CalendarPage] Nylas account error:', error);

      if (error) {
        console.error('Error loading Nylas account:', error);
        return;
      }

      if (data?.nylas_grant_id) {
        console.log('✅ [CalendarPage] Found Nylas account');
        setNylasAccount(data);
        loadCalendars(data.nylas_grant_id);
      } else {
        console.log('❌ [CalendarPage] No Nylas account found');
      }
    } catch (error) {
      console.error('Error loading Nylas account:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCalendarEvents = async () => {
    if (!user || !nylasAccount) {
      console.log('📅 [CalendarPage] No user or Nylas account available for loading events');
      return;
    }

    console.log('📅 [CalendarPage] Starting calendar events load for user:', user.id);
    setEventsLoading(true);

    try {
      console.log('📅 [CalendarPage] Calling get-events edge function...');
      
      const response = await supabase.functions.invoke('get-events', {
        body: { grant_id: nylasAccount.nylas_grant_id }
      });
      
      console.log('📅 [CalendarPage] Edge function response received:', {
        error: response.error,
        data: response.data,
        hasData: !!response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'not array'
      });
      
      if (response.error) {
        console.error('📅 [CalendarPage] Edge function error:', response.error);
        
        let errorMessage = 'Kon kalender events niet laden';
        if (response.error.message) {
          errorMessage = response.error.message;
        } else if (typeof response.error === 'string') {
          errorMessage = response.error;
        }
        
        toast({
          title: 'Kalender fout',
          description: errorMessage,
          variant: 'destructive'
        });
        return;
      }
      
      if (!response.data) {
        console.warn('📅 [CalendarPage] No data received from edge function');
        setEvents([]);
        return;
      }
      
      console.log('📅 [CalendarPage] Raw Nylas calendar events:', response.data);
      
      // Transform Nylas events to our format
      const transformedEvents = (Array.isArray(response.data) ? response.data : []).map((event: any, index: number) => {
        console.log(`📅 [CalendarPage] Transforming event ${index}:`, event);
        
        return {
          id: event.id || `event-${index}`,
          title: event.title || 'Geen titel',
          description: event.description,
          when: {
            start_time: event.when?.start_time || Date.now() / 1000,
            end_time: event.when?.end_time || (Date.now() / 1000) + 3600
          },
          location: event.location
        };
      });
      
      console.log('📅 [CalendarPage] Final transformed events:', transformedEvents);
      setEvents(transformedEvents);
      
      toast({
        title: 'Kalender geladen',
        description: `${transformedEvents.length} agenda item(s) geladen`
      });
      
    } catch (error) {
      console.error('📅 [CalendarPage] Unexpected error during fetch:', error);
      toast({
        title: 'Onverwachte fout',
        description: `Er ging iets mis: ${error.message}`,
        variant: 'destructive'
      });
    } finally {
      console.log('📅 [CalendarPage] Finished loading calendar events');
      setEventsLoading(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => 
      direction === 'prev' ? prev.subtract(1, 'week') : prev.add(1, 'week')
    );
  };

  const getEventsForTimeSlot = (day: dayjs.Dayjs, hour: number) => {
    return events.filter(event => {
      const eventStart = dayjs(event.when.start_time * 1000);
      const eventEnd = dayjs(event.when.end_time * 1000);
      const slotStart = day.hour(hour).minute(0);
      const slotEnd = day.hour(hour).minute(59);
      
      return eventStart.isSame(day, 'day') && 
             ((eventStart.hour() === hour) || 
              (eventStart.isBefore(slotStart) && eventEnd.isAfter(slotStart)));
    });
  };

  const handleCreateEvent = async () => {
    if (!user || !selectedCalendarId || !newEventTitle) {
      toast({
        title: 'Fout',
        description: 'Vul alle velden in',
        variant: 'destructive'
      });
      return;
    }

    try {
      const startDateTime = dayjs(`${newEventDate}T${newEventStartTime}`);
      const endDateTime = dayjs(`${newEventDate}T${newEventEndTime}`);

      const { data, error } = await supabase.functions.invoke('create-event', {
        body: {
          user_id: user.id,
          calendar_id: selectedCalendarId,
          title: newEventTitle,
          start_time: startDateTime.unix(),
          end_time: endDateTime.unix()
        }
      });

      if (error) {
        toast({
          title: 'Fout',
          description: 'Kon afspraak niet aanmaken',
          variant: 'destructive'
        });
        return;
      }

      toast({
        title: 'Succes',
        description: 'Afspraak is aangemaakt'
      });

      // Reset form
      setNewEventTitle('');
      setNewEventDate(dayjs().format('YYYY-MM-DD'));
      setNewEventStartTime('09:00');
      setNewEventEndTime('10:00');
      setSelectedCalendarId('');
      setShowModal(false);

      // Refresh events
      loadCalendarEvents();
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: 'Fout',
        description: 'Kon afspraak niet aanmaken',
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
              Je hebt nog geen Nylas kalender verbonden. Ga naar instellingen om je kalender te verbinden.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Build week grid data
  const days = Array.from({ length: 7 }, (_, i) =>
    currentWeek.startOf('isoWeek').add(i, 'day')
  );
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Weekoverzicht</h1>
          <p className="text-muted-foreground">
            {currentWeek.startOf('isoWeek').format('D MMM')} - {currentWeek.endOf('isoWeek').format('D MMM YYYY')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showModal} onOpenChange={setShowModal}>
            <DialogTrigger asChild>
              <Button variant="default" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Afspraak toevoegen
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Nieuwe afspraak</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="title">Titel</Label>
                  <Input
                    id="title"
                    value={newEventTitle}
                    onChange={(e) => setNewEventTitle(e.target.value)}
                    placeholder="Titel van de afspraak"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="date">Datum</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-2">
                    <Label htmlFor="start-time">Starttijd</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={newEventStartTime}
                      onChange={(e) => setNewEventStartTime(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="end-time">Eindtijd</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={newEventEndTime}
                      onChange={(e) => setNewEventEndTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="calendar">Kalender</Label>
                  <Select value={selectedCalendarId} onValueChange={setSelectedCalendarId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer een kalender" />
                    </SelectTrigger>
                    <SelectContent>
                      {calendars.map((calendar) => (
                        <SelectItem key={calendar.id} value={calendar.id}>
                          {calendar.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowModal(false)}>
                    Annuleren
                  </Button>
                  <Button onClick={handleCreateEvent}>
                    Aanmaken
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={() => navigateWeek('prev')} variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button onClick={() => setCurrentWeek(dayjs())} variant="outline" size="sm">
            Vandaag
          </Button>
          <Button onClick={() => navigateWeek('next')} variant="outline" size="sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={loadCalendarEvents} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Ververs
          </Button>
        </div>
      </div>

      {eventsLoading ? (
        <div className="flex justify-center py-8">
          <div className="text-muted-foreground">Events laden...</div>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="h-[600px] overflow-auto">
              <div className="grid grid-cols-8 min-w-[800px]">
                {/* Header row */}
                <div className="p-2 border-b border-r text-sm font-medium bg-background sticky top-0 z-20"></div>
                {days.map(day => (
                  <div 
                    key={day.format('YYYY-MM-DD')} 
                    className={`p-2 border-b border-r text-center text-sm font-medium bg-background sticky top-0 z-20 ${
                      day.isSame(dayjs(), 'day') ? 'bg-primary/5 text-primary' : ''
                    }`}
                  >
                    <div>{day.format('ddd')}</div>
                    <div className="text-lg">{day.format('D')}</div>
                  </div>
                ))}
                
                {/* Time slots */}
                {hours.map(hour => (
                  <div key={hour} className="contents">
                    <div className="p-2 border-b border-r text-right text-xs text-muted-foreground font-medium bg-background sticky left-0 z-10">
                      {hour.toString().padStart(2, '0')}:00
                    </div>
                    {days.map(day => {
                      const eventsInSlot = getEventsForTimeSlot(day, hour);
                      return (
                        <div 
                          key={`${day.format('YYYY-MM-DD')}-${hour}`} 
                          className="p-1 border-b border-r min-h-[60px] relative"
                        >
                          {eventsInSlot.map((event, index) => {
                            const eventStart = dayjs(event.when.start_time * 1000);
                            const eventEnd = dayjs(event.when.end_time * 1000);
                            const duration = eventEnd.diff(eventStart, 'hour', true);
                            const height = Math.max(duration * 60, 20); // Minimum 20px height
                            
                            return (
                              <div
                                key={`${event.id}-${index}`}
                                className="absolute left-1 right-1 bg-primary/10 border border-primary/20 rounded px-1 py-0.5 text-xs z-10"
                                style={{
                                  height: `${height}px`,
                                  top: `${(eventStart.minute() / 60) * 60}px`
                                }}
                                title={`${event.title}\n${eventStart.format('HH:mm')} - ${eventEnd.format('HH:mm')}`}
                              >
                                <div className="font-medium truncate">{event.title}</div>
                                <div className="text-muted-foreground truncate">
                                  {eventStart.format('HH:mm')} - {eventEnd.format('HH:mm')}
                                </div>
                                {event.location && (
                                  <div className="text-muted-foreground truncate">📍 {event.location}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}