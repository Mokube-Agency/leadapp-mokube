import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

  useEffect(() => {
    if (calendars.length > 0) {
      loadWeekEvents();
    }
  }, [calendars, currentWeek]);

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

  const loadWeekEvents = async () => {
    if (!nylasAccount?.nylas_grant_id || calendars.length === 0) return;

    setEventsLoading(true);

    try {
      const startOfWeek = currentWeek.startOf('isoWeek').unix();
      const endOfWeek = currentWeek.endOf('isoWeek').unix();
      
      // Load events from all calendars
      const allEvents: Event[] = [];
      
      for (const calendar of calendars) {
        try {
          const { data, error } = await supabase.functions.invoke('get-events', {
            body: { 
              grant_id: nylasAccount.nylas_grant_id,
              calendar_id: calendar.id,
              starts_after: startOfWeek,
              ends_before: endOfWeek
            }
          });

          if (!error && data) {
            allEvents.push(...data);
          }
        } catch (error) {
          console.error(`Error loading events for calendar ${calendar.id}:`, error);
        }
      }

      setEvents(allEvents);
    } catch (error) {
      console.error('Error loading week events:', error);
      toast({
        title: 'Fout',
        description: 'Kon events niet laden',
        variant: 'destructive'
      });
    } finally {
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
          <Button onClick={() => navigateWeek('prev')} variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button onClick={() => setCurrentWeek(dayjs())} variant="outline" size="sm">
            Vandaag
          </Button>
          <Button onClick={() => navigateWeek('next')} variant="outline" size="sm">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button onClick={loadWeekEvents} variant="outline" size="sm">
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

      {/* Calendar info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Verbonden Kalenders ({calendars.length})
          </CardTitle>
          {nylasAccount && (
            <CardDescription>
              Account: {nylasAccount.email_address} ({nylasAccount.provider})
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {calendars.map((calendar) => (
              <Badge 
                key={calendar.id} 
                variant={calendar.is_primary ? "default" : "secondary"}
                className="text-xs"
              >
                {calendar.name}
                {calendar.is_primary && " (Primair)"}
                {calendar.read_only && " (Alleen lezen)"}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}