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
    };
    Enums: {
      event_status:
        "draft" | "published" | "sold_out" | "cancelled" | "finished";
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
      staff_role: ["owner", "admin", "door"],
    },
  },
} as const;
