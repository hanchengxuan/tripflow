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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      activity_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          metadata: Json
          segment_id: string | null
          trip_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: never
          metadata?: Json
          segment_id?: string | null
          trip_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: never
          metadata?: Json
          segment_id?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_segment_same_trip_fk"
            columns: ["segment_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id", "trip_id"]
          },
        ]
      }
      exchange_rate_snapshots: {
        Row: {
          base_currency: string
          captured_at: string
          created_by: string | null
          id: string
          quote_currency: string
          rate: number
          source: string
          trip_id: string
        }
        Insert: {
          base_currency: string
          captured_at: string
          created_by?: string | null
          id?: string
          quote_currency: string
          rate: number
          source: string
          trip_id: string
        }
        Update: {
          base_currency?: string
          captured_at?: string
          created_by?: string | null
          id?: string
          quote_currency?: string
          rate?: number
          source?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rate_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exchange_rate_snapshots_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_allocation_groups: {
        Row: {
          amount_minor: number
          expense_id: string
          id: string
          label: string
        }
        Insert: {
          amount_minor: number
          expense_id: string
          id?: string
          label?: string
        }
        Update: {
          amount_minor?: number
          expense_id?: string
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_allocation_groups_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_payers: {
        Row: {
          amount_minor: number
          expense_id: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          expense_id: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          expense_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_payers_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_payers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_receipts: {
        Row: {
          created_at: string
          expense_id: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          expense_id: string
          id?: string
          mime_type: string
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          expense_id?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_receipts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_receipts_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_shares: {
        Row: {
          allocation_group_id: string
          amount_minor: number
          user_id: string
        }
        Insert: {
          allocation_group_id: string
          amount_minor: number
          user_id: string
        }
        Update: {
          allocation_group_id?: string
          amount_minor?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_shares_allocation_group_id_fkey"
            columns: ["allocation_group_id"]
            isOneToOne: false
            referencedRelation: "expense_allocation_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          created_at: string
          created_by: string
          currency: string
          id: string
          occurred_at: string
          parser_confidence: number | null
          segment_id: string | null
          source: Database["public"]["Enums"]["expense_source"]
          source_transcript: string | null
          title: string
          total_minor: number
          trip_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          currency: string
          id?: string
          occurred_at: string
          parser_confidence?: number | null
          segment_id?: string | null
          source?: Database["public"]["Enums"]["expense_source"]
          source_transcript?: string | null
          title: string
          total_minor: number
          trip_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          occurred_at?: string
          parser_confidence?: number | null
          segment_id?: string | null
          source?: Database["public"]["Enums"]["expense_source"]
          source_transcript?: string | null
          title?: string
          total_minor?: number
          trip_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_segment_same_trip_fk"
            columns: ["segment_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      item_participants: {
        Row: {
          acknowledged_version: number
          item_id: string
          status: Database["public"]["Enums"]["participant_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged_version?: number
          item_id: string
          status?: Database["public"]["Enums"]["participant_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged_version?: number
          item_id?: string
          status?: Database["public"]["Enums"]["participant_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_participants_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itinerary_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_items: {
        Row: {
          confirmation_number: string | null
          created_at: string
          created_by: string
          ends_at: string | null
          google_place_id: string | null
          id: string
          is_material_change: boolean
          kind: Database["public"]["Enums"]["itinerary_kind"]
          linked_stay_id: string | null
          local_script_address: string | null
          location_label: string | null
          notes: string | null
          responsible_user_id: string | null
          route_travel_mode: string
          segment_id: string | null
          starts_at: string
          title: string
          trip_id: string
          updated_at: string
          version: number
        }
        Insert: {
          confirmation_number?: string | null
          created_at?: string
          created_by: string
          ends_at?: string | null
          google_place_id?: string | null
          id?: string
          is_material_change?: boolean
          kind: Database["public"]["Enums"]["itinerary_kind"]
          linked_stay_id?: string | null
          local_script_address?: string | null
          location_label?: string | null
          notes?: string | null
          responsible_user_id?: string | null
          route_travel_mode?: string
          segment_id?: string | null
          starts_at: string
          title: string
          trip_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          confirmation_number?: string | null
          created_at?: string
          created_by?: string
          ends_at?: string | null
          google_place_id?: string | null
          id?: string
          is_material_change?: boolean
          kind?: Database["public"]["Enums"]["itinerary_kind"]
          linked_stay_id?: string | null
          local_script_address?: string | null
          location_label?: string | null
          notes?: string | null
          responsible_user_id?: string | null
          route_travel_mode?: string
          segment_id?: string | null
          starts_at?: string
          title?: string
          trip_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_linked_stay_id_fkey"
            columns: ["linked_stay_id"]
            isOneToOne: false
            referencedRelation: "itinerary_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_segment_same_trip_fk"
            columns: ["segment_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id", "trip_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      segment_members: {
        Row: {
          added_at: string
          segment_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          segment_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          segment_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segment_members_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          created_at: string
          created_by: string
          ends_at: string
          id: string
          location_label: string
          name: string
          parent_segment_id: string | null
          starts_at: string
          trip_id: string
          updated_at: string
          visibility: Database["public"]["Enums"]["segment_visibility"]
        }
        Insert: {
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          location_label?: string
          name: string
          parent_segment_id?: string | null
          starts_at: string
          trip_id: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["segment_visibility"]
        }
        Update: {
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          location_label?: string
          name?: string
          parent_segment_id?: string | null
          starts_at?: string
          trip_id?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["segment_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "segments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segments_parent_same_trip_fk"
            columns: ["parent_segment_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "segments_parent_segment_id_fkey"
            columns: ["parent_segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          from_user_id: string
          id: string
          recorded_by: string
          segment_id: string | null
          settled_at: string
          to_user_id: string
          trip_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency: string
          from_user_id: string
          id?: string
          recorded_by: string
          segment_id?: string | null
          settled_at: string
          to_user_id: string
          trip_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          from_user_id?: string
          id?: string
          recorded_by?: string
          segment_id?: string | null
          settled_at?: string
          to_user_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_segment_same_trip_fk"
            columns: ["segment_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "settlements_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_invites: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          max_uses: number
          revoked_at: string | null
          role: Database["public"]["Enums"]["trip_role"]
          token_digest: string
          trip_id: string
          use_count: number
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          max_uses?: number
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["trip_role"]
          token_digest: string
          trip_id: string
          use_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          max_uses?: number
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["trip_role"]
          token_digest?: string
          trip_id?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "trip_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_invites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_member_archives: {
        Row: {
          avatar_path: string | null
          display_name: string
          removed_at: string
          trip_id: string
          user_id: string
        }
        Insert: {
          avatar_path?: string | null
          display_name: string
          removed_at?: string
          trip_id: string
          user_id: string
        }
        Update: {
          avatar_path?: string | null
          display_name?: string
          removed_at?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_member_archives_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          joined_at: string
          role: Database["public"]["Enums"]["trip_role"]
          trip_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: Database["public"]["Enums"]["trip_role"]
          trip_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: Database["public"]["Enums"]["trip_role"]
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          created_by: string
          default_time_zone: string
          ends_on: string
          home_currency: string
          id: string
          name: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          default_time_zone: string
          ends_on: string
          home_currency: string
          id?: string
          name: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          default_time_zone?: string
          ends_on?: string
          home_currency?: string
          id?: string
          name?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_trip_invite: { Args: { invite_token: string }; Returns: string }
      can_edit_trip: { Args: { requested_trip_id: string }; Returns: boolean }
      can_read_segment: {
        Args: { requested_segment_id: string }
        Returns: boolean
      }
      create_equal_expense: {
        Args: {
          expense_currency: string
          expense_occurred_at?: string
          expense_title: string
          expense_total_minor: number
          participant_user_ids: string[]
          payer_user_id: string
          requested_segment_id?: string
          requested_trip_id: string
        }
        Returns: string
      }
      create_stay_transfer: {
        Args: {
          requested_stay_id: string
          route_title: string
          source_item_id: string
        }
        Returns: string
      }
      create_trip: {
        Args: {
          trip_default_time_zone: string
          trip_ends_on: string
          trip_home_currency: string
          trip_name: string
          trip_starts_on: string
        }
        Returns: {
          created_at: string
          created_by: string
          default_time_zone: string
          ends_on: string
          home_currency: string
          id: string
          name: string
          starts_on: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_trip_invite: {
        Args: {
          allowed_uses?: number
          invited_role?: Database["public"]["Enums"]["trip_role"]
          requested_trip_id: string
          valid_for_hours?: number
        }
        Returns: {
          invite_expires_at: string
          invite_token: string
        }[]
      }
      delete_current_account: { Args: never; Returns: undefined }
      delete_itinerary_item: {
        Args: { requested_item_id: string }
        Returns: undefined
      }
      delete_trip: { Args: { requested_trip_id: string }; Returns: undefined }
      is_active_user: { Args: never; Returns: boolean }
      is_trip_creator: { Args: { requested_trip_id: string }; Returns: boolean }
      is_trip_member: { Args: { requested_trip_id: string }; Returns: boolean }
      is_trip_owner: { Args: { requested_trip_id: string }; Returns: boolean }
      is_user_trip_member: {
        Args: { requested_trip_id: string; requested_user_id: string }
        Returns: boolean
      }
      manage_trip_member: {
        Args: {
          remove_member?: boolean
          requested_role: Database["public"]["Enums"]["trip_role"]
          requested_trip_id: string
          target_user_id: string
        }
        Returns: undefined
      }
      record_settlement: {
        Args: {
          recipient_user_id: string
          requested_trip_id: string
          settlement_amount_minor: number
          settlement_currency: string
        }
        Returns: string
      }
      unrecord_settlement: {
        Args: { requested_settlement_id: string }
        Returns: undefined
      }
      update_trip_details: {
        Args: {
          requested_trip_id: string
          trip_default_time_zone: string
          trip_ends_on: string
          trip_home_currency: string
          trip_name: string
          trip_starts_on: string
        }
        Returns: {
          created_at: string
          created_by: string
          default_time_zone: string
          ends_on: string
          home_currency: string
          id: string
          name: string
          starts_on: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_itinerary_item: {
        Args: {
          item_ends_at: string
          item_google_place_id: string
          item_location_label: string
          item_starts_at: string
          item_title: string
          requested_item_id: string
        }
        Returns: Database["public"]["Tables"]["itinerary_items"]["Row"]
      }
      update_itinerary_route_mode: {
        Args: { requested_item_id: string; requested_travel_mode: string }
        Returns: Database["public"]["Tables"]["itinerary_items"]["Row"]
      }
    }
    Enums: {
      expense_source: "manual" | "text" | "voice" | "receipt"
      itinerary_kind:
        | "transport"
        | "lodging"
        | "food"
        | "activity"
        | "note"
        | "task"
      participant_status: "going" | "arrived" | "delayed" | "not_participating"
      segment_visibility: "members_only" | "trip_read_only"
      trip_role: "owner" | "editor" | "viewer"
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
      expense_source: ["manual", "text", "voice", "receipt"],
      itinerary_kind: [
        "transport",
        "lodging",
        "food",
        "activity",
        "note",
        "task",
      ],
      participant_status: ["going", "arrived", "delayed", "not_participating"],
      segment_visibility: ["members_only", "trip_read_only"],
      trip_role: ["owner", "editor", "viewer"],
    },
  },
} as const
