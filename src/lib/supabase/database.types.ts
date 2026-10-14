export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          changed_at: string;
          changed_by: string | null;
          id: number;
          new_values: Json | null;
          old_values: Json | null;
          record_id: string;
          table_name: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          changed_at?: string;
          changed_by?: string | null;
          id?: never;
          new_values?: Json | null;
          old_values?: Json | null;
          record_id: string;
          table_name: string;
        };
        Update: {
          action?: string;
          changed_at?: string;
          changed_by?: string | null;
          id?: never;
          new_values?: Json | null;
          old_values?: Json | null;
          record_id?: string;
          table_name?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          cancel_reason: string;
          cancelled_at: string | null;
          checked_in_at: string | null;
          checked_in_by: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          customer_id: string;
          deposit_pence: number | null;
          event_id: string;
          id: string;
          notes: string;
          payment_notes: string;
          price_note: string;
          price_pence: number;
          reference: string;
          room_id: string | null;
          source: string;
          ticket_type_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cancel_reason?: string;
          cancelled_at?: string | null;
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          customer_id: string;
          deposit_pence?: number | null;
          event_id: string;
          id?: string;
          notes?: string;
          payment_notes?: string;
          price_note?: string;
          price_pence: number;
          reference?: string;
          room_id?: string | null;
          source?: string;
          ticket_type_id?: string | null;
          updated_at?: string;
        };
        Update: {
          cancel_reason?: string;
          cancelled_at?: string | null;
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          customer_id?: string;
          deposit_pence?: number | null;
          event_id?: string;
          id?: string;
          notes?: string;
          payment_notes?: string;
          price_note?: string;
          price_pence?: number;
          reference?: string;
          room_id?: string | null;
          source?: string;
          ticket_type_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_option_same_event";
            columns: ["ticket_type_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "ticket_types";
            referencedColumns: ["id", "event_id"];
          },
          {
            foreignKeyName: "bookings_room_same_event";
            columns: ["room_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "event_rooms";
            referencedColumns: ["id", "event_id"];
          },
        ];
      };
      customers: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          dietary_health: string;
          email: string | null;
          emergency_contact: string;
          full_name: string;
          id: string;
          is_team: boolean;
          notes: string;
          phone: string;
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          dietary_health?: string;
          email?: string | null;
          emergency_contact?: string;
          full_name: string;
          id?: string;
          is_team?: boolean;
          notes?: string;
          phone?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          dietary_health?: string;
          email?: string | null;
          emergency_contact?: string;
          full_name?: string;
          id?: string;
          is_team?: boolean;
          notes?: string;
          phone?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      email_log: {
        Row: {
          attachments: string[];
          body: string;
          booking_id: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          error: string;
          id: string;
          note: string;
          outside_system: boolean;
          provider_message_id: string | null;
          sent_at: string | null;
          sent_on: string | null;
          status: string;
          subject: string;
          template: string;
          to_email: string;
        };
        ComputedFields: never;
        Insert: {
          attachments?: string[];
          body?: string;
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          error?: string;
          id?: string;
          note?: string;
          outside_system?: boolean;
          provider_message_id?: string | null;
          sent_at?: string | null;
          sent_on?: string | null;
          status?: string;
          subject?: string;
          template: string;
          to_email?: string;
        };
        Update: {
          attachments?: string[];
          body?: string;
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          error?: string;
          id?: string;
          note?: string;
          outside_system?: boolean;
          provider_message_id?: string | null;
          sent_at?: string | null;
          sent_on?: string | null;
          status?: string;
          subject?: string;
          template?: string;
          to_email?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_log_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_log_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      email_templates: {
        Row: {
          attach_booking_details: boolean;
          attach_confirmation: boolean;
          attach_terms: boolean;
          body: string;
          created_at: string;
          description: string;
          id: string;
          key: string;
          name: string;
          sort_order: number;
          subject: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          attach_booking_details?: boolean;
          attach_confirmation?: boolean;
          attach_terms?: boolean;
          body: string;
          created_at?: string;
          description?: string;
          id?: string;
          key: string;
          name: string;
          sort_order?: number;
          subject: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          attach_booking_details?: boolean;
          attach_confirmation?: boolean;
          attach_terms?: boolean;
          body?: string;
          created_at?: string;
          description?: string;
          id?: string;
          key?: string;
          name?: string;
          sort_order?: number;
          subject?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      event_costs: {
        Row: {
          amount_pence: number;
          category: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          deleted_at: string | null;
          description: string;
          event_id: string;
          id: string;
          notes: string;
          paid: boolean;
          sort_order: number;
          supplier: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_pence: number;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          description?: string;
          event_id: string;
          id?: string;
          notes?: string;
          paid?: boolean;
          sort_order?: number;
          supplier?: string;
          updated_at?: string;
        };
        Update: {
          amount_pence?: number;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          description?: string;
          event_id?: string;
          id?: string;
          notes?: string;
          paid?: boolean;
          sort_order?: number;
          supplier?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_costs_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_rooms: {
        Row: {
          capacity: number | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          event_id: string;
          id: string;
          name: string;
          notes: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          capacity?: number | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          event_id: string;
          id?: string;
          name: string;
          notes?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          capacity?: number | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          event_id?: string;
          id?: string;
          name?: string;
          notes?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_rooms_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          balance_due_on: string;
          booking_closes_at: string | null;
          booking_opens_at: string | null;
          capacity: number;
          class_kits_info: string;
          copied_from_event_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          deposit_hold_days: number;
          description: string;
          ends_at: string;
          facebook_group_url: string | null;
          hotel_info: string;
          id: string;
          included: string;
          joining_info: string;
          slug: string;
          starts_at: string;
          status: Database["public"]["Enums"]["event_status"];
          summary: string;
          title: string;
          updated_at: string;
          venue_id: string;
        };
        ComputedFields: never;
        Insert: {
          balance_due_on: string;
          booking_closes_at?: string | null;
          booking_opens_at?: string | null;
          capacity: number;
          class_kits_info?: string;
          copied_from_event_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deposit_hold_days?: number;
          description?: string;
          ends_at: string;
          facebook_group_url?: string | null;
          hotel_info?: string;
          id?: string;
          included?: string;
          joining_info?: string;
          slug?: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["event_status"];
          summary?: string;
          title: string;
          updated_at?: string;
          venue_id: string;
        };
        Update: {
          balance_due_on?: string;
          booking_closes_at?: string | null;
          booking_opens_at?: string | null;
          capacity?: number;
          class_kits_info?: string;
          copied_from_event_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          deposit_hold_days?: number;
          description?: string;
          ends_at?: string;
          facebook_group_url?: string | null;
          hotel_info?: string;
          id?: string;
          included?: string;
          joining_info?: string;
          slug?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["event_status"];
          summary?: string;
          title?: string;
          updated_at?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_copied_from_event_id_fkey";
            columns: ["copied_from_event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_pence: number;
          booking_id: string;
          created_at: string;
          currency: string;
          delete_reason: string;
          deleted_at: string | null;
          id: string;
          method: Database["public"]["Enums"]["payment_method"];
          note: string;
          received_on: string | null;
          recorded_by: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_pence: number;
          booking_id: string;
          created_at?: string;
          currency?: string;
          delete_reason?: string;
          deleted_at?: string | null;
          id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          note?: string;
          received_on?: string | null;
          recorded_by?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_pence?: number;
          booking_id?: string;
          created_at?: string;
          currency?: string;
          delete_reason?: string;
          deleted_at?: string | null;
          id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          note?: string;
          received_on?: string | null;
          recorded_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          marketing_consent: boolean;
          marketing_consent_at: string | null;
          marketing_consent_source: string | null;
          phone: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          marketing_consent?: boolean;
          marketing_consent_at?: string | null;
          marketing_consent_source?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          marketing_consent?: boolean;
          marketing_consent_at?: string | null;
          marketing_consent_source?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          address: string;
          bank_account_name: string;
          bank_account_number: string;
          bank_name: string;
          bank_sort_code: string;
          business_name: string;
          company_number: string;
          contact_email: string;
          created_at: string;
          email_reply_to: string;
          email_test_address: string;
          facebook_group_url: string;
          facebook_url: string;
          id: string;
          instagram_url: string;
          legal_name: string;
          phone: string;
          send_payment_emails: boolean;
          sign_off: string;
          singleton: boolean;
          terms_text: string;
          terms_updated_at: string;
          terms_version: number;
          updated_at: string;
          updated_by: string | null;
          website: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string;
          bank_account_name?: string;
          bank_account_number?: string;
          bank_name?: string;
          bank_sort_code?: string;
          business_name?: string;
          company_number?: string;
          contact_email?: string;
          created_at?: string;
          email_reply_to?: string;
          email_test_address?: string;
          facebook_group_url?: string;
          facebook_url?: string;
          id?: string;
          instagram_url?: string;
          legal_name?: string;
          phone?: string;
          send_payment_emails?: boolean;
          sign_off?: string;
          singleton?: boolean;
          terms_text?: string;
          terms_updated_at?: string;
          terms_version?: number;
          updated_at?: string;
          updated_by?: string | null;
          website?: string;
        };
        Update: {
          address?: string;
          bank_account_name?: string;
          bank_account_number?: string;
          bank_name?: string;
          bank_sort_code?: string;
          business_name?: string;
          company_number?: string;
          contact_email?: string;
          created_at?: string;
          email_reply_to?: string;
          email_test_address?: string;
          facebook_group_url?: string;
          facebook_url?: string;
          id?: string;
          instagram_url?: string;
          legal_name?: string;
          phone?: string;
          send_payment_emails?: boolean;
          sign_off?: string;
          singleton?: boolean;
          terms_text?: string;
          terms_updated_at?: string;
          terms_version?: number;
          updated_at?: string;
          updated_by?: string | null;
          website?: string;
        };
        Relationships: [];
      };
      staff: {
        Row: {
          created_at: string;
          created_by: string | null;
          role: Database["public"]["Enums"]["staff_role"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          role: Database["public"]["Enums"]["staff_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          role?: Database["public"]["Enums"]["staff_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      terms_versions: {
        Row: {
          created_at: string;
          created_by: string | null;
          terms_text: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          terms_text: string;
          version: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          terms_text?: string;
          version?: number;
        };
        Relationships: [];
      };
      ticket_types: {
        Row: {
          capacity: number | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          deleted_at: string | null;
          deposit_pence: number | null;
          description: string;
          event_id: string;
          id: string;
          name: string;
          on_sale: boolean;
          price_pence: number;
          sort_order: number;
          starts_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          capacity?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          deposit_pence?: number | null;
          description?: string;
          event_id: string;
          id?: string;
          name: string;
          on_sale?: boolean;
          price_pence: number;
          sort_order?: number;
          starts_at?: string | null;
          updated_at?: string;
        };
        Update: {
          capacity?: number | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          deposit_pence?: number | null;
          description?: string;
          event_id?: string;
          id?: string;
          name?: string;
          on_sale?: boolean;
          price_pence?: number;
          sort_order?: number;
          starts_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_types_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      venues: {
        Row: {
          access_info: string;
          address: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          map_url: string | null;
          name: string;
          parking: string;
          phone: string;
          postcode: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          access_info?: string;
          address?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          map_url?: string | null;
          name: string;
          parking?: string;
          phone?: string;
          postcode?: string;
          updated_at?: string;
        };
        Update: {
          access_info?: string;
          address?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          map_url?: string | null;
          name?: string;
          parking?: string;
          phone?: string;
          postcode?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      waitlist: {
        Row: {
          booking_id: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string;
          event_id: string;
          id: string;
          notes: string;
          offer_expires_on: string | null;
          offered_at: string | null;
          status: Database["public"]["Enums"]["waitlist_status"];
          ticket_type_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id: string;
          event_id: string;
          id?: string;
          notes?: string;
          offer_expires_on?: string | null;
          offered_at?: string | null;
          status?: Database["public"]["Enums"]["waitlist_status"];
          ticket_type_id?: string | null;
          updated_at?: string;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string;
          event_id?: string;
          id?: string;
          notes?: string;
          offer_expires_on?: string | null;
          offered_at?: string | null;
          status?: Database["public"]["Enums"]["waitlist_status"];
          ticket_type_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "waitlist_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waitlist_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waitlist_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waitlist_option_same_event";
            columns: ["ticket_type_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "ticket_types";
            referencedColumns: ["id", "event_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      book_from_waitlist: {
        Args: { option_id: string; room_id?: string; waitlist_id: string };
        Returns: string;
      };
      copy_event: {
        Args: {
          new_starts_on: string;
          new_title: string;
          source_event_id: string;
        };
        Returns: string;
      };
      customer_settings: {
        Args: Record<PropertyKey, never>;
        Returns: {
          address: string;
          bank_account_name: string;
          bank_account_number: string;
          bank_name: string;
          bank_sort_code: string;
          business_name: string;
          company_number: string;
          contact_email: string;
          facebook_group_url: string;
          facebook_url: string;
          instagram_url: string;
          legal_name: string;
          phone: string;
          sign_off: string;
          terms_text: string;
          terms_version: number;
          website: string;
        }[];
      };
      import_bookings: {
        Args: { people: Json; rooms: Json; target_event_id: string };
        Returns: number;
      };
      log_email: {
        Args: {
          attachments: string[];
          body: string;
          booking_id: string;
          error?: string;
          provider_message_id?: string;
          sent: boolean;
          subject: string;
          template: string;
          test?: boolean;
          to_email: string;
        };
        Returns: string;
      };
      set_checked_in: {
        Args: { arrived: boolean; booking_id: string };
        Returns: string;
      };
    };
    Enums: {
      event_status:
        "draft" | "published" | "sold_out" | "cancelled" | "finished";
      payment_method: "bank_transfer" | "cash" | "card" | "other";
      staff_role: "owner" | "admin" | "door";
      waitlist_status:
        "waiting" | "offered" | "booked" | "declined" | "removed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      event_status: ["draft", "published", "sold_out", "cancelled", "finished"],
      payment_method: ["bank_transfer", "cash", "card", "other"],
      staff_role: ["owner", "admin", "door"],
      waitlist_status: ["waiting", "offered", "booked", "declined", "removed"],
    },
  },
} as const;
