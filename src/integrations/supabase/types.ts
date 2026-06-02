export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      drive_watch_channels: {
        Row: {
          channel_id: string
          created_at: string
          expiration: string | null
          id: string
          resource_id: string
          resource_uri: string | null
          token: string
          trip_id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          expiration?: string | null
          id?: string
          resource_id: string
          resource_uri?: string | null
          token: string
          trip_id: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          expiration?: string | null
          id?: string
          resource_id?: string
          resource_uri?: string | null
          token?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_watch_channels_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      google_tokens: {
        Row: {
          access_token: string
          expires_at: string
          google_email: string | null
          refresh_token: string
          scope: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          expires_at: string
          google_email?: string | null
          refresh_token: string
          scope: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          expires_at?: string
          google_email?: string | null
          refresh_token?: string
          scope?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      places: {
        Row: {
          address: string | null
          category: Database["public"]["Enums"]["place_category"]
          created_at: string
          day_number: number | null
          google_place_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          order_index: number
          saved: boolean
          source_excerpt: string | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          category?: Database["public"]["Enums"]["place_category"]
          created_at?: string
          day_number?: number | null
          google_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          order_index?: number
          saved?: boolean
          source_excerpt?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          category?: Database["public"]["Enums"]["place_category"]
          created_at?: string
          day_number?: number | null
          google_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          order_index?: number
          saved?: boolean
          source_excerpt?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "places_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trip_entitlements: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          purchased_at: string
          status: string
          stripe_session_id: string | null
          template_id: string
          trip_id: string
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          purchased_at?: string
          status?: string
          stripe_session_id?: string | null
          template_id: string
          trip_id: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          purchased_at?: string
          status?: string
          stripe_session_id?: string | null
          template_id?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_entitlements_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          content: Json | null
          created_at: string
          destination: string
          doc_id: string | null
          doc_url: string | null
          end_date: string | null
          expires_at: string | null
          hero_image_url: string | null
          id: string
          keywords: string | null
          locked_at: string | null
          locked_snapshot: Json | null
          original_template_id: string | null
          slug: string
          start_date: string | null
          status: Database["public"]["Enums"]["trip_status"]
          subtitle: string | null
          template_id: string | null
          tone: string | null
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          destination: string
          doc_id?: string | null
          doc_url?: string | null
          end_date?: string | null
          expires_at?: string | null
          hero_image_url?: string | null
          id?: string
          keywords?: string | null
          locked_at?: string | null
          locked_snapshot?: Json | null
          original_template_id?: string | null
          slug: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          subtitle?: string | null
          template_id?: string | null
          tone?: string | null
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          destination?: string
          doc_id?: string | null
          doc_url?: string | null
          end_date?: string | null
          expires_at?: string | null
          hero_image_url?: string | null
          id?: string
          keywords?: string | null
          locked_at?: string | null
          locked_snapshot?: Json | null
          original_template_id?: string | null
          slug?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          subtitle?: string | null
          template_id?: string | null
          tone?: string | null
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      place_category:
        | "lodging"
        | "food"
        | "activity"
        | "transport"
        | "sight"
        | "other"
      trip_status: "draft" | "generated" | "refined"
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
      place_category: [
        "lodging",
        "food",
        "activity",
        "transport",
        "sight",
        "other",
      ],
      trip_status: ["draft", "generated", "refined"],
    },
  },
} as const
