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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      calibration_feedback: {
        Row: {
          created_at: string
          feedback: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          mode: string
          persona_id: string | null
          pinned: boolean
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          mode?: string
          persona_id?: string | null
          pinned?: boolean
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          mode?: string
          persona_id?: string | null
          pinned?: boolean
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      granted_subscriptions: {
        Row: {
          active: boolean
          email: string
          expires_at: string | null
          granted_at: string
          id: string
          product_id: string
          tier: string
        }
        Insert: {
          active?: boolean
          email: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          product_id: string
          tier: string
        }
        Update: {
          active?: boolean
          email?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          product_id?: string
          tier?: string
        }
        Relationships: []
      }
      library_files: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number
          file_type?: string
          id?: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      memory_entries: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          sources: Json | null
          truth_score: string | null
          user_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          sources?: Json | null
          truth_score?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          sources?: Json | null
          truth_score?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
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
      projects: {
        Row: {
          created_at: string
          description: string
          files: string[]
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          files?: string[]
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          files?: string[]
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_prompts: {
        Row: {
          content: string
          created_at: string
          id: string
          starred: boolean
          tags: string[]
          title: string
          usage_count: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          starred?: boolean
          tags?: string[]
          title: string
          usage_count?: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          starred?: boolean
          tags?: string[]
          title?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
      }
      usage_stats: {
        Row: {
          chat_prompts: number
          code_prompts: number
          created_at: string
          id: string
          last_active_date: string | null
          research_prompts: number
          streak_days: number
          total_prompts: number
          truth_prompts: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_prompts?: number
          code_prompts?: number
          created_at?: string
          id?: string
          last_active_date?: string | null
          research_prompts?: number
          streak_days?: number
          total_prompts?: number
          truth_prompts?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_prompts?: number
          code_prompts?: number
          created_at?: string
          id?: string
          last_active_date?: string | null
          research_prompts?: number
          streak_days?: number
          total_prompts?: number
          truth_prompts?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_intelligence_profile: {
        Row: {
          active_hours: string[]
          created_at: string
          depth_auto: string
          id: string
          inferred_traits: Json
          tone_preference: string
          topics_of_interest: string[]
          total_calibrations: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_hours?: string[]
          created_at?: string
          depth_auto?: string
          id?: string
          inferred_traits?: Json
          tone_preference?: string
          topics_of_interest?: string[]
          total_calibrations?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_hours?: string[]
          created_at?: string
          depth_auto?: string
          id?: string
          inferred_traits?: Json
          tone_preference?: string
          topics_of_interest?: string[]
          total_calibrations?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          memory_enabled: boolean
          response_depth: string
          response_length: string
          theme: string
          updated_at: string
          user_id: string
          web_search_enabled: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          memory_enabled?: boolean
          response_depth?: string
          response_length?: string
          theme?: string
          updated_at?: string
          user_id: string
          web_search_enabled?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          memory_enabled?: boolean
          response_depth?: string
          response_length?: string
          theme?: string
          updated_at?: string
          user_id?: string
          web_search_enabled?: boolean
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
