export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      canvases: {
        Row: {
          active_contributors: number
          allowed_tools: string[]
          artwork_url: string | null
          background: string
          category: string
          color_palette: string[] | null
          completed_at: string | null
          completed_tiles: number
          created_at: string
          description: string
          disallowed_tools: string[]
          discussion_count: number
          final_gradient: string | null
          founder_id: string
          grid_cols: number
          grid_rows: number
          guest_token: string | null
          host_token: string | null
          id: string
          is_trending: boolean
          neighbor_preview_size: Database["public"]["Enums"]["neighbor_size"]
          participant_count: number | null
          participation_mode: Database["public"]["Enums"]["participation_mode"]
          preview_gradient: string
          status: Database["public"]["Enums"]["canvas_status"]
          style: string
          style_guidance: string
          title: string
          topic: string
          total_tiles: number | null
          visibility: Database["public"]["Enums"]["canvas_visibility"]
        }
        Insert: {
          active_contributors?: number
          allowed_tools?: string[]
          artwork_url?: string | null
          background?: string
          category: string
          color_palette?: string[] | null
          completed_at?: string | null
          completed_tiles?: number
          created_at?: string
          description?: string
          disallowed_tools?: string[]
          discussion_count?: number
          final_gradient?: string | null
          founder_id: string
          grid_cols: number
          grid_rows: number
          guest_token?: string | null
          host_token?: string | null
          id?: string
          is_trending?: boolean
          neighbor_preview_size?: Database["public"]["Enums"]["neighbor_size"]
          participant_count?: number | null
          participation_mode?: Database["public"]["Enums"]["participation_mode"]
          preview_gradient?: string
          status?: Database["public"]["Enums"]["canvas_status"]
          style?: string
          style_guidance?: string
          title: string
          topic?: string
          total_tiles?: number | null
          visibility?: Database["public"]["Enums"]["canvas_visibility"]
        }
        Update: {
          active_contributors?: number
          allowed_tools?: string[]
          artwork_url?: string | null
          background?: string
          category?: string
          color_palette?: string[] | null
          completed_at?: string | null
          completed_tiles?: number
          created_at?: string
          description?: string
          disallowed_tools?: string[]
          discussion_count?: number
          final_gradient?: string | null
          founder_id?: string
          grid_cols?: number
          grid_rows?: number
          guest_token?: string | null
          host_token?: string | null
          id?: string
          is_trending?: boolean
          neighbor_preview_size?: Database["public"]["Enums"]["neighbor_size"]
          participant_count?: number | null
          participation_mode?: Database["public"]["Enums"]["participation_mode"]
          preview_gradient?: string
          status?: Database["public"]["Enums"]["canvas_status"]
          style?: string
          style_guidance?: string
          title?: string
          topic?: string
          total_tiles?: number | null
          visibility?: Database["public"]["Enums"]["canvas_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "canvases_founder_id_fkey"
            columns: ["founder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          canvas_id: string
          created_at: string
          id: string
          text: string
          user_id: string
        }
        Insert: {
          canvas_id: string
          created_at?: string
          id?: string
          text: string
          user_id: string
        }
        Update: {
          canvas_id?: string
          created_at?: string
          id?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      private_sessions: {
        Row: {
          canvas_id: string
          created_at: string
          host_id: string
        }
        Insert: {
          canvas_id: string
          created_at?: string
          host_id: string
        }
        Update: {
          canvas_id?: string
          created_at?: string
          host_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_sessions_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: true
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar: string
          created_at: string
          id: string
          is_anonymous: boolean
          is_premium: boolean
          name: string
          photo_url: string | null
        }
        Insert: {
          avatar?: string
          created_at?: string
          id: string
          is_anonymous?: boolean
          is_premium?: boolean
          name: string
          photo_url?: string | null
        }
        Update: {
          avatar?: string
          created_at?: string
          id?: string
          is_anonymous?: boolean
          is_premium?: boolean
          name?: string
          photo_url?: string | null
        }
        Relationships: []
      }
      saved_canvases: {
        Row: {
          canvas_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          canvas_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          canvas_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_canvases_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_canvases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tiles: {
        Row: {
          artwork_path: string | null
          assigned_user_id: string | null
          canvas_id: string
          col: number
          completed_at: string | null
          contributor_name: string | null
          id: string
          is_center: boolean
          is_host_tile: boolean
          row: number
          started_at: string | null
          status: Database["public"]["Enums"]["tile_status"]
        }
        Insert: {
          artwork_path?: string | null
          assigned_user_id?: string | null
          canvas_id: string
          col: number
          completed_at?: string | null
          contributor_name?: string | null
          id: string
          is_center?: boolean
          is_host_tile?: boolean
          row: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["tile_status"]
        }
        Update: {
          artwork_path?: string | null
          assigned_user_id?: string | null
          canvas_id?: string
          col?: number
          completed_at?: string | null
          contributor_name?: string | null
          id?: string
          is_center?: boolean
          is_host_tile?: boolean
          row?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["tile_status"]
        }
        Relationships: [
          {
            foreignKeyName: "tiles_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiles_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
        ]
      }
      vote_seeds: {
        Row: {
          canvas_id: string
          count: number
          month_key: string
        }
        Insert: {
          canvas_id: string
          count?: number
          month_key: string
        }
        Update: {
          canvas_id?: string
          count?: number
          month_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "vote_seeds_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          canvas_id: string
          created_at: string
          month_key: string
          user_id: string
        }
        Insert: {
          canvas_id: string
          created_at?: string
          month_key: string
          user_id: string
        }
        Update: {
          canvas_id?: string
          created_at?: string
          month_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_user_id_fkey"
            columns: ["user_id"]
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
      cast_vote: {
        Args: { p_canvas_id: string; p_month_key: string }
        Returns: undefined
      }
      claim_tile: {
        Args: {
          p_canvas_id: string
          p_prefer_center?: boolean
          p_tile_id?: string
        }
        Returns: {
          artwork_path: string | null
          assigned_user_id: string | null
          canvas_id: string
          col: number
          completed_at: string | null
          contributor_name: string | null
          id: string
          is_center: boolean
          is_host_tile: boolean
          row: number
          started_at: string | null
          status: Database["public"]["Enums"]["tile_status"]
        }
        SetofOptions: {
          from: "*"
          to: "tiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_tile: {
        Args: { p_artwork_path?: string; p_tile_id: string }
        Returns: {
          artwork_path: string | null
          assigned_user_id: string | null
          canvas_id: string
          col: number
          completed_at: string | null
          contributor_name: string | null
          id: string
          is_center: boolean
          is_host_tile: boolean
          row: number
          started_at: string | null
          status: Database["public"]["Enums"]["tile_status"]
        }
        SetofOptions: {
          from: "*"
          to: "tiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_canvas: {
        Args: { payload: Json }
        Returns: {
          active_contributors: number
          allowed_tools: string[]
          artwork_url: string | null
          background: string
          category: string
          color_palette: string[] | null
          completed_at: string | null
          completed_tiles: number
          created_at: string
          description: string
          disallowed_tools: string[]
          discussion_count: number
          final_gradient: string | null
          founder_id: string
          grid_cols: number
          grid_rows: number
          guest_token: string | null
          host_token: string | null
          id: string
          is_trending: boolean
          neighbor_preview_size: Database["public"]["Enums"]["neighbor_size"]
          participant_count: number | null
          participation_mode: Database["public"]["Enums"]["participation_mode"]
          preview_gradient: string
          status: Database["public"]["Enums"]["canvas_status"]
          style: string
          style_guidance: string
          title: string
          topic: string
          total_tiles: number | null
          visibility: Database["public"]["Enums"]["canvas_visibility"]
        }
        SetofOptions: {
          from: "*"
          to: "canvases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gen_token: { Args: never; Returns: string }
      get_my_notifications: {
        Args: never
        Returns: {
          canvas_id: string
          canvas_title: string
          created_at: string
          id: string
          read: boolean
          type: string
        }[]
      }
      get_my_profile: { Args: never; Returns: Json }
      get_profile: { Args: { p_uid: string }; Returns: Json }
      host_kick: {
        Args: { p_canvas_id: string; p_target_user: string }
        Returns: undefined
      }
      host_reassign: {
        Args: { p_canvas_id: string; p_target_user: string; p_tile_id: string }
        Returns: undefined
      }
      is_member_of: { Args: { p_canvas: string }; Returns: boolean }
      join_private_canvas: { Args: { p_token: string }; Returns: Json }
      random_guest_name: { Args: never; Returns: string }
      resolve_host_token: {
        Args: { p_token: string }
        Returns: {
          active_contributors: number
          allowed_tools: string[]
          artwork_url: string | null
          background: string
          category: string
          color_palette: string[] | null
          completed_at: string | null
          completed_tiles: number
          created_at: string
          description: string
          disallowed_tools: string[]
          discussion_count: number
          final_gradient: string | null
          founder_id: string
          grid_cols: number
          grid_rows: number
          guest_token: string | null
          host_token: string | null
          id: string
          is_trending: boolean
          neighbor_preview_size: Database["public"]["Enums"]["neighbor_size"]
          participant_count: number | null
          participation_mode: Database["public"]["Enums"]["participation_mode"]
          preview_gradient: string
          status: Database["public"]["Enums"]["canvas_status"]
          style: string
          style_guidance: string
          title: string
          topic: string
          total_tiles: number | null
          visibility: Database["public"]["Enums"]["canvas_visibility"]
        }
        SetofOptions: {
          from: "*"
          to: "canvases"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      retract_vote: { Args: { p_month_key: string }; Returns: undefined }
      total_voters: { Args: { p_month: string }; Returns: number }
      vote_board: {
        Args: { p_month: string }
        Returns: {
          canvas_id: string
          votes: number
        }[]
      }
      vote_count: {
        Args: { p_canvas: string; p_month: string }
        Returns: number
      }
    }
    Enums: {
      canvas_status: "open" | "almost-complete" | "completed" | "locked"
      canvas_visibility: "public" | "private-link"
      neighbor_size: "small" | "large"
      notification_type: "canvas-completed"
      participation_mode: "free-pick" | "random"
      tile_status: "empty" | "in-progress" | "completed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      canvas_status: ["open", "almost-complete", "completed", "locked"],
      canvas_visibility: ["public", "private-link"],
      neighbor_size: ["small", "large"],
      notification_type: ["canvas-completed"],
      participation_mode: ["free-pick", "random"],
      tile_status: ["empty", "in-progress", "completed"],
    },
  },
} as const

