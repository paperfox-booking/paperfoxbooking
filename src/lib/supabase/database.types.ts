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
          booking_id: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          id: string;
          note: string;
          outside_system: boolean;
          sent_at: string | null;
          sent_on: string | null;
          status: string;
          subject: string;
          template: string;
        };
        ComputedFields: never;
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          id?: string;
          note?: string;
          outside_system?: boolean;
          sent_at?: string | null;
          sent_on?: string | null;
          status?: string;
          subject?: string;
          template: string;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          id?: string;
          note?: string;
          outside_system?: boolean;
          sent_at?: string | null;
          sent_on?: string | null;
          status?: string;
          subject?: string;
          template?: string;
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      copy_event: {
        Args: {
          new_starts_on: string;
          new_title: string;
          source_event_id: string;
        };
        Returns: string;
      };
      import_bookings: {
        Args: { people: Json; rooms: Json; target_event_id: string };
        Returns: number;
      };
    };
    Enums: {
      event_status:
        "draft" | "published" | "sold_out" | "cancelled" | "finished";
      payment_method: "bank_transfer" | "cash" | "card" | "other";
      staff_role: "owner" | "admin" | "door";
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
    },
  },
} as const;
