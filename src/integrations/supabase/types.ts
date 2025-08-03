export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      contacts: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          last_message_at: string | null
          organization_id: string
          updated_at: string | null
          whatsapp_number: string
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          last_message_at?: string | null
          organization_id: string
          updated_at?: string | null
          whatsapp_number: string
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          last_message_at?: string | null
          organization_id?: string
          updated_at?: string | null
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          body: string | null
          created_at: string
          from_address: string
          id: string
          is_read: boolean | null
          nylas_message_id: string
          organization_id: string
          received_at: string
          subject: string | null
          to_address: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          from_address: string
          id?: string
          is_read?: boolean | null
          nylas_message_id: string
          organization_id: string
          received_at: string
          subject?: string | null
          to_address: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          from_address?: string
          id?: string
          is_read?: boolean | null
          nylas_message_id?: string
          organization_id?: string
          received_at?: string
          subject?: string | null
          to_address?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string | null
          contact_id: string
          created_at: string | null
          id: number
          organization_id: string
          role: Database["public"]["Enums"]["role_enum"]
          twilio_sid: string | null
          twilio_status: string | null
        }
        Insert: {
          body?: string | null
          contact_id: string
          created_at?: string | null
          id?: number
          organization_id: string
          role: Database["public"]["Enums"]["role_enum"]
          twilio_sid?: string | null
          twilio_status?: string | null
        }
        Update: {
          body?: string | null
          contact_id?: string
          created_at?: string | null
          id?: number
          organization_id?: string
          role?: Database["public"]["Enums"]["role_enum"]
          twilio_sid?: string | null
          twilio_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      nylas_accounts: {
        Row: {
          access_token: string | null
          connected_at: string | null
          created_at: string
          email_address: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          nylas_grant_id: string | null
          organization_id: string
          provider: string | null
          provider_email_address: string | null
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string
          email_address?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          nylas_grant_id?: string | null
          organization_id: string
          provider?: string | null
          provider_email_address?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          created_at?: string
          email_address?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          nylas_grant_id?: string | null
          organization_id?: string
          provider?: string | null
          provider_email_address?: string | null
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          created_at: string | null
          state: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          state: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          state?: string
          user_id?: string | null
        }
        Relationships: []
      }
      organization_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          organization_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          organization_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_users: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          ai_paused: boolean | null
          created_at: string | null
          id: string
          name: string
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          ai_paused?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_paused?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          default_calendar_id: string | null
          display_name: string | null
          google_access_token: string | null
          google_refresh_token: string | null
          id: string
          microsoft_access_token: string | null
          microsoft_refresh_token: string | null
          nylas_connected: boolean | null
          nylas_grant_id: string | null
          organization_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          default_calendar_id?: string | null
          display_name?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          id?: string
          microsoft_access_token?: string | null
          microsoft_refresh_token?: string | null
          nylas_connected?: boolean | null
          nylas_grant_id?: string | null
          organization_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          default_calendar_id?: string | null
          display_name?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          id?: string
          microsoft_access_token?: string | null
          microsoft_refresh_token?: string | null
          nylas_connected?: boolean | null
          nylas_grant_id?: string | null
          organization_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      role_enum: "user" | "agent" | "human" | "system"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      role_enum: ["user", "agent", "human", "system"],
    },
  },
} as const
