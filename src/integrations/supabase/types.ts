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
      admin_snapshots: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          label: string | null
          last_viewed_at: string | null
          payload: Json
          range_days: number
          revoked_at: string | null
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          label?: string | null
          last_viewed_at?: string | null
          payload: Json
          range_days: number
          revoked_at?: string | null
          token: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          label?: string | null
          last_viewed_at?: string | null
          payload?: Json
          range_days?: number
          revoked_at?: string | null
          token?: string
          view_count?: number
        }
        Relationships: []
      }
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
      contact_messages: {
        Row: {
          category: string
          created_at: string
          email: string
          id: string
          message: string
          name: string | null
        }
        Insert: {
          category: string
          created_at?: string
          email: string
          id?: string
          message: string
          name?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string | null
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
            referencedRelation: "admin_trip_engagement"
            referencedColumns: ["trip_id"]
          },
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
      parse_debug_reports: {
        Row: {
          attempts_count: number
          created_at: string
          id: string
          outcome: string
          report: Json
          source: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          attempts_count?: number
          created_at?: string
          id?: string
          outcome: string
          report: Json
          source: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          attempts_count?: number
          created_at?: string
          id?: string
          outcome?: string
          report?: Json
          source?: string
          trip_id?: string | null
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
            referencedRelation: "admin_trip_engagement"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "places_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          created_at: string
          event: string
          id: string
          occurred_at: string
          path: string | null
          props: Json
          session_id: string | null
          template_id: string | null
          trip_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          occurred_at?: string
          path?: string | null
          props?: Json
          session_id?: string | null
          template_id?: string | null
          trip_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          occurred_at?: string
          path?: string | null
          props?: Json
          session_id?: string | null
          template_id?: string | null
          trip_id?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      purchases: {
        Row: {
          attributed_ref: string | null
          attributed_surface: string | null
          created_at: string
          currency: string
          fee_cents: number
          gross_cents: number
          id: string
          kind: Database["public"]["Enums"]["purchase_kind"]
          net_cents: number
          paid_at: string
          price_variant: string | null
          provider: Database["public"]["Enums"]["purchase_provider"]
          provider_ref: string
          refunded_at: string | null
          status: Database["public"]["Enums"]["purchase_status"]
          tax_cents: number
          trip_id: string | null
          user_id: string | null
        }
        Insert: {
          attributed_ref?: string | null
          attributed_surface?: string | null
          created_at?: string
          currency?: string
          fee_cents?: number
          gross_cents?: number
          id?: string
          kind?: Database["public"]["Enums"]["purchase_kind"]
          net_cents?: number
          paid_at?: string
          price_variant?: string | null
          provider?: Database["public"]["Enums"]["purchase_provider"]
          provider_ref: string
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          tax_cents?: number
          trip_id?: string | null
          user_id?: string | null
        }
        Update: {
          attributed_ref?: string | null
          attributed_surface?: string | null
          created_at?: string
          currency?: string
          fee_cents?: number
          gross_cents?: number
          id?: string
          kind?: Database["public"]["Enums"]["purchase_kind"]
          net_cents?: number
          paid_at?: string
          price_variant?: string | null
          provider?: Database["public"]["Enums"]["purchase_provider"]
          provider_ref?: string
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["purchase_status"]
          tax_cents?: number
          trip_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "admin_trip_engagement"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "purchases_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_trip_requests: {
        Row: {
          created_at: string
          id: string
          label: string
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          payload: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          content_hash: string
          doc_slug: string
          id: string
          ip_address: string | null
          locale: string | null
          method: string
          recorded_at: string
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          content_hash: string
          doc_slug?: string
          id?: string
          ip_address?: string | null
          locale?: string | null
          method: string
          recorded_at?: string
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          content_hash?: string
          doc_slug?: string
          id?: string
          ip_address?: string | null
          locale?: string | null
          method?: string
          recorded_at?: string
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      trip_access_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          is_owner: boolean
          occurred_at: string
          trip_id: string
          trip_slug: string
          user_agent: string | null
          visitor_hash: string | null
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          is_owner?: boolean
          occurred_at?: string
          trip_id: string
          trip_slug: string
          user_agent?: string | null
          visitor_hash?: string | null
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          is_owner?: boolean
          occurred_at?: string
          trip_id?: string
          trip_slug?: string
          user_agent?: string | null
          visitor_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_access_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "admin_trip_engagement"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_access_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_doc_previews: {
        Row: {
          created_at: string
          google_doc_id: string
          google_doc_url: string
          id: string
          preview_html: string | null
          source: string
          source_message_id: string | null
          status: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          google_doc_id: string
          google_doc_url: string
          id?: string
          preview_html?: string | null
          source: string
          source_message_id?: string | null
          status?: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          google_doc_id?: string
          google_doc_url?: string
          id?: string
          preview_html?: string | null
          source?: string
          source_message_id?: string | null
          status?: string
          trip_id?: string
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
            referencedRelation: "admin_trip_engagement"
            referencedColumns: ["trip_id"]
          },
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_event_daily: {
        Row: {
          day: string | null
          event: string | null
          events: number | null
          sessions: number | null
          users: number | null
        }
        Relationships: []
      }
      admin_revenue_daily: {
        Row: {
          day: string | null
          gross_cents: number | null
          paid_mints: number | null
          paying_users: number | null
        }
        Relationships: []
      }
      admin_signup_cohorts: {
        Row: {
          cohort_week: string | null
          first_mint_at: string | null
          minted_any: number | null
          signups: number | null
        }
        Relationships: []
      }
      admin_template_leaderboard: {
        Row: {
          mint_submits: number | null
          mints: number | null
          picks: number | null
          previews: number | null
          template_id: string | null
        }
        Relationships: []
      }
      admin_trip_engagement: {
        Row: {
          block_count: number | null
          created_at: string | null
          day_count: number | null
          destination: string | null
          edited_after_mint: boolean | null
          export_events: number | null
          is_paid: boolean | null
          recipient_views: number | null
          template_id: string | null
          trip_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          block_count?: never
          created_at?: string | null
          day_count?: never
          destination?: string | null
          edited_after_mint?: never
          export_events?: never
          is_paid?: never
          recipient_views?: never
          template_id?: string | null
          trip_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          block_count?: never
          created_at?: string | null
          day_count?: never
          destination?: string | null
          edited_after_mint?: never
          export_events?: never
          is_paid?: never
          recipient_views?: never
          template_id?: string | null
          trip_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      place_category:
        | "lodging"
        | "food"
        | "activity"
        | "transport"
        | "sight"
        | "other"
      purchase_kind: "mint" | "renew"
      purchase_provider: "stripe" | "paddle"
      purchase_status: "paid" | "refunded" | "disputed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user"],
      place_category: [
        "lodging",
        "food",
        "activity",
        "transport",
        "sight",
        "other",
      ],
      purchase_kind: ["mint", "renew"],
      purchase_provider: ["stripe", "paddle"],
      purchase_status: ["paid", "refunded", "disputed"],
      trip_status: ["draft", "generated", "refined"],
    },
  },
} as const
