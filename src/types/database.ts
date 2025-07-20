export interface Organization {
  id: string;
  name: string;
  ai_paused: boolean;
  stripe_customer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  organization_id: string;
  whatsapp_number: string;
  full_name?: string;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  organization_id: string;
  contact_id: string;
  role: 'user' | 'agent' | 'human' | 'system';
  body?: string;
  twilio_sid?: string;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  organization_id: string;
  display_name?: string;
  created_at: string;
  updated_at: string;
}