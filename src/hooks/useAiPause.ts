import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useAiPause() {
  const [aiPaused, setAiPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Fetch current AI pause status
  useEffect(() => {
    const fetchAiStatus = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        if (profile) {
          const { data: org } = await supabase
            .from('organizations')
            .select('ai_paused')
            .eq('id', profile.organization_id)
            .single();

          setAiPaused(org?.ai_paused || false);
        }
      } catch (error) {
        console.error('Error fetching AI status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAiStatus();
  }, []);

  const toggleAiPause = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('toggle-ai-pause');
      
      if (error) throw error;
      
      setAiPaused(data.ai_paused);
      toast({
        title: "AI Status Bijgewerkt",
        description: data.message,
      });
    } catch (error) {
      console.error('Error toggling AI pause:', error);
      toast({
        title: "Fout",
        description: "Kon AI status niet wijzigen",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return { aiPaused, loading, toggleAiPause };
}