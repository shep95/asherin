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
      asha_branches: {
        Row: {
          conflicts: number
          created_at: string
          id: string
          is_main: boolean
          is_protected: boolean
          name: string
          parent_id: string | null
          transform_count: number
          user_id: string
        }
        Insert: {
          conflicts?: number
          created_at?: string
          id?: string
          is_main?: boolean
          is_protected?: boolean
          name: string
          parent_id?: string | null
          transform_count?: number
          user_id: string
        }
        Update: {
          conflicts?: number
          created_at?: string
          id?: string
          is_main?: boolean
          is_protected?: boolean
          name?: string
          parent_id?: string | null
          transform_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_branches_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "asha_branches"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_datasets: {
        Row: {
          branch: string | null
          col_count: number | null
          created_at: string
          date_range: string | null
          description: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          issues: Json | null
          project_name: string | null
          quality_score: number | null
          row_count: number | null
          schema: Json | null
          status: string
          storage_path: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          branch?: string | null
          col_count?: number | null
          created_at?: string
          date_range?: string | null
          description?: string | null
          file_name: string
          file_size?: number
          file_type?: string
          id?: string
          issues?: Json | null
          project_name?: string | null
          quality_score?: number | null
          row_count?: number | null
          schema?: Json | null
          status?: string
          storage_path: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          branch?: string | null
          col_count?: number | null
          created_at?: string
          date_range?: string | null
          description?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          issues?: Json | null
          project_name?: string | null
          quality_score?: number | null
          row_count?: number | null
          schema?: Json | null
          status?: string
          storage_path?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asha_insights: {
        Row: {
          created_at: string
          dataset_id: string | null
          description: string
          dismissed: boolean
          icon: string
          id: string
          pinned: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dataset_id?: string | null
          description: string
          dismissed?: boolean
          icon?: string
          id?: string
          pinned?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dataset_id?: string | null
          description?: string
          dismissed?: boolean
          icon?: string
          id?: string
          pinned?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_insights_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "asha_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_queries: {
        Row: {
          created_at: string
          id: string
          query: string
          response: string
          response_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          response?: string
          response_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          response?: string
          response_type?: string
          user_id?: string
        }
        Relationships: []
      }
      asha_reports: {
        Row: {
          content: string | null
          created_at: string
          id: string
          name: string
          pages: number | null
          schedule: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          name: string
          pages?: number | null
          schedule?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          name?: string
          pages?: number | null
          schedule?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asha_workflows: {
        Row: {
          active: boolean
          created_at: string
          id: string
          last_run: string | null
          name: string
          runs_count: number
          template_id: string | null
          trigger_type: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          last_run?: string | null
          name: string
          runs_count?: number
          template_id?: string | null
          trigger_type?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          last_run?: string | null
          name?: string
          runs_count?: number
          template_id?: string | null
          trigger_type?: string
          user_id?: string
        }
        Relationships: []
      }
      briefing_profiles: {
        Row: {
          company_name: string | null
          competitors: string[]
          created_at: string
          custom_topics: string[]
          delivery_time: string
          enabled: boolean
          id: string
          industry: string
          investment_interests: string[]
          key_markets: string[]
          regulatory_bodies: string[]
          technology_stack: string[]
          tracked_people: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          competitors?: string[]
          created_at?: string
          custom_topics?: string[]
          delivery_time?: string
          enabled?: boolean
          id?: string
          industry?: string
          investment_interests?: string[]
          key_markets?: string[]
          regulatory_bodies?: string[]
          technology_stack?: string[]
          tracked_people?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          competitors?: string[]
          created_at?: string
          custom_topics?: string[]
          delivery_time?: string
          enabled?: boolean
          id?: string
          industry?: string
          investment_interests?: string[]
          key_markets?: string[]
          regulatory_bodies?: string[]
          technology_stack?: string[]
          tracked_people?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      briefing_reports: {
        Row: {
          content: string
          created_at: string
          critical_items: number
          id: string
          monitoring_items: number
          significant_items: number
          sources_checked: number
          title: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          critical_items?: number
          id?: string
          monitoring_items?: number
          significant_items?: number
          sources_checked?: number
          title?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          critical_items?: number
          id?: string
          monitoring_items?: number
          significant_items?: number
          sources_checked?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
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
