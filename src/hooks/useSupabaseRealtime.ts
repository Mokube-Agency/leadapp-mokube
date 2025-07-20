import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useSupabaseRealtime<T extends { id: string | number }>(
  table: string,
  filter?: string,
  orderBy?: string
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let query = supabase.from(table as any).select('*');
    
    if (filter) {
      const [column, operator, value] = filter.split('.');
      if (operator === 'eq') {
        query = query.eq(column, value);
      }
    }

    if (orderBy) {
      const [column, direction] = orderBy.split('.');
      query = query.order(column, { ascending: direction === 'asc' });
    }

    // Initial fetch
    const fetchData = async () => {
      try {
        const { data: initialData, error: fetchError } = await query;
        if (fetchError) throw fetchError;
        setData((initialData as any) || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscription
    const channel = supabase
      .channel(`public:${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
        },
        (payload) => {
          console.log('Realtime update:', payload);
          
          if (payload.eventType === 'INSERT') {
            setData(current => [...current, payload.new as T]);
          } else if (payload.eventType === 'UPDATE') {
            setData(current => 
              current.map(item => 
                item.id === payload.new.id ? payload.new as T : item
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setData(current => 
              current.filter(item => item.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, orderBy]);

  return { data, loading, error, refetch: () => window.location.reload() };
}