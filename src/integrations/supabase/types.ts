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
      asha_alerts: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          rule_id: string | null
          rule_name: string
          severity: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          rule_id?: string | null
          rule_name: string
          severity?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          rule_id?: string | null
          rule_name?: string
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "asha_monitor_rules"
            referencedColumns: ["id"]
          },
        ]
      }
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
          session_id: string | null
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
          session_id?: string | null
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
          session_id?: string | null
          status?: string
          storage_path?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_datasets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "asha_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_entity_matches: {
        Row: {
          confidence: number
          created_at: string
          entity_a: Json
          entity_b: Json
          entity_type: string
          id: string
          match_fields: string[]
          status: string
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          entity_a: Json
          entity_b: Json
          entity_type?: string
          id?: string
          match_fields?: string[]
          status?: string
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          entity_a?: Json
          entity_b?: Json
          entity_type?: string
          id?: string
          match_fields?: string[]
          status?: string
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
      asha_monitor_rules: {
        Row: {
          active: boolean
          condition: string
          created_at: string
          frequency: string
          id: string
          last_checked: string | null
          last_triggered: string | null
          name: string
          target: string
          threshold: string
          trigger_count: number
          user_id: string
        }
        Insert: {
          active?: boolean
          condition: string
          created_at?: string
          frequency?: string
          id?: string
          last_checked?: string | null
          last_triggered?: string | null
          name: string
          target: string
          threshold: string
          trigger_count?: number
          user_id: string
        }
        Update: {
          active?: boolean
          condition?: string
          created_at?: string
          frequency?: string
          id?: string
          last_checked?: string | null
          last_triggered?: string | null
          name?: string
          target?: string
          threshold?: string
          trigger_count?: number
          user_id?: string
        }
        Relationships: []
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
      asha_sessions: {
        Row: {
          company_name: string
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
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
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
      code_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "code_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      code_snippets: {
        Row: {
          content: string
          created_at: string
          folder_id: string | null
          id: string
          language: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          folder_id?: string | null
          id?: string
          language?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          folder_id?: string | null
          id?: string
          language?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_snippets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "code_folders"
            referencedColumns: ["id"]
          },
        ]
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
      data_permissions: {
        Row: {
          created_at: string
          dataset_id: string | null
          id: string
          row_filter: Json | null
          sensitivity_level: string
          team_id: string
          user_id: string | null
          visible_columns: string[]
        }
        Insert: {
          created_at?: string
          dataset_id?: string | null
          id?: string
          row_filter?: Json | null
          sensitivity_level?: string
          team_id: string
          user_id?: string | null
          visible_columns?: string[]
        }
        Update: {
          created_at?: string
          dataset_id?: string | null
          id?: string
          row_filter?: Json | null
          sensitivity_level?: string
          team_id?: string
          user_id?: string | null
          visible_columns?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "data_permissions_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "asha_datasets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_permissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
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
      installed_plugins: {
        Row: {
          config: Json
          id: string
          installed_at: string
          plugin_id: string
          user_id: string
        }
        Insert: {
          config?: Json
          id?: string
          installed_at?: string
          plugin_id: string
          user_id: string
        }
        Update: {
          config?: Json
          id?: string
          installed_at?: string
          plugin_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installed_plugins_plugin_id_fkey"
            columns: ["plugin_id"]
            isOneToOne: false
            referencedRelation: "plugins"
            referencedColumns: ["id"]
          },
        ]
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
      notebook_cells: {
        Row: {
          cell_type: string
          config: Json
          content: string
          created_at: string
          id: string
          notebook_id: string
          output: string | null
          position: number
          updated_at: string
        }
        Insert: {
          cell_type?: string
          config?: Json
          content?: string
          created_at?: string
          id?: string
          notebook_id: string
          output?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          cell_type?: string
          config?: Json
          content?: string
          created_at?: string
          id?: string
          notebook_id?: string
          output?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_cells_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_comments: {
        Row: {
          cell_id: string | null
          content: string
          created_at: string
          id: string
          notebook_id: string
          parent_id: string | null
          user_id: string
        }
        Insert: {
          cell_id?: string | null
          content: string
          created_at?: string
          id?: string
          notebook_id: string
          parent_id?: string | null
          user_id: string
        }
        Update: {
          cell_id?: string | null
          content?: string
          created_at?: string
          id?: string
          notebook_id?: string
          parent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_comments_cell_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "notebook_cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_comments_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "notebook_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_shares: {
        Row: {
          created_at: string
          id: string
          notebook_id: string
          permission: string
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notebook_id: string
          permission?: string
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notebook_id?: string
          permission?: string
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notebook_shares_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebook_shares_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_versions: {
        Row: {
          change_summary: string
          changed_by: string
          created_at: string
          id: string
          notebook_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          change_summary?: string
          changed_by: string
          created_at?: string
          id?: string
          notebook_id: string
          snapshot?: Json
          version: number
        }
        Update: {
          change_summary?: string
          changed_by?: string
          created_at?: string
          id?: string
          notebook_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notebook_versions_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          created_at: string
          description: string
          id: string
          last_run_at: string | null
          owner_id: string
          schedule: string | null
          status: string
          tags: string[]
          team_id: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          last_run_at?: string | null
          owner_id: string
          schedule?: string | null
          status?: string
          tags?: string[]
          team_id?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          last_run_at?: string | null
          owner_id?: string
          schedule?: string | null
          status?: string
          tags?: string[]
          team_id?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "notebooks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      plugins: {
        Row: {
          author: string
          category: string
          config_schema: Json
          created_at: string
          description: string
          downloads: number
          icon: string
          id: string
          is_premium: boolean
          name: string
          price_cents: number
          rating: number
          version: string
        }
        Insert: {
          author?: string
          category?: string
          config_schema?: Json
          created_at?: string
          description?: string
          downloads?: number
          icon?: string
          id?: string
          is_premium?: boolean
          name: string
          price_cents?: number
          rating?: number
          version?: string
        }
        Update: {
          author?: string
          category?: string
          config_schema?: Json
          created_at?: string
          description?: string
          downloads?: number
          icon?: string
          id?: string
          is_premium?: boolean
          name?: string
          price_cents?: number
          rating?: number
          version?: string
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
      team_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          team_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          status?: string
          team_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
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
      get_team_role: {
        Args: { _team_id: string; _user_id: string }
        Returns: string
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
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
