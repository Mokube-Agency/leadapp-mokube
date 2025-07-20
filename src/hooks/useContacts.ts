import { useSupabaseRealtime } from './useSupabaseRealtime';
import { Contact } from '@/types/database';

export function useContacts() {
  return useSupabaseRealtime<Contact>('contacts', undefined, 'last_message_at.desc');
}