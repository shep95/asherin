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
      account_activity_log: {
        Row: {
          created_at: string | null
          description: string
          device_info: string | null
          event_type: string
          id: string
          ip_address: string | null
          location: string | null
          metadata: Json | null
          outcome: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          device_info?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          location?: string | null
          metadata?: Json | null
          outcome?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          device_info?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          location?: string | null
          metadata?: Json | null
          outcome?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_executions: {
        Row: {
          agent_id: string
          created_at: string
          duration: number | null
          error: string | null
          id: string
          results: Json | null
          status: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          duration?: number | null
          error?: string | null
          id?: string
          results?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          duration?: number | null
          error?: string | null
          id?: string
          results?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_executions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "automated_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_schedule: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          scheduled_for: string
          status: string
          user_id: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          scheduled_for: string
          status?: string
          user_id: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          scheduled_for?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_schedule_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "automated_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      algorithm_chat_usage: {
        Row: {
          bucket_key: string
          count: number
          id: string
          scope: string
          updated_at: string
          window_end: string
          window_start: string
        }
        Insert: {
          bucket_key: string
          count?: number
          id?: string
          scope: string
          updated_at?: string
          window_end: string
          window_start?: string
        }
        Update: {
          bucket_key?: string
          count?: number
          id?: string
          scope?: string
          updated_at?: string
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
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
          domain_profile: Json | null
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
          domain_profile?: Json | null
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
          domain_profile?: Json | null
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
      asha_document_entities: {
        Row: {
          confidence: number | null
          context: string | null
          created_at: string
          document_id: string
          entity_label: string | null
          entity_type: string
          entity_value: string
          id: string
          metadata: Json | null
          page_number: number | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          context?: string | null
          created_at?: string
          document_id: string
          entity_label?: string | null
          entity_type?: string
          entity_value: string
          id?: string
          metadata?: Json | null
          page_number?: number | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          context?: string | null
          created_at?: string
          document_id?: string
          entity_label?: string | null
          entity_type?: string
          entity_value?: string
          id?: string
          metadata?: Json | null
          page_number?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_document_entities_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "asha_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_document_links: {
        Row: {
          confidence: number | null
          created_at: string
          id: string
          link_reason: string | null
          link_type: string
          source_document_id: string
          target_document_id: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          id?: string
          link_reason?: string | null
          link_type?: string
          source_document_id: string
          target_document_id: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          id?: string
          link_reason?: string | null
          link_type?: string
          source_document_id?: string
          target_document_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_document_links_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "asha_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asha_document_links_target_document_id_fkey"
            columns: ["target_document_id"]
            isOneToOne: false
            referencedRelation: "asha_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_documents: {
        Row: {
          created_at: string
          doc_type: string
          extracted_text: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          language: string | null
          metadata: Json | null
          page_count: number | null
          session_id: string | null
          status: string
          storage_path: string
          summary: string | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          doc_type?: string
          extracted_text?: string | null
          file_name: string
          file_size?: number
          file_type?: string
          id?: string
          language?: string | null
          metadata?: Json | null
          page_count?: number | null
          session_id?: string | null
          status?: string
          storage_path: string
          summary?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          extracted_text?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          language?: string | null
          metadata?: Json | null
          page_count?: number | null
          session_id?: string | null
          status?: string
          storage_path?: string
          summary?: string | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_documents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "asha_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asha_documents_session_id_fkey_cascade"
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
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          response?: string
          response_type?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          response?: string
          response_type?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_queries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "asha_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      asha_reports: {
        Row: {
          content: string | null
          created_at: string
          id: string
          name: string
          pages: number | null
          schedule: string | null
          session_id: string | null
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
          session_id?: string | null
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
          session_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asha_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "asha_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      asher_agent_runs: {
        Row: {
          agent_id: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          findings: Json | null
          finished_at: string | null
          id: string
          output: Json | null
          source: string
          status: string
          steps: Json
          target_url: string | null
          task: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          findings?: Json | null
          finished_at?: string | null
          id?: string
          output?: Json | null
          source?: string
          status?: string
          steps?: Json
          target_url?: string | null
          task: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          findings?: Json | null
          finished_at?: string | null
          id?: string
          output?: Json | null
          source?: string
          status?: string
          steps?: Json
          target_url?: string | null
          task?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "asher_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_agents: {
        Row: {
          brain_categories: string[]
          category: string
          created_at: string
          description: string | null
          entry_html: string | null
          icon: string
          id: string
          install_count: number
          metadata: Json
          name: string
          org_id: string | null
          owner_id: string
          runtime: string
          source_tsx: string | null
          status: string
          system_prompt: string | null
          team_id: string | null
          updated_at: string
          version: number
          visibility: string
        }
        Insert: {
          brain_categories?: string[]
          category?: string
          created_at?: string
          description?: string | null
          entry_html?: string | null
          icon?: string
          id?: string
          install_count?: number
          metadata?: Json
          name: string
          org_id?: string | null
          owner_id: string
          runtime?: string
          source_tsx?: string | null
          status?: string
          system_prompt?: string | null
          team_id?: string | null
          updated_at?: string
          version?: number
          visibility?: string
        }
        Update: {
          brain_categories?: string[]
          category?: string
          created_at?: string
          description?: string | null
          entry_html?: string | null
          icon?: string
          id?: string
          install_count?: number
          metadata?: Json
          name?: string
          org_id?: string | null
          owner_id?: string
          runtime?: string
          source_tsx?: string | null
          status?: string
          system_prompt?: string | null
          team_id?: string | null
          updated_at?: string
          version?: number
          visibility?: string
        }
        Relationships: []
      }
      asher_ai_messages: {
        Row: {
          attachments: Json
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          attachments?: Json
          content?: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          attachments?: Json
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_ai_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "asher_ai_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_ai_messages_session_id_fkey_cascade"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "asher_ai_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_ai_sessions: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asher_audit_log: {
        Row: {
          created_at: string
          detail: Json
          event_type: string
          id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          event_type: string
          id?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: Json
          event_type?: string
          id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      asher_brains: {
        Row: {
          category: Database["public"]["Enums"]["asher_brain_category"]
          content: string
          created_at: string
          deleted_at: string | null
          description: string | null
          file_name: string
          file_path: string | null
          file_size: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["asher_brain_category"]
          content?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["asher_brain_category"]
          content?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_name?: string
          file_path?: string | null
          file_size?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      asher_channel_members: {
        Row: {
          added_at: string
          can_post: boolean
          channel_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          can_post?: boolean
          channel_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          can_post?: boolean
          channel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "asher_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_channels: {
        Row: {
          classification: Database["public"]["Enums"]["asher_classification"]
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["asher_channel_kind"]
          org_id: string | null
          section_id: string | null
          slug: string
          team_id: string | null
        }
        Insert: {
          classification?: Database["public"]["Enums"]["asher_classification"]
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["asher_channel_kind"]
          org_id?: string | null
          section_id?: string | null
          slug: string
          team_id?: string | null
        }
        Update: {
          classification?: Database["public"]["Enums"]["asher_classification"]
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["asher_channel_kind"]
          org_id?: string | null
          section_id?: string | null
          slug?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asher_channels_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "asher_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_channels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "asher_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_channels_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "asher_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_channels_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "asher_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_code_agents: {
        Row: {
          config: Json
          created_at: string
          enabled: boolean
          goal: string
          id: string
          last_result: Json | null
          last_run_at: string | null
          name: string
          session_id: string | null
          status: string
          trigger: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          enabled?: boolean
          goal: string
          id?: string
          last_result?: Json | null
          last_run_at?: string | null
          name: string
          session_id?: string | null
          status?: string
          trigger?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          enabled?: boolean
          goal?: string
          id?: string
          last_result?: Json | null
          last_run_at?: string | null
          name?: string
          session_id?: string | null
          status?: string
          trigger?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asher_code_branches: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_branch_id: string | null
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_branch_id?: string | null
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_branch_id?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_code_branches_parent_branch_id_fkey"
            columns: ["parent_branch_id"]
            isOneToOne: false
            referencedRelation: "asher_code_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_code_branches_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "asher_code_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_code_branches_project_id_fkey_cascade"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "asher_code_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_code_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          owner_id: string
          project_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          owner_id: string
          project_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          owner_id?: string
          project_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_code_chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "asher_code_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_code_chat_messages_project_id_fkey_cascade"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "asher_code_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_code_embeddings: {
        Row: {
          chunk_index: number
          content: string
          content_hash: string
          created_at: string
          embedding: string
          file_id: string
          file_path: string
          id: string
          language: string | null
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chunk_index?: number
          content: string
          content_hash: string
          created_at?: string
          embedding: string
          file_id: string
          file_path: string
          id?: string
          language?: string | null
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          content_hash?: string
          created_at?: string
          embedding?: string
          file_id?: string
          file_path?: string
          id?: string
          language?: string | null
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_code_embeddings_project_id_fkey_cascade"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "asher_code_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_code_files: {
        Row: {
          branch_id: string | null
          content: string
          created_at: string
          id: string
          language: string
          path: string
          project_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          content?: string
          created_at?: string
          id?: string
          language?: string
          path: string
          project_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          content?: string
          created_at?: string
          id?: string
          language?: string
          path?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_code_files_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "asher_code_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_code_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "asher_code_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_code_files_project_id_fkey_cascade"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "asher_code_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_code_projects: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          id: string
          language: string
          name: string
          org_id: string | null
          owner_id: string
          team_id: string | null
          template: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["asher_code_visibility"]
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          language?: string
          name: string
          org_id?: string | null
          owner_id: string
          team_id?: string | null
          template?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["asher_code_visibility"]
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          language?: string
          name?: string
          org_id?: string | null
          owner_id?: string
          team_id?: string | null
          template?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["asher_code_visibility"]
        }
        Relationships: []
      }
      asher_code_published_tabs: {
        Row: {
          category: string
          created_at: string
          description: string | null
          entry_html: string
          icon: string
          id: string
          install_count: number
          name: string
          org_id: string | null
          owner_id: string
          project_id: string
          rating: number | null
          team_id: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["asher_code_visibility"]
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          entry_html: string
          icon?: string
          id?: string
          install_count?: number
          name: string
          org_id?: string | null
          owner_id: string
          project_id: string
          rating?: number | null
          team_id?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["asher_code_visibility"]
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          entry_html?: string
          icon?: string
          id?: string
          install_count?: number
          name?: string
          org_id?: string | null
          owner_id?: string
          project_id?: string
          rating?: number | null
          team_id?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["asher_code_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "asher_code_published_tabs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "asher_code_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_code_tab_installs: {
        Row: {
          id: string
          installed_at: string
          tab_id: string
          user_id: string
        }
        Insert: {
          id?: string
          installed_at?: string
          tab_id: string
          user_id: string
        }
        Update: {
          id?: string
          installed_at?: string
          tab_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_code_tab_installs_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "asher_code_published_tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_comms_audit: {
        Row: {
          action: string
          actor_id: string | null
          conversation_id: string | null
          created_at: string
          id: string
          message_id: string | null
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      asher_conversation_members: {
        Row: {
          conversation_id: string
          joined_at: string
          last_read_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string
          last_read_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "asher_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_conversation_members_conversation_id_fkey_cascade"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "asher_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_conversations: {
        Row: {
          archived_at: string | null
          classification: string
          created_at: string
          created_by: string
          id: string
          kind: string
          name: string | null
          topic: string | null
        }
        Insert: {
          archived_at?: string | null
          classification?: string
          created_at?: string
          created_by: string
          id?: string
          kind: string
          name?: string | null
          topic?: string | null
        }
        Update: {
          archived_at?: string | null
          classification?: string
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          name?: string | null
          topic?: string | null
        }
        Relationships: []
      }
      asher_departments: {
        Row: {
          code: string | null
          created_at: string
          default_classification: Database["public"]["Enums"]["asher_classification"]
          description: string | null
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          default_classification?: Database["public"]["Enums"]["asher_classification"]
          description?: string | null
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          default_classification?: Database["public"]["Enums"]["asher_classification"]
          description?: string | null
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_departments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "asher_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_gate_attempts: {
        Row: {
          created_at: string
          failed_count: number
          fingerprint: string
          first_failure_at: string
          id: string
          last_failure_at: string
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          failed_count?: number
          fingerprint: string
          first_failure_at?: string
          id?: string
          last_failure_at?: string
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          failed_count?: number
          fingerprint?: string
          first_failure_at?: string
          id?: string
          last_failure_at?: string
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      asher_identity_keys: {
        Row: {
          algorithm: string
          created_at: string
          key_fingerprint: string
          public_key: Json
          rotated_at: string | null
          user_id: string
        }
        Insert: {
          algorithm?: string
          created_at?: string
          key_fingerprint: string
          public_key: Json
          rotated_at?: string | null
          user_id: string
        }
        Update: {
          algorithm?: string
          created_at?: string
          key_fingerprint?: string
          public_key?: Json
          rotated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      asher_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          clearance: Database["public"]["Enums"]["asher_classification"] | null
          created_at: string
          department_id: string | null
          email: string
          expires_at: string
          full_name: string | null
          id: string
          invited_by: string
          message: string | null
          org_id: string
          position: string | null
          rank: string | null
          role: Database["public"]["Enums"]["asher_role"]
          section_id: string | null
          status: Database["public"]["Enums"]["asher_invite_status"]
          team_id: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          clearance?: Database["public"]["Enums"]["asher_classification"] | null
          created_at?: string
          department_id?: string | null
          email: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by: string
          message?: string | null
          org_id: string
          position?: string | null
          rank?: string | null
          role: Database["public"]["Enums"]["asher_role"]
          section_id?: string | null
          status?: Database["public"]["Enums"]["asher_invite_status"]
          team_id?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          clearance?: Database["public"]["Enums"]["asher_classification"] | null
          created_at?: string
          department_id?: string | null
          email?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          invited_by?: string
          message?: string | null
          org_id?: string
          position?: string | null
          rank?: string | null
          role?: Database["public"]["Enums"]["asher_role"]
          section_id?: string | null
          status?: Database["public"]["Enums"]["asher_invite_status"]
          team_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_invitations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "asher_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "asher_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_invitations_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "asher_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "asher_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_message_keys: {
        Row: {
          ephemeral_pubkey: Json
          message_id: string
          recipient_id: string
          wrapped_key: string
        }
        Insert: {
          ephemeral_pubkey: Json
          message_id: string
          recipient_id: string
          wrapped_key: string
        }
        Update: {
          ephemeral_pubkey?: Json
          message_id?: string
          recipient_id?: string
          wrapped_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_message_keys_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "asher_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "asher_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_message_reads: {
        Row: {
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "asher_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_messages: {
        Row: {
          attachment_meta: Json | null
          ciphertext: string
          classification: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          expires_at: string | null
          hash: string
          id: string
          iv: string
          message_type: string
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          attachment_meta?: Json | null
          ciphertext: string
          classification?: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          hash: string
          id?: string
          iv: string
          message_type?: string
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          attachment_meta?: Json | null
          ciphertext?: string
          classification?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          expires_at?: string | null
          hash?: string
          id?: string
          iv?: string
          message_type?: string
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "asher_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_messages_conversation_id_fkey_cascade"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "asher_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "asher_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_operators: {
        Row: {
          callsign: string
          clearance: string
          created_at: string
          id: string
          invited_by: string | null
          last_seen_at: string | null
          rank: string | null
          status: string
          status_message: string | null
          user_id: string
        }
        Insert: {
          callsign: string
          clearance?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          last_seen_at?: string | null
          rank?: string | null
          status?: string
          status_message?: string | null
          user_id: string
        }
        Update: {
          callsign?: string
          clearance?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          last_seen_at?: string | null
          rank?: string | null
          status?: string
          status_message?: string | null
          user_id?: string
        }
        Relationships: []
      }
      asher_org_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["asher_role"] | null
          created_at: string
          id: string
          metadata: Json
          org_id: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["asher_role"] | null
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["asher_role"] | null
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asher_org_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "asher_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_org_connections: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          org_a: string
          org_b: string
          requested_by: string | null
          status: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          org_a: string
          org_b: string
          requested_by?: string | null
          status?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          org_a?: string
          org_b?: string
          requested_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_org_connections_org_a_fkey"
            columns: ["org_a"]
            isOneToOne: false
            referencedRelation: "asher_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_org_connections_org_b_fkey"
            columns: ["org_b"]
            isOneToOne: false
            referencedRelation: "asher_orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_org_memberships: {
        Row: {
          clearance: Database["public"]["Enums"]["asher_classification"] | null
          created_at: string
          department_id: string | null
          full_name: string | null
          id: string
          invited_by: string | null
          org_id: string
          position: string | null
          rank: string | null
          role: Database["public"]["Enums"]["asher_role"]
          section_id: string | null
          status: string
          team_id: string | null
          user_id: string
        }
        Insert: {
          clearance?: Database["public"]["Enums"]["asher_classification"] | null
          created_at?: string
          department_id?: string | null
          full_name?: string | null
          id?: string
          invited_by?: string | null
          org_id: string
          position?: string | null
          rank?: string | null
          role: Database["public"]["Enums"]["asher_role"]
          section_id?: string | null
          status?: string
          team_id?: string | null
          user_id: string
        }
        Update: {
          clearance?: Database["public"]["Enums"]["asher_classification"] | null
          created_at?: string
          department_id?: string | null
          full_name?: string | null
          id?: string
          invited_by?: string | null
          org_id?: string
          position?: string | null
          rank?: string | null
          role?: Database["public"]["Enums"]["asher_role"]
          section_id?: string | null
          status?: string
          team_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_org_memberships_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "asher_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "asher_orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_org_memberships_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "asher_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asher_org_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "asher_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_orgs: {
        Row: {
          code: string | null
          country: string | null
          created_at: string
          created_by: string | null
          data_residency: string | null
          id: string
          max_classification: Database["public"]["Enums"]["asher_classification"]
          name: string
          org_type: string | null
          plan: string
          status: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          data_residency?: string | null
          id?: string
          max_classification?: Database["public"]["Enums"]["asher_classification"]
          name: string
          org_type?: string | null
          plan?: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          data_residency?: string | null
          id?: string
          max_classification?: Database["public"]["Enums"]["asher_classification"]
          name?: string
          org_type?: string | null
          plan?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      asher_saved_targets: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          label: string
          lat: number
          lng: number
          notes: string | null
          payload: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          label: string
          lat: number
          lng: number
          notes?: string | null
          payload?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          label?: string
          lat?: number
          lng?: number
          notes?: string | null
          payload?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asher_sections: {
        Row: {
          created_at: string
          department_id: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          department_id: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          department_id?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_sections_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "asher_departments"
            referencedColumns: ["id"]
          },
        ]
      }
      asher_teams: {
        Row: {
          created_at: string
          focus: string | null
          id: string
          lead_user_id: string | null
          name: string
          section_id: string
        }
        Insert: {
          created_at?: string
          focus?: string | null
          id?: string
          lead_user_id?: string | null
          name: string
          section_id: string
        }
        Update: {
          created_at?: string
          focus?: string | null
          id?: string
          lead_user_id?: string | null
          name?: string
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asher_teams_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "asher_sections"
            referencedColumns: ["id"]
          },
        ]
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
      augur_falsifiers: {
        Row: {
          checks: number
          confidence: number
          created_at: string
          evidence: string | null
          falsifier: string
          forecast_key: string
          horizon_days: number
          id: string
          last_checked_at: string | null
          prediction: string
          resolved_at: string | null
          status: string
          surface: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checks?: number
          confidence?: number
          created_at?: string
          evidence?: string | null
          falsifier: string
          forecast_key: string
          horizon_days?: number
          id?: string
          last_checked_at?: string | null
          prediction: string
          resolved_at?: string | null
          status?: string
          surface?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checks?: number
          confidence?: number
          created_at?: string
          evidence?: string | null
          falsifier?: string
          forecast_key?: string
          horizon_days?: number
          id?: string
          last_checked_at?: string | null
          prediction?: string
          resolved_at?: string | null
          status?: string
          surface?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      aureon_vault_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          embedding: string
          id: string
          source_id: string
          token_count: number
          user_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          embedding: string
          id?: string
          source_id: string
          token_count?: number
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          source_id?: string
          token_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aureon_vault_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "aureon_vault_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      aureon_vault_sources: {
        Row: {
          api_headers: Json | null
          api_url: string | null
          byte_size: number
          chunk_count: number
          created_at: string
          error_message: string | null
          id: string
          last_refresh_at: string | null
          name: string
          refresh_minutes: number | null
          source_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_headers?: Json | null
          api_url?: string | null
          byte_size?: number
          chunk_count?: number
          created_at?: string
          error_message?: string | null
          id?: string
          last_refresh_at?: string | null
          name: string
          refresh_minutes?: number | null
          source_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_headers?: Json | null
          api_url?: string | null
          byte_size?: number
          chunk_count?: number
          created_at?: string
          error_message?: string | null
          id?: string
          last_refresh_at?: string | null
          name?: string
          refresh_minutes?: number | null
          source_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      automated_agents: {
        Row: {
          actions: Json
          created_at: string
          description: string | null
          failed_runs: number
          id: string
          last_run: string | null
          name: string
          next_run: string | null
          output_config: Json
          output_type: string
          settings: Json
          status: string
          successful_runs: number
          total_runs: number
          trigger_config: Json
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: Json
          created_at?: string
          description?: string | null
          failed_runs?: number
          id?: string
          last_run?: string | null
          name: string
          next_run?: string | null
          output_config?: Json
          output_type?: string
          settings?: Json
          status?: string
          successful_runs?: number
          total_runs?: number
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: Json
          created_at?: string
          description?: string | null
          failed_runs?: number
          id?: string
          last_run?: string | null
          name?: string
          next_run?: string | null
          output_config?: Json
          output_type?: string
          settings?: Json
          status?: string
          successful_runs?: number
          total_runs?: number
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ava_picks: {
        Row: {
          actual_winner: string | null
          away_team: string
          confidence: string
          created_at: string
          final_score: string | null
          game_id: string
          game_time: string
          home_team: string
          id: string
          league: string
          odds_analysis: Json | null
          pick_date: string
          picked_at: string
          popularity_score: number | null
          predicted_winner: string
          reasoning: string
          sharp_angle: string | null
          sport: string
          status: string
          updated_at: string
          validated_at: string | null
        }
        Insert: {
          actual_winner?: string | null
          away_team: string
          confidence?: string
          created_at?: string
          final_score?: string | null
          game_id: string
          game_time: string
          home_team: string
          id?: string
          league: string
          odds_analysis?: Json | null
          pick_date?: string
          picked_at?: string
          popularity_score?: number | null
          predicted_winner: string
          reasoning: string
          sharp_angle?: string | null
          sport: string
          status?: string
          updated_at?: string
          validated_at?: string | null
        }
        Update: {
          actual_winner?: string | null
          away_team?: string
          confidence?: string
          created_at?: string
          final_score?: string | null
          game_id?: string
          game_time?: string
          home_team?: string
          id?: string
          league?: string
          odds_analysis?: Json | null
          pick_date?: string
          picked_at?: string
          popularity_score?: number | null
          predicted_winner?: string
          reasoning?: string
          sharp_angle?: string | null
          sport?: string
          status?: string
          updated_at?: string
          validated_at?: string | null
        }
        Relationships: []
      }
      ava_win_stats: {
        Row: {
          id: string
          losses: number
          pending: number
          total_picks: number
          updated_at: string
          win_rate: number
          wins: number
        }
        Insert: {
          id?: string
          losses?: number
          pending?: number
          total_picks?: number
          updated_at?: string
          win_rate?: number
          wins?: number
        }
        Update: {
          id?: string
          losses?: number
          pending?: number
          total_picks?: number
          updated_at?: string
          win_rate?: number
          wins?: number
        }
        Relationships: []
      }
      axrlen_brains: {
        Row: {
          content: string
          created_at: string
          description: string | null
          file_name: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          description?: string | null
          file_name?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          description?: string | null
          file_name?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      axrlen_sessions: {
        Row: {
          ai_summary: string | null
          confidence_score: number | null
          created_at: string
          data_sources: Json | null
          deleted_at: string | null
          id: string
          policy_simulations: Json | null
          prediction_type: string
          predictions: Json | null
          region: string | null
          resource_analysis: Json | null
          status: string
          threat_assessment: Json | null
          timeline_divergences: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          confidence_score?: number | null
          created_at?: string
          data_sources?: Json | null
          deleted_at?: string | null
          id?: string
          policy_simulations?: Json | null
          prediction_type?: string
          predictions?: Json | null
          region?: string | null
          resource_analysis?: Json | null
          status?: string
          threat_assessment?: Json | null
          timeline_divergences?: Json | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          confidence_score?: number | null
          created_at?: string
          data_sources?: Json | null
          deleted_at?: string | null
          id?: string
          policy_simulations?: Json | null
          prediction_type?: string
          predictions?: Json | null
          region?: string | null
          resource_analysis?: Json | null
          status?: string
          threat_assessment?: Json | null
          timeline_divergences?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      aziion_bot_state: {
        Row: {
          created_at: string
          current_position_id: string | null
          emergency_reason: string | null
          emergency_stopped: boolean
          enabled: boolean
          id: string
          last_prediction_at: string | null
          next_prediction_at: string | null
          successful_trades: number
          total_pnl: number
          total_trades: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_position_id?: string | null
          emergency_reason?: string | null
          emergency_stopped?: boolean
          enabled?: boolean
          id?: string
          last_prediction_at?: string | null
          next_prediction_at?: string | null
          successful_trades?: number
          total_pnl?: number
          total_trades?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_position_id?: string | null
          emergency_reason?: string | null
          emergency_stopped?: boolean
          enabled?: boolean
          id?: string
          last_prediction_at?: string | null
          next_prediction_at?: string | null
          successful_trades?: number
          total_pnl?: number
          total_trades?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      aziion_sessions: {
        Row: {
          ai_prediction: string | null
          confidence_score: number | null
          created_at: string
          id: string
          predicted_direction: string | null
          predicted_entry: number | null
          predicted_sl: number | null
          predicted_tp: number | null
          prediction_type: string
          raw_intelligence: string | null
          status: string
          title: string
          trade_id: string | null
          trade_placed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_prediction?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          predicted_direction?: string | null
          predicted_entry?: number | null
          predicted_sl?: number | null
          predicted_tp?: number | null
          prediction_type?: string
          raw_intelligence?: string | null
          status?: string
          title?: string
          trade_id?: string | null
          trade_placed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_prediction?: string | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          predicted_direction?: string | null
          predicted_entry?: number | null
          predicted_sl?: number | null
          predicted_tp?: number | null
          prediction_type?: string
          raw_intelligence?: string | null
          status?: string
          title?: string
          trade_id?: string | null
          trade_placed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      aziion_trades: {
        Row: {
          closed_at: string | null
          created_at: string
          direction: string
          entry_price: number
          fees: number | null
          id: string
          leverage: number
          opened_at: string
          pnl: number | null
          position_size: number | null
          session_id: string | null
          signal_confidence: number | null
          signal_reasoning: string | null
          size_usd: number | null
          status: string
          stop_loss: number | null
          symbol: string
          take_profit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          direction: string
          entry_price: number
          fees?: number | null
          id?: string
          leverage?: number
          opened_at?: string
          pnl?: number | null
          position_size?: number | null
          session_id?: string | null
          signal_confidence?: number | null
          signal_reasoning?: string | null
          size_usd?: number | null
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          direction?: string
          entry_price?: number
          fees?: number | null
          id?: string
          leverage?: number
          opened_at?: string
          pnl?: number | null
          position_size?: number | null
          session_id?: string | null
          signal_confidence?: number | null
          signal_reasoning?: string | null
          size_usd?: number | null
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aziion_trades_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "aziion_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aziion_trades_session_id_fkey_cascade"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "aziion_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ble_devices: {
        Row: {
          alert_count: number
          closest_distance_m: number | null
          created_at: string
          display_name: string
          distinct_days: number
          distinct_places: number
          dossier: Json | null
          dossier_at: string | null
          encounter_count: number
          fingerprint: string
          first_seen: string
          id: string
          inferred_kind: string
          is_ignored: boolean
          is_self: boolean
          last_alert_at: string | null
          last_distance_m: number | null
          last_rssi: number | null
          last_seen: string
          manufacturer: string | null
          raw_name: string | null
          self_reason: string | null
          service_uuids: string[]
          sighting_count: number
          threat_tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_count?: number
          closest_distance_m?: number | null
          created_at?: string
          display_name?: string
          distinct_days?: number
          distinct_places?: number
          dossier?: Json | null
          dossier_at?: string | null
          encounter_count?: number
          fingerprint: string
          first_seen?: string
          id?: string
          inferred_kind?: string
          is_ignored?: boolean
          is_self?: boolean
          last_alert_at?: string | null
          last_distance_m?: number | null
          last_rssi?: number | null
          last_seen?: string
          manufacturer?: string | null
          raw_name?: string | null
          self_reason?: string | null
          service_uuids?: string[]
          sighting_count?: number
          threat_tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_count?: number
          closest_distance_m?: number | null
          created_at?: string
          display_name?: string
          distinct_days?: number
          distinct_places?: number
          dossier?: Json | null
          dossier_at?: string | null
          encounter_count?: number
          fingerprint?: string
          first_seen?: string
          id?: string
          inferred_kind?: string
          is_ignored?: boolean
          is_self?: boolean
          last_alert_at?: string | null
          last_distance_m?: number | null
          last_rssi?: number | null
          last_seen?: string
          manufacturer?: string | null
          raw_name?: string | null
          self_reason?: string | null
          service_uuids?: string[]
          sighting_count?: number
          threat_tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ble_owned_devices: {
        Row: {
          claimed_at: string
          created_at: string
          fingerprint: string
          id: string
          kind: string
          label: string
          missing_after_minutes: number
          notes: string | null
          recovered_at: string | null
          state: string
          stolen_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          created_at?: string
          fingerprint: string
          id?: string
          kind?: string
          label?: string
          missing_after_minutes?: number
          notes?: string | null
          recovered_at?: string | null
          state?: string
          stolen_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          created_at?: string
          fingerprint?: string
          id?: string
          kind?: string
          label?: string
          missing_after_minutes?: number
          notes?: string | null
          recovered_at?: string | null
          state?: string
          stolen_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ble_sightings: {
        Row: {
          accuracy_m: number | null
          created_at: string
          device_id: string
          distance_m: number | null
          id: string
          lat: number | null
          lng: number | null
          place_key: string | null
          rssi: number | null
          scanner_label: string | null
          seen_at: string
          session_id: string
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          created_at?: string
          device_id: string
          distance_m?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          place_key?: string | null
          rssi?: number | null
          scanner_label?: string | null
          seen_at?: string
          session_id: string
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          created_at?: string
          device_id?: string
          distance_m?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          place_key?: string | null
          rssi?: number | null
          scanner_label?: string | null
          seen_at?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ble_sightings_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "ble_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      ble_theft_audit: {
        Row: {
          created_at: string
          detail: Json
          event: string
          fingerprint: string
          id: string
          label: string
          last_lat: number | null
          last_lng: number | null
          last_seen_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: Json
          event: string
          fingerprint: string
          id?: string
          label?: string
          last_lat?: number | null
          last_lng?: number | null
          last_seen_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: Json
          event?: string
          fingerprint?: string
          id?: string
          label?: string
          last_lat?: number | null
          last_lng?: number | null
          last_seen_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      brains: {
        Row: {
          created_at: string
          description: string | null
          file_ids: string[] | null
          id: string
          is_active: boolean | null
          name: string
          system_prompt: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_ids?: string[] | null
          id?: string
          is_active?: boolean | null
          name: string
          system_prompt?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_ids?: string[] | null
          id?: string
          is_active?: boolean | null
          name?: string
          system_prompt?: string | null
          updated_at?: string
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
          id?: string
          monitoring_items?: number
          significant_items?: number
          sources_checked?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      btc_predictions: {
        Row: {
          confidence: number
          created_at: string
          direction: string
          entry_price: number
          generated_at: string
          horizon_hours: number
          id: string
          pnl_pct: number | null
          prediction_date: string
          reasoning: string | null
          settle_price: number | null
          settled_at: string | null
          status: string
          stop_loss: number
          take_profit: number
          thesis: string
        }
        Insert: {
          confidence: number
          created_at?: string
          direction: string
          entry_price: number
          generated_at?: string
          horizon_hours?: number
          id?: string
          pnl_pct?: number | null
          prediction_date: string
          reasoning?: string | null
          settle_price?: number | null
          settled_at?: string | null
          status?: string
          stop_loss: number
          take_profit: number
          thesis: string
        }
        Update: {
          confidence?: number
          created_at?: string
          direction?: string
          entry_price?: number
          generated_at?: string
          horizon_hours?: number
          id?: string
          pnl_pct?: number | null
          prediction_date?: string
          reasoning?: string | null
          settle_price?: number | null
          settled_at?: string | null
          status?: string
          stop_loss?: number
          take_profit?: number
          thesis?: string
        }
        Relationships: []
      }
      bug_report_summaries: {
        Row: {
          bug_count: number
          created_at: string
          feature_count: number
          id: string
          report_ids: string[]
          summary: string
        }
        Insert: {
          bug_count?: number
          created_at?: string
          feature_count?: number
          id?: string
          report_ids?: string[]
          summary: string
        }
        Update: {
          bug_count?: number
          created_at?: string
          feature_count?: number
          id?: string
          report_ids?: string[]
          summary?: string
        }
        Relationships: []
      }
      bug_reports: {
        Row: {
          created_at: string
          description: string
          id: string
          severity: string
          status: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          severity?: string
          status?: string
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          severity?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
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
      chart_notes: {
        Row: {
          chart_key: string
          chart_label: string
          created_at: string
          id: string
          note: string
          source: string
          user_id: string
        }
        Insert: {
          chart_key: string
          chart_label: string
          created_at?: string
          id?: string
          note: string
          source?: string
          user_id: string
        }
        Update: {
          chart_key?: string
          chart_label?: string
          created_at?: string
          id?: string
          note?: string
          source?: string
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
          {
            foreignKeyName: "code_snippets_folder_id_fkey_setnull"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "code_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      coding_laws: {
        Row: {
          active: boolean
          created_at: string
          domain: string
          era: string
          generation_method: string | null
          id: string
          law: string
          law_number: string
          name: string
          parent_law_ids: string[] | null
          rationale: string
          severity: string
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          domain: string
          era: string
          generation_method?: string | null
          id?: string
          law: string
          law_number: string
          name: string
          parent_law_ids?: string[] | null
          rationale: string
          severity?: string
          source?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          domain?: string
          era?: string
          generation_method?: string | null
          id?: string
          law?: string
          law_number?: string
          name?: string
          parent_law_ids?: string[] | null
          rationale?: string
          severity?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      coding_laws_engine_runs: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          laws_created: number
          laws_cross_referenced: number
          laws_discovered: number
          run_type: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          laws_created?: number
          laws_cross_referenced?: number
          laws_discovered?: number
          run_type?: string
          status?: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          laws_created?: number
          laws_cross_referenced?: number
          laws_discovered?: number
          run_type?: string
          status?: string
        }
        Relationships: []
      }
      community_posts: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          replies_count: number
          status: string
          title: string
          updated_at: string
          user_id: string
          votes: number
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          replies_count?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
          votes?: number
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          replies_count?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          votes?: number
        }
        Relationships: []
      }
      community_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_replies_post_id_fkey_cascade"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_votes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
          vote_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_votes_post_id_fkey_cascade"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          archived: boolean
          branches: Json | null
          created_at: string
          deleted_at: string | null
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
          branches?: Json | null
          created_at?: string
          deleted_at?: string | null
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
          branches?: Json | null
          created_at?: string
          deleted_at?: string | null
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
      cron_tokens: {
        Row: {
          created_at: string
          name: string
          token: string
        }
        Insert: {
          created_at?: string
          name: string
          token: string
        }
        Update: {
          created_at?: string
          name?: string
          token?: string
        }
        Relationships: []
      }
      cross_sessions: {
        Row: {
          ai_summary: string | null
          alerts_fired: number
          created_at: string
          credits_used: number
          duration: number
          frames_analyzed: number
          frames_skipped: number
          id: string
          mode: string
          psych_profiles: Json | null
          recording_url: string | null
          settings: Json | null
          status: string
          tags: string[] | null
          title: string
          transcript: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          alerts_fired?: number
          created_at?: string
          credits_used?: number
          duration?: number
          frames_analyzed?: number
          frames_skipped?: number
          id?: string
          mode?: string
          psych_profiles?: Json | null
          recording_url?: string | null
          settings?: Json | null
          status?: string
          tags?: string[] | null
          title?: string
          transcript?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          alerts_fired?: number
          created_at?: string
          credits_used?: number
          duration?: number
          frames_analyzed?: number
          frames_skipped?: number
          id?: string
          mode?: string
          psych_profiles?: Json | null
          recording_url?: string | null
          settings?: Json | null
          status?: string
          tags?: string[] | null
          title?: string
          transcript?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cross_workflows: {
        Row: {
          created_at: string
          edges: Json
          end_time: string | null
          id: string
          insights: Json
          metrics: Json
          name: string
          nodes: Json
          optimizations: Json
          phases: Json
          session_id: string | null
          start_time: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          edges?: Json
          end_time?: string | null
          id?: string
          insights?: Json
          metrics?: Json
          name?: string
          nodes?: Json
          optimizations?: Json
          phases?: Json
          session_id?: string | null
          start_time?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          edges?: Json
          end_time?: string | null
          id?: string
          insights?: Json
          metrics?: Json
          name?: string
          nodes?: Json
          optimizations?: Json
          phases?: Json
          session_id?: string | null
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cross_workflows_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cross_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_source_lists: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          domains: string[] | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          domains?: string[] | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          domains?: string[] | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
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
      ebook_sessions: {
        Row: {
          about_author: string | null
          author: string | null
          chapters: Json | null
          copyright: string | null
          created_at: string
          dedication: string | null
          description: string | null
          id: string
          settings: Json
          status: string
          subtitle: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          about_author?: string | null
          author?: string | null
          chapters?: Json | null
          copyright?: string | null
          created_at?: string
          dedication?: string | null
          description?: string | null
          id?: string
          settings?: Json
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          about_author?: string | null
          author?: string | null
          chapters?: Json | null
          copyright?: string | null
          created_at?: string
          dedication?: string | null
          description?: string | null
          id?: string
          settings?: Json
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ebook_text_uploads: {
        Row: {
          content: string
          created_at: string
          file_name: string
          id: string
          session_id: string
          user_id: string
          word_count: number
        }
        Insert: {
          content?: string
          created_at?: string
          file_name?: string
          id?: string
          session_id: string
          user_id: string
          word_count?: number
        }
        Update: {
          content?: string
          created_at?: string
          file_name?: string
          id?: string
          session_id?: string
          user_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ebook_text_uploads_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ebook_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebook_text_uploads_session_id_fkey_cascade"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ebook_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      entity_watchlist: {
        Row: {
          alert_frequency: string | null
          created_at: string | null
          description: string | null
          enabled: boolean | null
          entity_type: string
          entity_value: string
          id: string
          last_checked_at: string | null
          mention_count: number | null
          metadata: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_frequency?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          entity_type: string
          entity_value: string
          id?: string
          last_checked_at?: string | null
          mention_count?: number | null
          metadata?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_frequency?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          entity_type?: string
          entity_value?: string
          id?: string
          last_checked_at?: string | null
          mention_count?: number | null
          metadata?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      forum_post_votes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "forum_post_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          author_name: string | null
          body: string
          category: Database["public"]["Enums"]["forum_category"]
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          body: string
          category?: Database["public"]["Enums"]["forum_category"]
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          body?: string
          category?: Database["public"]["Enums"]["forum_category"]
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      forum_replies: {
        Row: {
          author_name: string | null
          body: string
          created_at: string
          id: string
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          body: string
          created_at?: string
          id?: string
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      gematria_entries: {
        Row: {
          chaldean: number
          created_at: string
          id: string
          normalized: string
          ordinal: number
          phrase: string
          reduction: number
          reverse_ordinal: number
          user_id: string
        }
        Insert: {
          chaldean: number
          created_at?: string
          id?: string
          normalized: string
          ordinal: number
          phrase: string
          reduction: number
          reverse_ordinal: number
          user_id: string
        }
        Update: {
          chaldean?: number
          created_at?: string
          id?: string
          normalized?: string
          ordinal?: number
          phrase?: string
          reduction?: number
          reverse_ordinal?: number
          user_id?: string
        }
        Relationships: []
      }
      geo_risk_assessments: {
        Row: {
          expires_at: string
          generated_at: string
          id: string
          lat: number
          lng: number
          payload: Json
          place_key: string
          place_label: string | null
          risk_level: string
          risk_score: number
          summary: string | null
        }
        Insert: {
          expires_at?: string
          generated_at?: string
          id?: string
          lat: number
          lng: number
          payload?: Json
          place_key: string
          place_label?: string | null
          risk_level?: string
          risk_score?: number
          summary?: string | null
        }
        Update: {
          expires_at?: string
          generated_at?: string
          id?: string
          lat?: number
          lng?: number
          payload?: Json
          place_key?: string
          place_label?: string | null
          risk_level?: string
          risk_score?: number
          summary?: string | null
        }
        Relationships: []
      }
      geo_risk_events: {
        Row: {
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          notified: boolean
          place_key: string
          place_label: string | null
          risk_level: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notified?: boolean
          place_key: string
          place_label?: string | null
          risk_level?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          notified?: boolean
          place_key?: string
          place_label?: string | null
          risk_level?: string
          user_id?: string
        }
        Relationships: []
      }
      ghost_entity_history: {
        Row: {
          anomalies: number
          created_at: string
          elapsed_ms: number
          entity_key: string
          entity_kind: string
          entity_label: string
          id: string
          leads_found: number
          probed: number
          query: string
          results: Json
          scope: string
          summary: Json
          user_id: string
        }
        Insert: {
          anomalies?: number
          created_at?: string
          elapsed_ms?: number
          entity_key: string
          entity_kind: string
          entity_label: string
          id?: string
          leads_found?: number
          probed?: number
          query: string
          results?: Json
          scope?: string
          summary?: Json
          user_id: string
        }
        Update: {
          anomalies?: number
          created_at?: string
          elapsed_ms?: number
          entity_key?: string
          entity_kind?: string
          entity_label?: string
          id?: string
          leads_found?: number
          probed?: number
          query?: string
          results?: Json
          scope?: string
          summary?: Json
          user_id?: string
        }
        Relationships: []
      }
      ghost_sessions: {
        Row: {
          captured_at: string
          content_bytes: number
          content_sha256: string | null
          content_text: string | null
          emails: string[]
          entropy: number | null
          expires_at: string
          filenames: string[]
          host: string
          id: string
          ipv4s: string[]
          is_encrypted: boolean
          language_tag: string | null
          phones: string[]
          session_id: string
          source_type: string
          status: number | null
          storage_path: string | null
          truncated: boolean
          url: string
          urls: string[]
          user_id: string
        }
        Insert: {
          captured_at?: string
          content_bytes?: number
          content_sha256?: string | null
          content_text?: string | null
          emails?: string[]
          entropy?: number | null
          expires_at: string
          filenames?: string[]
          host: string
          id?: string
          ipv4s?: string[]
          is_encrypted?: boolean
          language_tag?: string | null
          phones?: string[]
          session_id: string
          source_type?: string
          status?: number | null
          storage_path?: string | null
          truncated?: boolean
          url: string
          urls?: string[]
          user_id: string
        }
        Update: {
          captured_at?: string
          content_bytes?: number
          content_sha256?: string | null
          content_text?: string | null
          emails?: string[]
          entropy?: number | null
          expires_at?: string
          filenames?: string[]
          host?: string
          id?: string
          ipv4s?: string[]
          is_encrypted?: boolean
          language_tag?: string | null
          phones?: string[]
          session_id?: string
          source_type?: string
          status?: number | null
          storage_path?: string | null
          truncated?: boolean
          url?: string
          urls?: string[]
          user_id?: string
        }
        Relationships: []
      }
      gift_purchases: {
        Row: {
          addons: Json | null
          buyer_id: string
          created_at: string | null
          duration_months: number
          id: string
          recipient_email: string
          status: string
          stripe_session_id: string
          tier: string
        }
        Insert: {
          addons?: Json | null
          buyer_id: string
          created_at?: string | null
          duration_months: number
          id?: string
          recipient_email: string
          status?: string
          stripe_session_id: string
          tier: string
        }
        Update: {
          addons?: Json | null
          buyer_id?: string
          created_at?: string | null
          duration_months?: number
          id?: string
          recipient_email?: string
          status?: string
          stripe_session_id?: string
          tier?: string
        }
        Relationships: []
      }
      github_connections: {
        Row: {
          branch: string
          created_at: string
          github_token: string
          id: string
          last_sync_at: string | null
          repo_name: string
          repo_owner: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch?: string
          created_at?: string
          github_token: string
          id?: string
          last_sync_at?: string | null
          repo_name: string
          repo_owner: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch?: string
          created_at?: string
          github_token?: string
          id?: string
          last_sync_at?: string | null
          repo_name?: string
          repo_owner?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_accounts: {
        Row: {
          access_token: string
          avatar_url: string | null
          consent_tier: number
          created_at: string
          data_points_count: number
          display_name: string | null
          google_email: string
          id: string
          is_primary: boolean
          last_sync_at: string | null
          refresh_token: string
          scopes: string[]
          status: string
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          avatar_url?: string | null
          consent_tier?: number
          created_at?: string
          data_points_count?: number
          display_name?: string | null
          google_email: string
          id?: string
          is_primary?: boolean
          last_sync_at?: string | null
          refresh_token: string
          scopes?: string[]
          status?: string
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          avatar_url?: string | null
          consent_tier?: number
          created_at?: string
          data_points_count?: number
          display_name?: string | null
          google_email?: string
          id?: string
          is_primary?: boolean
          last_sync_at?: string | null
          refresh_token?: string
          scopes?: string[]
          status?: string
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_agency_audit: {
        Row: {
          action: string
          confirmed: boolean
          created_at: string
          google_email: string | null
          id: string
          payload: Json
          target: string | null
          user_id: string
        }
        Insert: {
          action: string
          confirmed?: boolean
          created_at?: string
          google_email?: string | null
          id?: string
          payload?: Json
          target?: string | null
          user_id: string
        }
        Update: {
          action?: string
          confirmed?: boolean
          created_at?: string
          google_email?: string | null
          id?: string
          payload?: Json
          target?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_attention_windows: {
        Row: {
          created_at: string
          day: string
          detail: Json
          first_activity_hour: number | null
          focus_minutes: number
          fragmentation: number
          id: string
          last_activity_hour: number | null
          meeting_minutes: number
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          detail?: Json
          first_activity_hour?: number | null
          focus_minutes?: number
          fragmentation?: number
          id?: string
          last_activity_hour?: number | null
          meeting_minutes?: number
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          detail?: Json
          first_activity_hour?: number | null
          focus_minutes?: number
          fragmentation?: number
          id?: string
          last_activity_hour?: number | null
          meeting_minutes?: number
          user_id?: string
        }
        Relationships: []
      }
      google_insights: {
        Row: {
          code: string
          computed_at: string
          detail: string
          dismissed: boolean
          domain: string
          evidence: Json
          first_seen_at: string
          id: string
          metric: Json
          severity: number
          subject_key: string
          title: string
          user_id: string
        }
        Insert: {
          code: string
          computed_at?: string
          detail?: string
          dismissed?: boolean
          domain: string
          evidence?: Json
          first_seen_at?: string
          id?: string
          metric?: Json
          severity?: number
          subject_key?: string
          title: string
          user_id: string
        }
        Update: {
          code?: string
          computed_at?: string
          detail?: string
          dismissed?: boolean
          domain?: string
          evidence?: Json
          first_seen_at?: string
          id?: string
          metric?: Json
          severity?: number
          subject_key?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      google_intel_devices: {
        Row: {
          device_id: string
          label: string | null
          last_push_at: string | null
          last_seen_at: string
          platform: string | null
          user_id: string
        }
        Insert: {
          device_id: string
          label?: string | null
          last_push_at?: string | null
          last_seen_at?: string
          platform?: string | null
          user_id: string
        }
        Update: {
          device_id?: string
          label?: string | null
          last_push_at?: string | null
          last_seen_at?: string
          platform?: string | null
          user_id?: string
        }
        Relationships: []
      }
      google_intel_snapshots: {
        Row: {
          bytes: number
          device_id: string
          device_label: string | null
          kind: string
          payload: Json
          saved_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bytes?: number
          device_id?: string
          device_label?: string | null
          kind?: string
          payload: Json
          saved_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bytes?: number
          device_id?: string
          device_label?: string | null
          kind?: string
          payload?: Json
          saved_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_meet_artifacts: {
        Row: {
          account_id: string | null
          created_at: string
          drive_file_id: string
          duration_ms: number | null
          file_created_at: string | null
          id: string
          kind: string
          mime_type: string | null
          name: string | null
          session_id: string | null
          size_bytes: number | null
          thumbnail_link: string | null
          updated_at: string
          user_id: string
          web_view_link: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          drive_file_id: string
          duration_ms?: number | null
          file_created_at?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          name?: string | null
          session_id?: string | null
          size_bytes?: number | null
          thumbnail_link?: string | null
          updated_at?: string
          user_id: string
          web_view_link?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string
          drive_file_id?: string
          duration_ms?: number | null
          file_created_at?: string | null
          id?: string
          kind?: string
          mime_type?: string | null
          name?: string | null
          session_id?: string | null
          size_bytes?: number | null
          thumbnail_link?: string | null
          updated_at?: string
          user_id?: string
          web_view_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_meet_artifacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "google_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_meet_artifacts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "google_meet_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      google_meet_sessions: {
        Row: {
          account_id: string | null
          conference_code: string | null
          created_at: string
          dedupe_key: string
          ended_at: string | null
          id: string
          meet_link: string | null
          organizer_email: string | null
          participants: Json
          source: string
          space_name: string | null
          started_at: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          conference_code?: string | null
          created_at?: string
          dedupe_key: string
          ended_at?: string | null
          id?: string
          meet_link?: string | null
          organizer_email?: string | null
          participants?: Json
          source?: string
          space_name?: string | null
          started_at?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          conference_code?: string | null
          created_at?: string
          dedupe_key?: string
          ended_at?: string | null
          id?: string
          meet_link?: string | null
          organizer_email?: string | null
          participants?: Json
          source?: string
          space_name?: string | null
          started_at?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_meet_sessions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "google_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      google_place_nodes: {
        Row: {
          created_at: string
          first_seen: string | null
          id: string
          label: string
          last_seen: string | null
          latitude: number | null
          longitude: number | null
          normalized_key: string
          sources: Json
          updated_at: string
          user_id: string
          visit_count: number
        }
        Insert: {
          created_at?: string
          first_seen?: string | null
          id?: string
          label: string
          last_seen?: string | null
          latitude?: number | null
          longitude?: number | null
          normalized_key: string
          sources?: Json
          updated_at?: string
          user_id: string
          visit_count?: number
        }
        Update: {
          created_at?: string
          first_seen?: string | null
          id?: string
          label?: string
          last_seen?: string | null
          latitude?: number | null
          longitude?: number | null
          normalized_key?: string
          sources?: Json
          updated_at?: string
          user_id?: string
          visit_count?: number
        }
        Relationships: []
      }
      google_signals: {
        Row: {
          account_email: string | null
          account_id: string | null
          actor_email: string | null
          actor_name: string | null
          amount: number | null
          counterparties: string[]
          created_at: string
          currency: string | null
          direction: string | null
          external_id: string
          fingerprint: string
          id: string
          kind: string
          metadata: Json
          occurred_at: string | null
          people_text: string
          search: unknown
          snippet: string | null
          source: string
          subject: string | null
          user_id: string
        }
        Insert: {
          account_email?: string | null
          account_id?: string | null
          actor_email?: string | null
          actor_name?: string | null
          amount?: number | null
          counterparties?: string[]
          created_at?: string
          currency?: string | null
          direction?: string | null
          external_id: string
          fingerprint: string
          id?: string
          kind: string
          metadata?: Json
          occurred_at?: string | null
          people_text?: string
          search?: unknown
          snippet?: string | null
          source: string
          subject?: string | null
          user_id: string
        }
        Update: {
          account_email?: string | null
          account_id?: string | null
          actor_email?: string | null
          actor_name?: string | null
          amount?: number | null
          counterparties?: string[]
          created_at?: string
          currency?: string | null
          direction?: string | null
          external_id?: string
          fingerprint?: string
          id?: string
          kind?: string
          metadata?: Json
          occurred_at?: string | null
          people_text?: string
          search?: unknown
          snippet?: string | null
          source?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_signals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "google_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      google_sweeps: {
        Row: {
          account_id: string | null
          cursor: string | null
          error: string | null
          id: string
          last_run_at: string | null
          signals_ingested: number
          source: string
          status: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          cursor?: string | null
          error?: string | null
          id?: string
          last_run_at?: string | null
          signals_ingested?: number
          source: string
          status?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          cursor?: string | null
          error?: string | null
          id?: string
          last_run_at?: string | null
          signals_ingested?: number
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_sweeps_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "google_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      google_sync_state: {
        Row: {
          consecutive_failures: number
          enabled: boolean
          insights_derived: number
          interval_minutes: number
          last_error: string | null
          last_started_at: string | null
          last_status: string
          last_synced_at: string | null
          next_due_at: string
          signals_ingested: number
          updated_at: string
          user_id: string
        }
        Insert: {
          consecutive_failures?: number
          enabled?: boolean
          insights_derived?: number
          interval_minutes?: number
          last_error?: string | null
          last_started_at?: string | null
          last_status?: string
          last_synced_at?: string | null
          next_due_at?: string
          signals_ingested?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          consecutive_failures?: number
          enabled?: boolean
          insights_derived?: number
          interval_minutes?: number
          last_error?: string | null
          last_started_at?: string | null
          last_status?: string
          last_synced_at?: string | null
          next_due_at?: string
          signals_ingested?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_voiceprints: {
        Row: {
          account_id: string | null
          built_at: string
          created_at: string
          google_email: string
          id: string
          sample_count: number
          stylometry: Json
          user_id: string
        }
        Insert: {
          account_id?: string | null
          built_at?: string
          created_at?: string
          google_email: string
          id?: string
          sample_count?: number
          stylometry?: Json
          user_id: string
        }
        Update: {
          account_id?: string | null
          built_at?: string
          created_at?: string
          google_email?: string
          id?: string
          sample_count?: number
          stylometry?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_voiceprints_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "google_accounts"
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
      hoa_audit: {
        Row: {
          action: string
          actor_handle: string | null
          actor_id: string | null
          created_at: string
          detail: string | null
          id: string
          server_id: string | null
          target: string | null
        }
        Insert: {
          action: string
          actor_handle?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          server_id?: string | null
          target?: string | null
        }
        Update: {
          action?: string
          actor_handle?: string | null
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          server_id?: string | null
          target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoa_audit_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "hoa_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_aureon_training_feed: {
        Row: {
          author_handle: string | null
          author_id: string | null
          body: string
          channel_kind: Database["public"]["Enums"]["hoa_channel_kind"]
          channel_name: string
          compartments: string[]
          consumed_at: string | null
          id: string
          ingested_at: string
          message_id: string
          meta: Json
          sealed: boolean
          server_code: string
          server_id: string
        }
        Insert: {
          author_handle?: string | null
          author_id?: string | null
          body: string
          channel_kind: Database["public"]["Enums"]["hoa_channel_kind"]
          channel_name: string
          compartments?: string[]
          consumed_at?: string | null
          id?: string
          ingested_at?: string
          message_id: string
          meta?: Json
          sealed?: boolean
          server_code: string
          server_id: string
        }
        Update: {
          author_handle?: string | null
          author_id?: string | null
          body?: string
          channel_kind?: Database["public"]["Enums"]["hoa_channel_kind"]
          channel_name?: string
          compartments?: string[]
          consumed_at?: string | null
          id?: string
          ingested_at?: string
          message_id?: string
          meta?: Json
          sealed?: boolean
          server_code?: string
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoa_aureon_training_feed_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "hoa_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoa_aureon_training_feed_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "hoa_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_channels: {
        Row: {
          compartments: string[]
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["hoa_channel_kind"]
          min_clearance: number
          name: string
          server_id: string
          topic: string | null
        }
        Insert: {
          compartments?: string[]
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["hoa_channel_kind"]
          min_clearance?: number
          name: string
          server_id: string
          topic?: string | null
        }
        Update: {
          compartments?: string[]
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["hoa_channel_kind"]
          min_clearance?: number
          name?: string
          server_id?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hoa_channels_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "hoa_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_invites: {
        Row: {
          clearance_grant: number
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number
          mirror_mothership: boolean
          role_grant: Database["public"]["Enums"]["hoa_server_role"]
          server_id: string
          uses: number
        }
        Insert: {
          clearance_grant?: number
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number
          mirror_mothership?: boolean
          role_grant?: Database["public"]["Enums"]["hoa_server_role"]
          server_id: string
          uses?: number
        }
        Update: {
          clearance_grant?: number
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number
          mirror_mothership?: boolean
          role_grant?: Database["public"]["Enums"]["hoa_server_role"]
          server_id?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "hoa_invites_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "hoa_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_member_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          member_id: string
          role_id: string
          server_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          member_id: string
          role_id: string
          server_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          member_id?: string
          role_id?: string
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoa_member_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "hoa_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoa_member_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "hoa_server_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoa_member_roles_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "hoa_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_members: {
        Row: {
          clearance_rank: number
          handle: string
          id: string
          joined_at: string
          rank_label: string
          role: Database["public"]["Enums"]["hoa_server_role"]
          server_id: string
          user_id: string
        }
        Insert: {
          clearance_rank?: number
          handle: string
          id?: string
          joined_at?: string
          rank_label?: string
          role?: Database["public"]["Enums"]["hoa_server_role"]
          server_id: string
          user_id: string
        }
        Update: {
          clearance_rank?: number
          handle?: string
          id?: string
          joined_at?: string
          rank_label?: string
          role?: Database["public"]["Enums"]["hoa_server_role"]
          server_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoa_members_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "hoa_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_messages: {
        Row: {
          author_handle: string
          author_id: string
          body: string
          channel_id: string
          compartments: string[]
          created_at: string
          id: string
          pinned: boolean
          sealed: boolean
          server_id: string
        }
        Insert: {
          author_handle: string
          author_id: string
          body: string
          channel_id: string
          compartments?: string[]
          created_at?: string
          id?: string
          pinned?: boolean
          sealed?: boolean
          server_id: string
        }
        Update: {
          author_handle?: string
          author_id?: string
          body?: string
          channel_id?: string
          compartments?: string[]
          created_at?: string
          id?: string
          pinned?: boolean
          sealed?: boolean
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoa_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "hoa_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hoa_messages_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "hoa_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_server_roles: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          perm_invite: boolean
          perm_manage_api_key: boolean
          perm_manage_channels: boolean
          perm_manage_roles: boolean
          perm_send: boolean
          perm_view_audit: boolean
          server_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          perm_invite?: boolean
          perm_manage_api_key?: boolean
          perm_manage_channels?: boolean
          perm_manage_roles?: boolean
          perm_send?: boolean
          perm_view_audit?: boolean
          server_id: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          perm_invite?: boolean
          perm_manage_api_key?: boolean
          perm_manage_channels?: boolean
          perm_manage_roles?: boolean
          perm_send?: boolean
          perm_view_audit?: boolean
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hoa_server_roles_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "hoa_servers"
            referencedColumns: ["id"]
          },
        ]
      }
      hoa_servers: {
        Row: {
          api_key_ciphertext: string | null
          api_key_hint: string | null
          api_key_provider: string | null
          api_key_updated_at: string | null
          api_key_updated_by: string | null
          code: string
          country: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon_url: string | null
          id: string
          is_mothership: boolean
          name: string
        }
        Insert: {
          api_key_ciphertext?: string | null
          api_key_hint?: string | null
          api_key_provider?: string | null
          api_key_updated_at?: string | null
          api_key_updated_by?: string | null
          code: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_mothership?: boolean
          name: string
        }
        Update: {
          api_key_ciphertext?: string | null
          api_key_hint?: string | null
          api_key_provider?: string | null
          api_key_updated_at?: string | null
          api_key_updated_by?: string | null
          code?: string
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          is_mothership?: boolean
          name?: string
        }
        Relationships: []
      }
      honeypot_logs: {
        Row: {
          created_at: string
          fingerprint: string | null
          geo_country: string | null
          id: string
          request_data: Json
          source_ip: string | null
          trap_name: string
          trap_type: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          fingerprint?: string | null
          geo_country?: string | null
          id?: string
          request_data?: Json
          source_ip?: string | null
          trap_name: string
          trap_type?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          fingerprint?: string | null
          geo_country?: string | null
          id?: string
          request_data?: Json
          source_ip?: string | null
          trap_name?: string
          trap_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      hoodie_votes: {
        Row: {
          created_at: string
          id: string
          ip_hash: string
          user_agent: string | null
          vote: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash: string
          user_agent?: string | null
          vote: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string
          user_agent?: string | null
          vote?: string
        }
        Relationships: []
      }
      houseofasher_applications: {
        Row: {
          analysis: Json | null
          answers: Json
          company_name: string
          composite_score: number | null
          created_at: string
          decision: string | null
          founder_email: string
          founder_name: string
          id: string
          rejection_reason: string | null
          status: string
          success_probability: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          analysis?: Json | null
          answers?: Json
          company_name: string
          composite_score?: number | null
          created_at?: string
          decision?: string | null
          founder_email: string
          founder_name: string
          id?: string
          rejection_reason?: string | null
          status?: string
          success_probability?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          analysis?: Json | null
          answers?: Json
          company_name?: string
          composite_score?: number | null
          created_at?: string
          decision?: string | null
          founder_email?: string
          founder_name?: string
          id?: string
          rejection_reason?: string | null
          status?: string
          success_probability?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      ide_sessions: {
        Row: {
          active_file_id: string | null
          created_at: string
          deleted_at: string | null
          files: Json
          id: string
          name: string
          open_file_ids: string[]
          panel_config: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          active_file_id?: string | null
          created_at?: string
          deleted_at?: string | null
          files?: Json
          id?: string
          name?: string
          open_file_ids?: string[]
          panel_config?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          active_file_id?: string | null
          created_at?: string
          deleted_at?: string | null
          files?: Json
          id?: string
          name?: string
          open_file_ids?: string[]
          panel_config?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      imagine_sessions: {
        Row: {
          aureon_messages: Json
          created_at: string
          grid_h: number
          grid_w: number
          id: string
          name: string
          pixels: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          aureon_messages?: Json
          created_at?: string
          grid_h?: number
          grid_w?: number
          id?: string
          name?: string
          pixels?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          aureon_messages?: Json
          created_at?: string
          grid_h?: number
          grid_w?: number
          id?: string
          name?: string
          pixels?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      incident_responses: {
        Row: {
          action_taken: string
          auto_resolved: boolean
          created_at: string
          details: Json
          event_ids: string[]
          id: string
          incident_type: string
          resolved_at: string | null
          severity: string
          target_ip: string | null
          target_user_id: string | null
        }
        Insert: {
          action_taken: string
          auto_resolved?: boolean
          created_at?: string
          details?: Json
          event_ids?: string[]
          id?: string
          incident_type: string
          resolved_at?: string | null
          severity?: string
          target_ip?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_taken?: string
          auto_resolved?: boolean
          created_at?: string
          details?: Json
          event_ids?: string[]
          id?: string
          incident_type?: string
          resolved_at?: string | null
          severity?: string
          target_ip?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      installed_personas: {
        Row: {
          id: string
          installed_at: string
          persona_id: string
          user_id: string
        }
        Insert: {
          id?: string
          installed_at?: string
          persona_id: string
          user_id: string
        }
        Update: {
          id?: string
          installed_at?: string
          persona_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installed_personas_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "shared_personas"
            referencedColumns: ["id"]
          },
        ]
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
      intel_annotations: {
        Row: {
          color: string | null
          confidence_score: number | null
          created_at: string | null
          flag: string | null
          id: string
          note: string | null
          tags: string[] | null
          target_id: string
          target_type: string
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          color?: string | null
          confidence_score?: number | null
          created_at?: string | null
          flag?: string | null
          id?: string
          note?: string | null
          tags?: string[] | null
          target_id: string
          target_type: string
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          color?: string | null
          confidence_score?: number | null
          created_at?: string | null
          flag?: string | null
          id?: string
          note?: string | null
          tags?: string[] | null
          target_id?: string
          target_type?: string
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intel_annotations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "research_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_autonomous_runs: {
        Row: {
          consensus_score: number | null
          created_at: string
          duration_ms: number | null
          edges_created: number
          entities_touched: number
          id: string
          kind: string | null
          query: string
          subject: string | null
          summary: string | null
          tools_fired: string[]
          user_id: string
        }
        Insert: {
          consensus_score?: number | null
          created_at?: string
          duration_ms?: number | null
          edges_created?: number
          entities_touched?: number
          id?: string
          kind?: string | null
          query: string
          subject?: string | null
          summary?: string | null
          tools_fired?: string[]
          user_id: string
        }
        Update: {
          consensus_score?: number | null
          created_at?: string
          duration_ms?: number | null
          edges_created?: number
          entities_touched?: number
          id?: string
          kind?: string | null
          query?: string
          subject?: string | null
          summary?: string | null
          tools_fired?: string[]
          user_id?: string
        }
        Relationships: []
      }
      intel_job_queue: {
        Row: {
          created_at: string
          finished_at: string | null
          heartbeat_at: string
          id: string
          job_type: string
          queue_position: number | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          heartbeat_at?: string
          id?: string
          job_type?: string
          queue_position?: number | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          heartbeat_at?: string
          id?: string
          job_type?: string
          queue_position?: number | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      intel_memory_edges: {
        Row: {
          confidence: string
          created_at: string
          from_entity: string
          id: string
          relationship: string
          source_theory: string | null
          to_entity: string
          user_id: string
          weight: number
        }
        Insert: {
          confidence?: string
          created_at?: string
          from_entity: string
          id?: string
          relationship: string
          source_theory?: string | null
          to_entity: string
          user_id: string
          weight?: number
        }
        Update: {
          confidence?: string
          created_at?: string
          from_entity?: string
          id?: string
          relationship?: string
          source_theory?: string | null
          to_entity?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "intel_memory_edges_from_entity_fkey"
            columns: ["from_entity"]
            isOneToOne: false
            referencedRelation: "intel_memory_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intel_memory_edges_to_entity_fkey"
            columns: ["to_entity"]
            isOneToOne: false
            referencedRelation: "intel_memory_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      intel_memory_entities: {
        Row: {
          aliases: string[]
          attributes: Json
          canonical: string
          confidence: string
          first_seen: string
          hit_count: number
          id: string
          kind: string
          label: string
          last_seen: string
          notes: string | null
          user_id: string
        }
        Insert: {
          aliases?: string[]
          attributes?: Json
          canonical: string
          confidence?: string
          first_seen?: string
          hit_count?: number
          id?: string
          kind: string
          label: string
          last_seen?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          aliases?: string[]
          attributes?: Json
          canonical?: string
          confidence?: string
          first_seen?: string
          hit_count?: number
          id?: string
          kind?: string
          label?: string
          last_seen?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      intel_notification_prefs: {
        Row: {
          email_enabled: boolean
          in_app_enabled: boolean
          min_severity: string
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_enabled?: boolean
          in_app_enabled?: boolean
          min_severity?: string
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_enabled?: boolean
          in_app_enabled?: boolean
          min_severity?: string
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      intel_notifications: {
        Row: {
          body: string
          channels_delivered: string[]
          created_at: string
          findings: Json
          id: string
          idempotency_key: string | null
          kind: string
          photo_match: Json | null
          photos: Json
          read_at: string | null
          sections: Json
          severity: string
          source: string | null
          subject_name: string | null
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string
          channels_delivered?: string[]
          created_at?: string
          findings?: Json
          id?: string
          idempotency_key?: string | null
          kind: string
          photo_match?: Json | null
          photos?: Json
          read_at?: string | null
          sections?: Json
          severity?: string
          source?: string | null
          subject_name?: string | null
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          channels_delivered?: string[]
          created_at?: string
          findings?: Json
          id?: string
          idempotency_key?: string | null
          kind?: string
          photo_match?: Json | null
          photos?: Json
          read_at?: string | null
          sections?: Json
          severity?: string
          source?: string | null
          subject_name?: string | null
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      investigation_annotations: {
        Row: {
          added_sources: string[] | null
          confidence_override: number | null
          created_at: string
          finding_text: string
          id: string
          investigation_id: string
          status: string
          updated_at: string
          user_id: string
          user_note: string | null
        }
        Insert: {
          added_sources?: string[] | null
          confidence_override?: number | null
          created_at?: string
          finding_text: string
          id?: string
          investigation_id: string
          status?: string
          updated_at?: string
          user_id: string
          user_note?: string | null
        }
        Update: {
          added_sources?: string[] | null
          confidence_override?: number | null
          created_at?: string
          finding_text?: string
          id?: string
          investigation_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          user_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investigation_annotations_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "nomad_investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          cover_letter: string | null
          created_at: string
          error: string | null
          id: string
          lead_id: string | null
          method: string
          resume_id: string | null
          sent_to: string | null
          status: string
          tailored_resume: string | null
          user_id: string
        }
        Insert: {
          cover_letter?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          method?: string
          resume_id?: string | null
          sent_to?: string | null
          status?: string
          tailored_resume?: string | null
          user_id: string
        }
        Update: {
          cover_letter?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string | null
          method?: string
          resume_id?: string | null
          sent_to?: string | null
          status?: string
          tailored_resume?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "job_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "user_resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      job_leads: {
        Row: {
          apply_email: string | null
          company: string | null
          dedupe_key: string | null
          description: string | null
          discovered_at: string
          distance_miles: number | null
          id: string
          lat: number | null
          lng: number | null
          location: string | null
          match_reasons: Json
          match_score: number
          source: string
          status: string
          title: string
          url: string | null
          user_id: string
          walkable: boolean
        }
        Insert: {
          apply_email?: string | null
          company?: string | null
          dedupe_key?: string | null
          description?: string | null
          discovered_at?: string
          distance_miles?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: string | null
          match_reasons?: Json
          match_score?: number
          source: string
          status?: string
          title: string
          url?: string | null
          user_id: string
          walkable?: boolean
        }
        Update: {
          apply_email?: string | null
          company?: string | null
          dedupe_key?: string | null
          description?: string | null
          discovered_at?: string
          distance_miles?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: string | null
          match_reasons?: Json
          match_score?: number
          source?: string
          status?: string
          title?: string
          url?: string | null
          user_id?: string
          walkable?: boolean
        }
        Relationships: []
      }
      job_sentinel_settings: {
        Row: {
          autonomous: boolean
          enabled: boolean
          home_label: string | null
          home_lat: number | null
          home_lng: number | null
          keywords: string[]
          last_run_at: string | null
          radius_miles: number
          updated_at: string
          user_id: string
          walk_radius_miles: number
        }
        Insert: {
          autonomous?: boolean
          enabled?: boolean
          home_label?: string | null
          home_lat?: number | null
          home_lng?: number | null
          keywords?: string[]
          last_run_at?: string | null
          radius_miles?: number
          updated_at?: string
          user_id: string
          walk_radius_miles?: number
        }
        Update: {
          autonomous?: boolean
          enabled?: boolean
          home_label?: string | null
          home_lat?: number | null
          home_lng?: number | null
          keywords?: string[]
          last_run_at?: string | null
          radius_miles?: number
          updated_at?: string
          user_id?: string
          walk_radius_miles?: number
        }
        Relationships: []
      }
      lavba_bot_state: {
        Row: {
          available_capital: number | null
          created_at: string | null
          current_coin: string | null
          daily_trade_count: number | null
          emergency_reason: string | null
          emergency_stopped: boolean | null
          enabled: boolean | null
          id: string
          last_trade_date: string | null
          total_capital: number | null
          total_fees_paid: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          available_capital?: number | null
          created_at?: string | null
          current_coin?: string | null
          daily_trade_count?: number | null
          emergency_reason?: string | null
          emergency_stopped?: boolean | null
          enabled?: boolean | null
          id?: string
          last_trade_date?: string | null
          total_capital?: number | null
          total_fees_paid?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          available_capital?: number | null
          created_at?: string | null
          current_coin?: string | null
          daily_trade_count?: number | null
          emergency_reason?: string | null
          emergency_stopped?: boolean | null
          enabled?: boolean | null
          id?: string
          last_trade_date?: string | null
          total_capital?: number | null
          total_fees_paid?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lavba_pnl_snapshots: {
        Row: {
          best_trade_pnl: number | null
          created_at: string | null
          ending_balance: number | null
          fees_paid: number | null
          id: string
          loss_count: number | null
          period_date: string
          period_type: string
          realized_pnl: number | null
          starting_balance: number | null
          trade_count: number | null
          user_id: string
          win_count: number | null
          worst_trade_pnl: number | null
        }
        Insert: {
          best_trade_pnl?: number | null
          created_at?: string | null
          ending_balance?: number | null
          fees_paid?: number | null
          id?: string
          loss_count?: number | null
          period_date: string
          period_type: string
          realized_pnl?: number | null
          starting_balance?: number | null
          trade_count?: number | null
          user_id: string
          win_count?: number | null
          worst_trade_pnl?: number | null
        }
        Update: {
          best_trade_pnl?: number | null
          created_at?: string | null
          ending_balance?: number | null
          fees_paid?: number | null
          id?: string
          loss_count?: number | null
          period_date?: string
          period_type?: string
          realized_pnl?: number | null
          starting_balance?: number | null
          trade_count?: number | null
          user_id?: string
          win_count?: number | null
          worst_trade_pnl?: number | null
        }
        Relationships: []
      }
      lavba_trades: {
        Row: {
          based_on_patterns: string[] | null
          chart_review: string | null
          closed_at: string | null
          created_at: string | null
          direction: string
          entry_price: number
          exit_price: number | null
          fees: number | null
          id: string
          leverage: number
          opened_at: string | null
          position_size: number
          realized_pnl: number | null
          signal_confidence: number | null
          signal_reasoning: string | null
          size_usd: number
          status: string
          stop_loss: number | null
          symbol: string
          take_profit1: number | null
          take_profit2: number | null
          take_profit3: number | null
          user_id: string
        }
        Insert: {
          based_on_patterns?: string[] | null
          chart_review?: string | null
          closed_at?: string | null
          created_at?: string | null
          direction: string
          entry_price: number
          exit_price?: number | null
          fees?: number | null
          id?: string
          leverage?: number
          opened_at?: string | null
          position_size: number
          realized_pnl?: number | null
          signal_confidence?: number | null
          signal_reasoning?: string | null
          size_usd: number
          status?: string
          stop_loss?: number | null
          symbol: string
          take_profit1?: number | null
          take_profit2?: number | null
          take_profit3?: number | null
          user_id: string
        }
        Update: {
          based_on_patterns?: string[] | null
          chart_review?: string | null
          closed_at?: string | null
          created_at?: string | null
          direction?: string
          entry_price?: number
          exit_price?: number | null
          fees?: number | null
          id?: string
          leverage?: number
          opened_at?: string | null
          position_size?: number
          realized_pnl?: number | null
          signal_confidence?: number | null
          signal_reasoning?: string | null
          size_usd?: number
          status?: string
          stop_loss?: number | null
          symbol?: string
          take_profit1?: number | null
          take_profit2?: number | null
          take_profit3?: number | null
          user_id?: string
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
          enabled: boolean
          id: string
          reason: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          enabled?: boolean
          id?: string
          reason?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          enabled?: boolean
          id?: string
          reason?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mesh_devices: {
        Row: {
          accuracy: number | null
          battery_at: string | null
          battery_charging: boolean | null
          battery_pct: number | null
          created_at: string
          device_id: string
          effective_type: string | null
          fix_at: string | null
          form_factor: string
          google_emails: string[]
          id: string
          label: string | null
          last_seen_at: string
          last_source: string | null
          lat: number | null
          link_type: string | null
          lng: number | null
          platform: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          battery_at?: string | null
          battery_charging?: boolean | null
          battery_pct?: number | null
          created_at?: string
          device_id: string
          effective_type?: string | null
          fix_at?: string | null
          form_factor?: string
          google_emails?: string[]
          id?: string
          label?: string | null
          last_seen_at?: string
          last_source?: string | null
          lat?: number | null
          link_type?: string | null
          lng?: number | null
          platform?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          battery_at?: string | null
          battery_charging?: boolean | null
          battery_pct?: number | null
          created_at?: string
          device_id?: string
          effective_type?: string | null
          fix_at?: string | null
          form_factor?: string
          google_emails?: string[]
          id?: string
          label?: string | null
          last_seen_at?: string
          last_source?: string | null
          lat?: number | null
          link_type?: string | null
          lng?: number | null
          platform?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mesh_dossier_runs: {
        Row: {
          built: number
          error_message: string | null
          failed: number
          finished_at: string | null
          id: string
          phase: string
          queued: number
          skipped: number
          started_at: string
          stats: Json
          user_id: string
        }
        Insert: {
          built?: number
          error_message?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          phase: string
          queued?: number
          skipped?: number
          started_at?: string
          stats?: Json
          user_id: string
        }
        Update: {
          built?: number
          error_message?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          phase?: string
          queued?: number
          skipped?: number
          started_at?: string
          stats?: Json
          user_id?: string
        }
        Relationships: []
      }
      mesh_dossiers: {
        Row: {
          built_at: string | null
          channel: string | null
          confidence: number
          created_at: string
          dossier: Json
          error_message: string | null
          hop: number
          id: string
          priority: number
          relationship: Json
          source_account: string | null
          status: string
          subject_email: string | null
          subject_key: string
          subject_name: string
          summary: string | null
          updated_at: string
          user_id: string
          via: string | null
        }
        Insert: {
          built_at?: string | null
          channel?: string | null
          confidence?: number
          created_at?: string
          dossier?: Json
          error_message?: string | null
          hop?: number
          id?: string
          priority?: number
          relationship?: Json
          source_account?: string | null
          status?: string
          subject_email?: string | null
          subject_key: string
          subject_name: string
          summary?: string | null
          updated_at?: string
          user_id: string
          via?: string | null
        }
        Update: {
          built_at?: string | null
          channel?: string | null
          confidence?: number
          created_at?: string
          dossier?: Json
          error_message?: string | null
          hop?: number
          id?: string
          priority?: number
          relationship?: Json
          source_account?: string | null
          status?: string
          subject_email?: string | null
          subject_key?: string
          subject_name?: string
          summary?: string | null
          updated_at?: string
          user_id?: string
          via?: string | null
        }
        Relationships: []
      }
      mesh_vault_settings: {
        Row: {
          channels: Json
          created_at: string
          last_sweep_at: string | null
          last_watermark: string | null
          sentinel_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          channels?: Json
          created_at?: string
          last_sweep_at?: string | null
          last_watermark?: string | null
          sentinel_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          channels?: Json
          created_at?: string
          last_sweep_at?: string | null
          last_watermark?: string | null
          sentinel_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_sources: {
        Row: {
          channel: string
          counterparty: string | null
          created_at: string
          id: string
          parsed: Json
          raw: string
          report: string | null
          user_id: string
        }
        Insert: {
          channel?: string
          counterparty?: string | null
          created_at?: string
          id?: string
          parsed?: Json
          raw: string
          report?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          counterparty?: string | null
          created_at?: string
          id?: string
          parsed?: Json
          raw?: string
          report?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachments_enc: string | null
          branch_id: string | null
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
          attachments_enc?: string | null
          branch_id?: string | null
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
          attachments_enc?: string | null
          branch_id?: string | null
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
          {
            foreignKeyName: "messages_conversation_id_fkey_cascade"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      nomad_calibration_events: {
        Row: {
          ai_confidence: number
          created_at: string
          entity_type: string | null
          finding_text: string
          id: string
          investigation_id: string | null
          source_tiers: number[] | null
          user_id: string
          user_verdict: string
        }
        Insert: {
          ai_confidence: number
          created_at?: string
          entity_type?: string | null
          finding_text: string
          id?: string
          investigation_id?: string | null
          source_tiers?: number[] | null
          user_id: string
          user_verdict?: string
        }
        Update: {
          ai_confidence?: number
          created_at?: string
          entity_type?: string | null
          finding_text?: string
          id?: string
          investigation_id?: string | null
          source_tiers?: number[] | null
          user_id?: string
          user_verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "nomad_calibration_events_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "nomad_investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      nomad_entities: {
        Row: {
          confidence: number | null
          created_at: string
          entity_type: string
          entity_value: string
          id: string
          investigation_id: string
          source: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          entity_type: string
          entity_value: string
          id?: string
          investigation_id: string
          source?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          entity_type?: string
          entity_value?: string
          id?: string
          investigation_id?: string
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nomad_entities_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "nomad_investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      nomad_entity_graph: {
        Row: {
          confidence: number | null
          created_at: string
          entity_type: string
          entity_value: string
          first_seen: string
          frequency: number | null
          id: string
          investigation_id: string | null
          last_seen: string
          metadata: Json | null
          source: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          entity_type: string
          entity_value: string
          first_seen?: string
          frequency?: number | null
          id?: string
          investigation_id?: string | null
          last_seen?: string
          metadata?: Json | null
          source?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          entity_type?: string
          entity_value?: string
          first_seen?: string
          frequency?: number | null
          id?: string
          investigation_id?: string | null
          last_seen?: string
          metadata?: Json | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nomad_entity_graph_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "nomad_investigations"
            referencedColumns: ["id"]
          },
        ]
      }
      nomad_investigations: {
        Row: {
          actionable_intel: Json | null
          created_at: string
          dark_zones: string[] | null
          entities_found: Json | null
          esrc_profile: Json | null
          findings: string
          id: string
          investigation_type: string | null
          pivot_suggestions: Json | null
          query: string
          source_telemetry: Json | null
          sources_checked: string[] | null
          subject_fingerprint: string | null
          user_id: string
        }
        Insert: {
          actionable_intel?: Json | null
          created_at?: string
          dark_zones?: string[] | null
          entities_found?: Json | null
          esrc_profile?: Json | null
          findings: string
          id?: string
          investigation_type?: string | null
          pivot_suggestions?: Json | null
          query: string
          source_telemetry?: Json | null
          sources_checked?: string[] | null
          subject_fingerprint?: string | null
          user_id: string
        }
        Update: {
          actionable_intel?: Json | null
          created_at?: string
          dark_zones?: string[] | null
          entities_found?: Json | null
          esrc_profile?: Json | null
          findings?: string
          id?: string
          investigation_type?: string | null
          pivot_suggestions?: Json | null
          query?: string
          source_telemetry?: Json | null
          sources_checked?: string[] | null
          subject_fingerprint?: string | null
          user_id?: string
        }
        Relationships: []
      }
      nomad_source_telemetry: {
        Row: {
          created_at: string
          entity_yield: number | null
          id: string
          investigation_id: string | null
          response_time_ms: number | null
          result_count: number | null
          source_name: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_yield?: number | null
          id?: string
          investigation_id?: string | null
          response_time_ms?: number | null
          result_count?: number | null
          source_name: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_yield?: number | null
          id?: string
          investigation_id?: string | null
          response_time_ms?: number | null
          result_count?: number | null
          source_name?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nomad_source_telemetry_investigation_id_fkey"
            columns: ["investigation_id"]
            isOneToOne: false
            referencedRelation: "nomad_investigations"
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
          {
            foreignKeyName: "notebook_cells_notebook_id_fkey_cascade"
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
            foreignKeyName: "notebook_comments_notebook_id_fkey_cascade"
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
            foreignKeyName: "notebook_shares_notebook_id_fkey_cascade"
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
          {
            foreignKeyName: "notebook_versions_notebook_id_fkey_cascade"
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
      op_actions: {
        Row: {
          action: string
          created_at: string
          device_id: string | null
          executed_at: string | null
          finding_id: string | null
          id: string
          outcome: string
          rationale: Json
          requested_at: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          device_id?: string | null
          executed_at?: string | null
          finding_id?: string | null
          id?: string
          outcome?: string
          rationale?: Json
          requested_at?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          device_id?: string | null
          executed_at?: string | null
          finding_id?: string | null
          id?: string
          outcome?: string
          rationale?: Json
          requested_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "op_actions_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "op_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      op_cron_state: {
        Row: {
          auto_response_enabled: boolean
          created_at: string
          enabled: boolean
          failures: number
          interval_minutes: number
          last_finished_at: string | null
          last_started_at: string | null
          last_status: string | null
          next_due_at: string
          user_id: string
        }
        Insert: {
          auto_response_enabled?: boolean
          created_at?: string
          enabled?: boolean
          failures?: number
          interval_minutes?: number
          last_finished_at?: string | null
          last_started_at?: string | null
          last_status?: string | null
          next_due_at?: string
          user_id: string
        }
        Update: {
          auto_response_enabled?: boolean
          created_at?: string
          enabled?: boolean
          failures?: number
          interval_minutes?: number
          last_finished_at?: string | null
          last_started_at?: string | null
          last_status?: string | null
          next_due_at?: string
          user_id?: string
        }
        Relationships: []
      }
      op_devices: {
        Row: {
          app_version: string | null
          consent_level: string
          created_at: string
          device_id: string
          enrolled_at: string
          expected_interval_minutes: number
          fingerprint: Json
          form_factor: string
          id: string
          label: string | null
          last_report_at: string | null
          last_tier: string | null
          platform: string | null
          revoked: boolean
          trusted: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          consent_level?: string
          created_at?: string
          device_id: string
          enrolled_at?: string
          expected_interval_minutes?: number
          fingerprint?: Json
          form_factor?: string
          id?: string
          label?: string | null
          last_report_at?: string | null
          last_tier?: string | null
          platform?: string | null
          revoked?: boolean
          trusted?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          consent_level?: string
          created_at?: string
          device_id?: string
          enrolled_at?: string
          expected_interval_minutes?: number
          fingerprint?: Json
          form_factor?: string
          id?: string
          label?: string | null
          last_report_at?: string | null
          last_tier?: string | null
          platform?: string | null
          revoked?: boolean
          trusted?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      op_findings: {
        Row: {
          acknowledged_at: string | null
          code: string
          confidence: number
          corroborating_devices: number
          created_at: string
          distinct_signal_types: number
          evidence: Json
          exposed_device_id: string | null
          first_seen: string
          id: string
          last_seen: string
          narrative: string | null
          recommendations: Json
          response_tier: string
          severity: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          code: string
          confidence?: number
          corroborating_devices?: number
          created_at?: string
          distinct_signal_types?: number
          evidence?: Json
          exposed_device_id?: string | null
          first_seen?: string
          id?: string
          last_seen?: string
          narrative?: string | null
          recommendations?: Json
          response_tier?: string
          severity?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          code?: string
          confidence?: number
          corroborating_devices?: number
          created_at?: string
          distinct_signal_types?: number
          evidence?: Json
          exposed_device_id?: string | null
          first_seen?: string
          id?: string
          last_seen?: string
          narrative?: string | null
          recommendations?: Json
          response_tier?: string
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      op_networks: {
        Row: {
          asn: string | null
          clean_reports: number
          country: string | null
          devices_seen: number
          first_seen: string
          hostile_reports: number
          id: string
          label: string | null
          last_seen: string
          network_key: string
          org: string | null
          updated_at: string
          user_id: string
          verdict: string
        }
        Insert: {
          asn?: string | null
          clean_reports?: number
          country?: string | null
          devices_seen?: number
          first_seen?: string
          hostile_reports?: number
          id?: string
          label?: string | null
          last_seen?: string
          network_key: string
          org?: string | null
          updated_at?: string
          user_id: string
          verdict?: string
        }
        Update: {
          asn?: string | null
          clean_reports?: number
          country?: string | null
          devices_seen?: number
          first_seen?: string
          hostile_reports?: number
          id?: string
          label?: string | null
          last_seen?: string
          network_key?: string
          org?: string | null
          updated_at?: string
          user_id?: string
          verdict?: string
        }
        Relationships: []
      }
      op_signals: {
        Row: {
          accuracy: number | null
          confidence: number
          created_at: string
          device_id: string
          evidence: Json
          id: string
          lat: number | null
          lng: number | null
          network_key: string | null
          observed_at: string
          runtime_tier: string
          signal_type: string
          user_id: string
          verdict: string
        }
        Insert: {
          accuracy?: number | null
          confidence?: number
          created_at?: string
          device_id: string
          evidence?: Json
          id?: string
          lat?: number | null
          lng?: number | null
          network_key?: string | null
          observed_at?: string
          runtime_tier?: string
          signal_type: string
          user_id: string
          verdict?: string
        }
        Update: {
          accuracy?: number | null
          confidence?: number
          created_at?: string
          device_id?: string
          evidence?: Json
          id?: string
          lat?: number | null
          lng?: number | null
          network_key?: string | null
          observed_at?: string
          runtime_tier?: string
          signal_type?: string
          user_id?: string
          verdict?: string
        }
        Relationships: []
      }
      oracle_analyses: {
        Row: {
          actual_latitude: number | null
          actual_longitude: number | null
          address_estimate: string | null
          alternative_locations: Json | null
          calibrated_confidence: number | null
          confidence_score: number | null
          created_at: string
          distance_error_km: number | null
          error_radius_meters: number | null
          id: string
          identified_features: Json | null
          insufficient_data: boolean | null
          insufficient_data_reason: string | null
          latitude: number | null
          longitude: number | null
          macro_region: string | null
          person_analysis: Json | null
          rationale: Json | null
          refinement_steps: Json | null
          status: string
          time_estimation: Json | null
          user_correct: boolean | null
          user_id: string
          user_notes: string | null
          user_verified: boolean | null
        }
        Insert: {
          actual_latitude?: number | null
          actual_longitude?: number | null
          address_estimate?: string | null
          alternative_locations?: Json | null
          calibrated_confidence?: number | null
          confidence_score?: number | null
          created_at?: string
          distance_error_km?: number | null
          error_radius_meters?: number | null
          id?: string
          identified_features?: Json | null
          insufficient_data?: boolean | null
          insufficient_data_reason?: string | null
          latitude?: number | null
          longitude?: number | null
          macro_region?: string | null
          person_analysis?: Json | null
          rationale?: Json | null
          refinement_steps?: Json | null
          status?: string
          time_estimation?: Json | null
          user_correct?: boolean | null
          user_id: string
          user_notes?: string | null
          user_verified?: boolean | null
        }
        Update: {
          actual_latitude?: number | null
          actual_longitude?: number | null
          address_estimate?: string | null
          alternative_locations?: Json | null
          calibrated_confidence?: number | null
          confidence_score?: number | null
          created_at?: string
          distance_error_km?: number | null
          error_radius_meters?: number | null
          id?: string
          identified_features?: Json | null
          insufficient_data?: boolean | null
          insufficient_data_reason?: string | null
          latitude?: number | null
          longitude?: number | null
          macro_region?: string | null
          person_analysis?: Json | null
          rationale?: Json | null
          refinement_steps?: Json | null
          status?: string
          time_estimation?: Json | null
          user_correct?: boolean | null
          user_id?: string
          user_notes?: string | null
          user_verified?: boolean | null
        }
        Relationships: []
      }
      page_view_events: {
        Row: {
          created_at: string
          duration_seconds: number
          entered_at: string
          id: string
          path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          entered_at?: string
          id?: string
          path: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          entered_at?: string
          id?: string
          path?: string
          user_id?: string
        }
        Relationships: []
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
      postmark_baselines: {
        Row: {
          asns: Json
          auth_pass_rate: number
          countries: Json
          created_at: string
          domain: string
          esps: Json
          established_at: string
          id: string
          last_confirmed_at: string
          mailers: Json
          sample_size: number
          updated_at: string
          user_id: string
        }
        Insert: {
          asns?: Json
          auth_pass_rate?: number
          countries?: Json
          created_at?: string
          domain: string
          esps?: Json
          established_at?: string
          id?: string
          last_confirmed_at?: string
          mailers?: Json
          sample_size?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          asns?: Json
          auth_pass_rate?: number
          countries?: Json
          created_at?: string
          domain?: string
          esps?: Json
          established_at?: string
          id?: string
          last_confirmed_at?: string
          mailers?: Json
          sample_size?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prediction_history: {
        Row: {
          company: string
          created_at: string
          event_date: string
          event_description: string
          event_type: string
          id: string
          lead_time_days: number | null
          prediction_confidence: number | null
          prediction_made_at: string | null
          signals_detected: Json
          was_predicted: boolean
        }
        Insert: {
          company: string
          created_at?: string
          event_date: string
          event_description: string
          event_type: string
          id?: string
          lead_time_days?: number | null
          prediction_confidence?: number | null
          prediction_made_at?: string | null
          signals_detected?: Json
          was_predicted?: boolean
        }
        Update: {
          company?: string
          created_at?: string
          event_date?: string
          event_description?: string
          event_type?: string
          id?: string
          lead_time_days?: number | null
          prediction_confidence?: number | null
          prediction_made_at?: string | null
          signals_detected?: Json
          was_predicted?: boolean
        }
        Relationships: []
      }
      prediction_signals: {
        Row: {
          credibility_score: number
          detected_at: string
          id: string
          prediction_id: string | null
          relevance_score: number
          search_query: string
          signal_category: string
          signal_type: string
          source_date: string | null
          source_domain: string | null
          source_snippet: string
          source_title: string
          source_url: string
          weight: number
        }
        Insert: {
          credibility_score: number
          detected_at?: string
          id?: string
          prediction_id?: string | null
          relevance_score: number
          search_query: string
          signal_category: string
          signal_type: string
          source_date?: string | null
          source_domain?: string | null
          source_snippet: string
          source_title: string
          source_url: string
          weight: number
        }
        Update: {
          credibility_score?: number
          detected_at?: string
          id?: string
          prediction_id?: string | null
          relevance_score?: number
          search_query?: string
          signal_category?: string
          signal_type?: string
          source_date?: string | null
          source_domain?: string | null
          source_snippet?: string
          source_title?: string
          source_url?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "prediction_signals_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          company: string
          confidence: number
          created_at: string
          estimated_date: string
          event_type: string
          historical_comparison: Json | null
          id: string
          outcome: string | null
          outcome_date: string | null
          prediction_text: string
          reasoning_chain: Json
          session_id: string | null
          severity: string
          signals: Json
          status: string
          time_horizon: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company: string
          confidence: number
          created_at?: string
          estimated_date: string
          event_type: string
          historical_comparison?: Json | null
          id?: string
          outcome?: string | null
          outcome_date?: string | null
          prediction_text: string
          reasoning_chain?: Json
          session_id?: string | null
          severity: string
          signals?: Json
          status?: string
          time_horizon: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string
          confidence?: number
          created_at?: string
          estimated_date?: string
          event_type?: string
          historical_comparison?: Json | null
          id?: string
          outcome?: string | null
          outcome_date?: string | null
          prediction_text?: string
          reasoning_chain?: Json
          session_id?: string | null
          severity?: string
          signals?: Json
          status?: string
          time_horizon?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "asha_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_ip_observations: {
        Row: {
          asn: string | null
          city: string | null
          country: string | null
          id: string
          ip_address: string
          is_infrastructure: boolean
          latitude: number | null
          longitude: number | null
          observed_at: string
          org: string | null
          subject_id: string
          user_id: string | null
        }
        Insert: {
          asn?: string | null
          city?: string | null
          country?: string | null
          id?: string
          ip_address: string
          is_infrastructure?: boolean
          latitude?: number | null
          longitude?: number | null
          observed_at?: string
          org?: string | null
          subject_id: string
          user_id?: string | null
        }
        Update: {
          asn?: string | null
          city?: string | null
          country?: string | null
          id?: string
          ip_address?: string
          is_infrastructure?: boolean
          latitude?: number | null
          longitude?: number | null
          observed_at?: string
          org?: string | null
          subject_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pro_trial_usage: {
        Row: {
          used_at: string
          user_id: string
        }
        Insert: {
          used_at?: string
          user_id: string
        }
        Update: {
          used_at?: string
          user_id?: string
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
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          label: string | null
          last_used_at: string | null
          p256dh: string
          platform: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          p256dh: string
          platform?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          p256dh?: string
          platform?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_tracking: {
        Row: {
          blocked: boolean
          created_at: string
          endpoint: string
          id: string
          identifier: string
          identifier_type: string
          request_count: number
          window_end: string
          window_start: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          identifier_type?: string
          request_count?: number
          window_end?: string
          window_start?: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          identifier_type?: string
          request_count?: number
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      research_audit_log: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          ip_address: string | null
          payload: Json | null
          payload_hash: string
          prev_hash: string | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          payload?: Json | null
          payload_hash: string
          prev_hash?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          payload?: Json | null
          payload_hash?: string
          prev_hash?: string | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "research_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      research_workspaces: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean | null
          metadata: Json | null
          name: string
          pinned: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          metadata?: Json | null
          name: string
          pinned?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean | null
          metadata?: Json | null
          name?: string
          pinned?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      resume_gaps: {
        Row: {
          answer: string | null
          answered_at: string | null
          created_at: string
          field_key: string
          id: string
          question: string
          resume_id: string
          status: string
          user_id: string
          why: string | null
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          created_at?: string
          field_key: string
          id?: string
          question: string
          resume_id: string
          status?: string
          user_id: string
          why?: string | null
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          created_at?: string
          field_key?: string
          id?: string
          question?: string
          resume_id?: string
          status?: string
          user_id?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resume_gaps_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "user_resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      resume_versions: {
        Row: {
          created_at: string
          id: string
          note: string | null
          raw_text: string
          resume_id: string
          structured: Json
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          raw_text?: string
          resume_id: string
          structured?: Json
          user_id: string
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          raw_text?: string
          resume_id?: string
          structured?: Json
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "resume_versions_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "user_resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      rideshare_reports: {
        Row: {
          confidence: number
          created_at: string
          delivered_channels: string[]
          headline: string | null
          id: string
          payload: Json
          phase: string
          ride_id: string
          score: number
          user_id: string
          verdict: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          delivered_channels?: string[]
          headline?: string | null
          id?: string
          payload?: Json
          phase: string
          ride_id: string
          score?: number
          user_id: string
          verdict: string
        }
        Update: {
          confidence?: number
          created_at?: string
          delivered_channels?: string[]
          headline?: string | null
          id?: string
          payload?: Json
          phase?: string
          ride_id?: string
          score?: number
          user_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "rideshare_reports_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rideshare_rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rideshare_rides: {
        Row: {
          arrive_at: string | null
          auto_captured: boolean
          booking_ref: string | null
          city: string | null
          confidence: number | null
          created_at: string
          depart_at: string | null
          destination_label: string | null
          driver_name: string | null
          email_message_id: string | null
          id: string
          idempotency_key: string | null
          leg: Json
          mode: string
          operator: string | null
          operator_label: string | null
          pickup_label: string | null
          plate: string | null
          platform: string
          ride_at: string | null
          seat: string | null
          source: string
          status: string
          trip_url: string | null
          updated_at: string
          user_id: string
          vehicle: string | null
          vehicle_ident: string | null
          verdict: string | null
        }
        Insert: {
          arrive_at?: string | null
          auto_captured?: boolean
          booking_ref?: string | null
          city?: string | null
          confidence?: number | null
          created_at?: string
          depart_at?: string | null
          destination_label?: string | null
          driver_name?: string | null
          email_message_id?: string | null
          id?: string
          idempotency_key?: string | null
          leg?: Json
          mode?: string
          operator?: string | null
          operator_label?: string | null
          pickup_label?: string | null
          plate?: string | null
          platform?: string
          ride_at?: string | null
          seat?: string | null
          source: string
          status?: string
          trip_url?: string | null
          updated_at?: string
          user_id: string
          vehicle?: string | null
          vehicle_ident?: string | null
          verdict?: string | null
        }
        Update: {
          arrive_at?: string | null
          auto_captured?: boolean
          booking_ref?: string | null
          city?: string | null
          confidence?: number | null
          created_at?: string
          depart_at?: string | null
          destination_label?: string | null
          driver_name?: string | null
          email_message_id?: string | null
          id?: string
          idempotency_key?: string | null
          leg?: Json
          mode?: string
          operator?: string | null
          operator_label?: string | null
          pickup_label?: string | null
          plate?: string | null
          platform?: string
          ride_at?: string | null
          seat?: string | null
          source?: string
          status?: string
          trip_url?: string | null
          updated_at?: string
          user_id?: string
          vehicle?: string | null
          vehicle_ident?: string | null
          verdict?: string | null
        }
        Relationships: []
      }
      rideshare_settings: {
        Row: {
          alert_threshold: string
          auto_from_email: boolean
          autopilot_enabled: boolean
          email_enabled: boolean
          last_scan_at: string | null
          last_scan_detail: string | null
          last_scan_status: string | null
          lookback_hours: number
          next_due_at: string
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_threshold?: string
          auto_from_email?: boolean
          autopilot_enabled?: boolean
          email_enabled?: boolean
          last_scan_at?: string | null
          last_scan_detail?: string | null
          last_scan_status?: string | null
          lookback_hours?: number
          next_due_at?: string
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_threshold?: string
          auto_from_email?: boolean
          autopilot_enabled?: boolean
          email_enabled?: boolean
          last_scan_at?: string | null
          last_scan_detail?: string | null
          last_scan_status?: string | null
          lookback_hours?: number
          next_due_at?: string
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rideshare_trip_points: {
        Row: {
          accuracy_m: number | null
          altitude_m: number | null
          created_at: string
          heading_deg: number | null
          id: number
          lat: number
          lon: number
          speed_mps: number | null
          t: string
          trip_id: string
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          altitude_m?: number | null
          created_at?: string
          heading_deg?: number | null
          id?: number
          lat: number
          lon: number
          speed_mps?: number | null
          t: string
          trip_id: string
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          altitude_m?: number | null
          created_at?: string
          heading_deg?: number | null
          id?: number
          lat?: number
          lon?: number
          speed_mps?: number | null
          t?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rideshare_trip_points_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "rideshare_trip_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      rideshare_trip_tracks: {
        Row: {
          analysis: Json
          avg_speed_mps: number | null
          coverage_gap_s: number | null
          created_at: string
          distance_m: number | null
          duration_s: number | null
          ended_at: string | null
          events: Json
          id: string
          idempotency_key: string | null
          label: string | null
          max_speed_mps: number | null
          moving_s: number | null
          platform: string
          point_count: number
          ride_id: string | null
          started_at: string
          status: string
          stopped_s: number | null
          streets: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json
          avg_speed_mps?: number | null
          coverage_gap_s?: number | null
          created_at?: string
          distance_m?: number | null
          duration_s?: number | null
          ended_at?: string | null
          events?: Json
          id?: string
          idempotency_key?: string | null
          label?: string | null
          max_speed_mps?: number | null
          moving_s?: number | null
          platform?: string
          point_count?: number
          ride_id?: string | null
          started_at?: string
          status?: string
          stopped_s?: number | null
          streets?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json
          avg_speed_mps?: number | null
          coverage_gap_s?: number | null
          created_at?: string
          distance_m?: number | null
          duration_s?: number | null
          ended_at?: string | null
          events?: Json
          id?: string
          idempotency_key?: string | null
          label?: string | null
          max_speed_mps?: number | null
          moving_s?: number | null
          platform?: string
          point_count?: number
          ride_id?: string | null
          started_at?: string
          status?: string
          stopped_s?: number | null
          streets?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rideshare_trip_tracks_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rideshare_rides"
            referencedColumns: ["id"]
          },
        ]
      }
      room_participants: {
        Row: {
          cursor_state: Json | null
          display_name: string | null
          id: string
          joined_at: string | null
          last_seen_at: string | null
          role: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          cursor_state?: Json | null
          display_name?: string | null
          id?: string
          joined_at?: string | null
          last_seen_at?: string | null
          role?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          cursor_state?: Json | null
          display_name?: string | null
          id?: string
          joined_at?: string | null
          last_seen_at?: string | null
          role?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "shared_intel_rooms"
            referencedColumns: ["id"]
          },
        ]
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
      saved_searches: {
        Row: {
          category: string | null
          created_at: string | null
          enabled: boolean | null
          filters: Json | null
          frequency: string | null
          id: string
          last_result_count: number | null
          last_run_at: string | null
          name: string
          next_run_at: string | null
          query: string
          total_runs: number | null
          updated_at: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          enabled?: boolean | null
          filters?: Json | null
          frequency?: string | null
          id?: string
          last_result_count?: number | null
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          query: string
          total_runs?: number | null
          updated_at?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          enabled?: boolean | null
          filters?: Json | null
          frequency?: string | null
          id?: string
          last_result_count?: number | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          query?: string
          total_runs?: number | null
          updated_at?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "research_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      scrapper_files: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string
          file_size: number
          file_type: string
          id: string
          session_id: string
          status: string
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name: string
          file_size?: number
          file_type?: string
          id?: string
          session_id: string
          status?: string
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          id?: string
          session_id?: string
          status?: string
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrapper_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scrapper_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrapper_files_session_id_fkey_cascade"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scrapper_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      scrapper_sessions: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          status: string
          total_files: number
          total_text_length: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          status?: string
          total_files?: number
          total_text_length?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          status?: string
          total_files?: number
          total_text_length?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      search_alerts: {
        Row: {
          created_at: string | null
          id: string
          new_results: Json | null
          read: boolean | null
          result_count: number | null
          saved_search_id: string | null
          summary: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          new_results?: Json | null
          read?: boolean | null
          result_count?: number | null
          saved_search_id?: string | null
          summary?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          new_results?: Json | null
          read?: boolean | null
          result_count?: number | null
          saved_search_id?: string | null
          summary?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_alerts_saved_search_id_fkey"
            columns: ["saved_search_id"]
            isOneToOne: false
            referencedRelation: "saved_searches"
            referencedColumns: ["id"]
          },
        ]
      }
      search_history: {
        Row: {
          category: string | null
          created_at: string | null
          duration_ms: number | null
          filters: Json | null
          id: string
          query: string
          result_count: number | null
          results_snapshot: Json | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          duration_ms?: number | null
          filters?: Json | null
          id?: string
          query: string
          result_count?: number | null
          results_snapshot?: Json | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          duration_ms?: number | null
          filters?: Json | null
          id?: string
          query?: string
          result_count?: number | null
          results_snapshot?: Json | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "research_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          action_taken: string
          created_at: string
          detection_rule: string
          event_type: string
          fingerprint: string | null
          geo_city: string | null
          geo_country: string | null
          id: string
          metadata: Json
          payload_snippet: string | null
          request_method: string | null
          request_path: string | null
          severity: string
          source_ip: string | null
          user_agent: string | null
        }
        Insert: {
          action_taken?: string
          created_at?: string
          detection_rule: string
          event_type?: string
          fingerprint?: string | null
          geo_city?: string | null
          geo_country?: string | null
          id?: string
          metadata?: Json
          payload_snippet?: string | null
          request_method?: string | null
          request_path?: string | null
          severity?: string
          source_ip?: string | null
          user_agent?: string | null
        }
        Update: {
          action_taken?: string
          created_at?: string
          detection_rule?: string
          event_type?: string
          fingerprint?: string | null
          geo_city?: string | null
          geo_country?: string | null
          id?: string
          metadata?: Json
          payload_snippet?: string | null
          request_method?: string | null
          request_path?: string | null
          severity?: string
          source_ip?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      security_notification_prefs: {
        Row: {
          created_at: string | null
          failed_login_attempts: boolean | null
          id: string
          mfa_change: boolean | null
          new_device_login: boolean | null
          notify_email: boolean | null
          notify_push: boolean
          notify_sms: boolean | null
          notify_wifi: boolean
          password_change: boolean | null
          recovery_code_usage: boolean | null
          session_revocation: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          failed_login_attempts?: boolean | null
          id?: string
          mfa_change?: boolean | null
          new_device_login?: boolean | null
          notify_email?: boolean | null
          notify_push?: boolean
          notify_sms?: boolean | null
          notify_wifi?: boolean
          password_change?: boolean | null
          recovery_code_usage?: boolean | null
          session_revocation?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          failed_login_attempts?: boolean | null
          id?: string
          mfa_change?: boolean | null
          new_device_login?: boolean | null
          notify_email?: boolean | null
          notify_push?: boolean
          notify_sms?: boolean | null
          notify_wifi?: boolean
          password_change?: boolean | null
          recovery_code_usage?: boolean | null
          session_revocation?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      self_access_findings: {
        Row: {
          created_at: string
          file_path: string
          finding: string
          finding_type: string
          id: string
          output_code: string | null
          reason_needs_fix: string
          reasoning: string
          recommendation: string
          run_id: string
          severity: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          finding: string
          finding_type?: string
          id?: string
          output_code?: string | null
          reason_needs_fix: string
          reasoning: string
          recommendation: string
          run_id: string
          severity?: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          finding?: string
          finding_type?: string
          id?: string
          output_code?: string | null
          reason_needs_fix?: string
          reasoning?: string
          recommendation?: string
          run_id?: string
          severity?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      self_access_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          files_analyzed: number | null
          findings_count: number | null
          id: string
          scan_scope: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          files_analyzed?: number | null
          findings_count?: number | null
          id?: string
          scan_scope?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          files_analyzed?: number | null
          findings_count?: number | null
          id?: string
          scan_scope?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      self_learning_agent_logs: {
        Row: {
          action: string
          agent_name: string
          created_at: string
          details: string | null
          id: string
          run_id: string | null
          severity: string | null
        }
        Insert: {
          action: string
          agent_name: string
          created_at?: string
          details?: string | null
          id?: string
          run_id?: string | null
          severity?: string | null
        }
        Update: {
          action?: string
          agent_name?: string
          created_at?: string
          details?: string | null
          id?: string
          run_id?: string | null
          severity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "self_learning_agent_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "self_learning_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      self_learning_brains: {
        Row: {
          active: boolean | null
          auto_approved: boolean | null
          confidence: number | null
          created_at: string
          deprecated: boolean | null
          deprecated_reason: string | null
          directive: string
          domain: string
          findings: Json | null
          id: string
          is_language_agnostic: boolean | null
          languages_applicable: string[] | null
          name: string
          previous_version_id: string | null
          run_id: string | null
          success_rate: number | null
          times_applied: number | null
          times_helped: number | null
          version: number | null
        }
        Insert: {
          active?: boolean | null
          auto_approved?: boolean | null
          confidence?: number | null
          created_at?: string
          deprecated?: boolean | null
          deprecated_reason?: string | null
          directive: string
          domain: string
          findings?: Json | null
          id?: string
          is_language_agnostic?: boolean | null
          languages_applicable?: string[] | null
          name: string
          previous_version_id?: string | null
          run_id?: string | null
          success_rate?: number | null
          times_applied?: number | null
          times_helped?: number | null
          version?: number | null
        }
        Update: {
          active?: boolean | null
          auto_approved?: boolean | null
          confidence?: number | null
          created_at?: string
          deprecated?: boolean | null
          deprecated_reason?: string | null
          directive?: string
          domain?: string
          findings?: Json | null
          id?: string
          is_language_agnostic?: boolean | null
          languages_applicable?: string[] | null
          name?: string
          previous_version_id?: string | null
          run_id?: string | null
          success_rate?: number | null
          times_applied?: number | null
          times_helped?: number | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "self_learning_brains_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "self_learning_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      self_learning_cron_settings: {
        Row: {
          consecutive_failures: number | null
          cooldown_until: string | null
          enabled: boolean
          id: string
          interval_minutes: number
          iterations_reset_date: string | null
          iterations_today: number | null
          last_cron_run_at: string | null
          max_consecutive_failures: number | null
          max_iterations_per_day: number | null
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number | null
          cooldown_until?: string | null
          enabled?: boolean
          id?: string
          interval_minutes?: number
          iterations_reset_date?: string | null
          iterations_today?: number | null
          last_cron_run_at?: string | null
          max_consecutive_failures?: number | null
          max_iterations_per_day?: number | null
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number | null
          cooldown_until?: string | null
          enabled?: boolean
          id?: string
          interval_minutes?: number
          iterations_reset_date?: string | null
          iterations_today?: number | null
          last_cron_run_at?: string | null
          max_consecutive_failures?: number | null
          max_iterations_per_day?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      self_learning_runs: {
        Row: {
          brains_generated: number | null
          bugs_found: number | null
          code_reviewed: number | null
          completed_at: string | null
          created_at: string
          domains_analyzed: string[] | null
          duration_ms: number | null
          error: string | null
          findings: Json | null
          id: string
          optimizations_applied: number | null
          security_patches: number | null
          status: string
        }
        Insert: {
          brains_generated?: number | null
          bugs_found?: number | null
          code_reviewed?: number | null
          completed_at?: string | null
          created_at?: string
          domains_analyzed?: string[] | null
          duration_ms?: number | null
          error?: string | null
          findings?: Json | null
          id?: string
          optimizations_applied?: number | null
          security_patches?: number | null
          status?: string
        }
        Update: {
          brains_generated?: number | null
          bugs_found?: number | null
          code_reviewed?: number | null
          completed_at?: string | null
          created_at?: string
          domains_analyzed?: string[] | null
          duration_ms?: number | null
          error?: string | null
          findings?: Json | null
          id?: string
          optimizations_applied?: number | null
          security_patches?: number | null
          status?: string
        }
        Relationships: []
      }
      sentinel_cases: {
        Row: {
          analysis: Json
          case_file: Json
          case_reference: string
          created_at: string
          headline: string | null
          id: string
          note: string | null
          posture: string
          score: number
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json
          case_file?: Json
          case_reference: string
          created_at?: string
          headline?: string | null
          id?: string
          note?: string | null
          posture?: string
          score?: number
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json
          case_file?: Json
          case_reference?: string
          created_at?: string
          headline?: string | null
          id?: string
          note?: string | null
          posture?: string
          score?: number
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sentinel_cron_state: {
        Row: {
          created_at: string
          enabled: boolean
          interval_minutes: number
          last_error: string | null
          last_finished_at: string | null
          last_place_key: string | null
          last_started_at: string | null
          last_status: string | null
          last_tier: string
          next_due_at: string
          runs: number
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          interval_minutes?: number
          last_error?: string | null
          last_finished_at?: string | null
          last_place_key?: string | null
          last_started_at?: string | null
          last_status?: string | null
          last_tier?: string
          next_due_at?: string
          runs?: number
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          interval_minutes?: number
          last_error?: string | null
          last_finished_at?: string | null
          last_place_key?: string | null
          last_started_at?: string | null
          last_status?: string | null
          last_tier?: string
          next_due_at?: string
          runs?: number
          user_id?: string
        }
        Relationships: []
      }
      sentinel_devices: {
        Row: {
          beacons: number
          created_at: string
          id: string
          label: string | null
          last_beacon_at: string | null
          mesh_device_id: string | null
          platform: string | null
          revoked: boolean
          token_hash: string
          user_id: string
        }
        Insert: {
          beacons?: number
          created_at?: string
          id?: string
          label?: string | null
          last_beacon_at?: string | null
          mesh_device_id?: string | null
          platform?: string | null
          revoked?: boolean
          token_hash: string
          user_id: string
        }
        Update: {
          beacons?: number
          created_at?: string
          id?: string
          label?: string | null
          last_beacon_at?: string | null
          mesh_device_id?: string | null
          platform?: string | null
          revoked?: boolean
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      sentinel_presence: {
        Row: {
          accuracy: number | null
          arrival_pending: boolean
          effective_type: string | null
          fix_at: string | null
          last_seen_at: string
          last_source: string | null
          lat: number | null
          link_type: string | null
          lng: number | null
          place_key: string | null
          place_since: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          arrival_pending?: boolean
          effective_type?: string | null
          fix_at?: string | null
          last_seen_at?: string
          last_source?: string | null
          lat?: number | null
          link_type?: string | null
          lng?: number | null
          place_key?: string | null
          place_since?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          arrival_pending?: boolean
          effective_type?: string | null
          fix_at?: string | null
          last_seen_at?: string
          last_source?: string | null
          lat?: number | null
          link_type?: string | null
          lng?: number | null
          place_key?: string | null
          place_since?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sentinel_settings: {
        Row: {
          ble_enabled: boolean
          email_enabled: boolean
          geo_enabled: boolean
          ignore_audio: boolean
          min_rssi: number
          push_enabled: boolean
          recurrence_threshold: number
          recurrence_window_hours: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ble_enabled?: boolean
          email_enabled?: boolean
          geo_enabled?: boolean
          ignore_audio?: boolean
          min_rssi?: number
          push_enabled?: boolean
          recurrence_threshold?: number
          recurrence_window_hours?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ble_enabled?: boolean
          email_enabled?: boolean
          geo_enabled?: boolean
          ignore_audio?: boolean
          min_rssi?: number
          push_enabled?: boolean
          recurrence_threshold?: number
          recurrence_window_hours?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_intel_rooms: {
        Row: {
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_public: boolean | null
          name: string
          owner_id: string
          share_code: string
          state: Json | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          owner_id: string
          share_code?: string
          state?: Json | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          owner_id?: string
          share_code?: string
          state?: Json | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_intel_rooms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "research_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_personas: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          installs: number
          is_public: boolean
          name: string
          rating: number
          system_prompt: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          installs?: number
          is_public?: boolean
          name: string
          rating?: number
          system_prompt?: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          installs?: number
          is_public?: boolean
          name?: string
          rating?: number
          system_prompt?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signal_definitions: {
        Row: {
          accuracy_rate: number | null
          base_weight: number
          created_at: string
          detection_frequency: string
          enabled: boolean
          event_type: string
          exclude_keywords: string[] | null
          false_positive_rate: number | null
          id: string
          keywords: string[]
          search_queries: string[]
          signal_name: string
          signal_type: string
        }
        Insert: {
          accuracy_rate?: number | null
          base_weight: number
          created_at?: string
          detection_frequency: string
          enabled?: boolean
          event_type: string
          exclude_keywords?: string[] | null
          false_positive_rate?: number | null
          id?: string
          keywords: string[]
          search_queries: string[]
          signal_name: string
          signal_type: string
        }
        Update: {
          accuracy_rate?: number | null
          base_weight?: number
          created_at?: string
          detection_frequency?: string
          enabled?: boolean
          event_type?: string
          exclude_keywords?: string[] | null
          false_positive_rate?: number | null
          id?: string
          keywords?: string[]
          search_queries?: string[]
          signal_name?: string
          signal_type?: string
        }
        Relationships: []
      }
      social_intel_cache: {
        Row: {
          created_at: string
          display_name: string | null
          fetched_at: string
          handle: string
          handle_key: string
          id: string
          payload: Json
          platform: string
          updated_at: string
          verdict: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          fetched_at?: string
          handle: string
          handle_key: string
          id?: string
          payload: Json
          platform: string
          updated_at?: string
          verdict: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          fetched_at?: string
          handle?: string
          handle_key?: string
          id?: string
          payload?: Json
          platform?: string
          updated_at?: string
          verdict?: string
        }
        Relationships: []
      }
      social_probe_cooldown: {
        Row: {
          consecutive_failures: number
          cooldown_until: string
          last_reason: string | null
          platform: string
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          cooldown_until: string
          last_reason?: string | null
          platform: string
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          cooldown_until?: string
          last_reason?: string | null
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
          {
            foreignKeyName: "team_invites_team_id_fkey_cascade"
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
          {
            foreignKeyName: "team_members_team_id_fkey_cascade"
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
      threat_intelligence: {
        Row: {
          confidence: number
          created_at: string
          expires_at: string | null
          hit_count: number
          id: string
          indicator_type: string
          indicator_value: string
          is_active: boolean
          last_seen: string | null
          metadata: Json
          source: string
          threat_category: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          expires_at?: string | null
          hit_count?: number
          id?: string
          indicator_type?: string
          indicator_value: string
          is_active?: boolean
          last_seen?: string | null
          metadata?: Json
          source?: string
          threat_category?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          expires_at?: string | null
          hit_count?: number
          id?: string
          indicator_type?: string
          indicator_value?: string
          is_active?: boolean
          last_seen?: string | null
          metadata?: Json
          source?: string
          threat_category?: string
        }
        Relationships: []
      }
      tracker_devices: {
        Row: {
          created_at: string
          device_name: string
          id: string
          last_seen: string | null
          pairing_token: string | null
          pairing_token_expires_at: string | null
          phone_number: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_name?: string
          id?: string
          last_seen?: string | null
          pairing_token?: string | null
          pairing_token_expires_at?: string | null
          phone_number?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_name?: string
          id?: string
          last_seen?: string | null
          pairing_token?: string | null
          pairing_token_expires_at?: string | null
          phone_number?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tracker_locations: {
        Row: {
          accuracy: number | null
          address: string | null
          device_id: string
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          address?: string | null
          device_id: string
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          address?: string | null
          device_id?: string
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_locations_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "tracker_devices"
            referencedColumns: ["id"]
          },
        ]
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
      user_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_behavior_analytics: {
        Row: {
          anomaly_details: string | null
          avg_response_time_ms: number | null
          behavior_type: string
          created_at: string
          device_info: Json
          geo_location: string | null
          id: string
          period_end: string
          period_start: string
          request_count: number
          risk_score: number
          session_fingerprint: string | null
          unique_endpoints: number
          user_id: string
        }
        Insert: {
          anomaly_details?: string | null
          avg_response_time_ms?: number | null
          behavior_type?: string
          created_at?: string
          device_info?: Json
          geo_location?: string | null
          id?: string
          period_end?: string
          period_start?: string
          request_count?: number
          risk_score?: number
          session_fingerprint?: string | null
          unique_endpoints?: number
          user_id: string
        }
        Update: {
          anomaly_details?: string | null
          avg_response_time_ms?: number | null
          behavior_type?: string
          created_at?: string
          device_info?: Json
          geo_location?: string | null
          id?: string
          period_end?: string
          period_start?: string
          request_count?: number
          risk_score?: number
          session_fingerprint?: string | null
          unique_endpoints?: number
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
      user_key_material: {
        Row: {
          created_at: string
          device_secret_b64: string
          salt_b64: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_secret_b64: string
          salt_b64: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_secret_b64?: string
          salt_b64?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_model_preferences: {
        Row: {
          active_model: string | null
          active_provider: string | null
          created_at: string
          fallback_to_default: boolean
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_model?: string | null
          active_provider?: string | null
          created_at?: string
          fallback_to_default?: boolean
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_model?: string | null
          active_provider?: string | null
          created_at?: string
          fallback_to_default?: boolean
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_resumes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          psychology: Json
          raw_text: string
          source_filename: string | null
          structured: Json
          title: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          psychology?: Json
          raw_text?: string
          source_filename?: string | null
          structured?: Json
          title?: string
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          psychology?: Json
          raw_text?: string
          source_filename?: string | null
          structured?: Json
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
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
      user_sessions: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string | null
          current_path: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          is_current: boolean | null
          landing_path: string | null
          last_active_at: string | null
          latitude: number | null
          longitude: number | null
          os: string | null
          referrer: string | null
          region: string | null
          revoked_at: string | null
          session_token_hash: string
          user_id: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          current_path?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          landing_path?: string | null
          last_active_at?: string | null
          latitude?: number | null
          longitude?: number | null
          os?: string | null
          referrer?: string | null
          region?: string | null
          revoked_at?: string | null
          session_token_hash: string
          user_id: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          current_path?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          is_current?: boolean | null
          landing_path?: string | null
          last_active_at?: string | null
          latitude?: number | null
          longitude?: number | null
          os?: string | null
          referrer?: string | null
          region?: string | null
          revoked_at?: string | null
          session_token_hash?: string
          user_id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
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
          wallpaper: string
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
          wallpaper?: string
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
          wallpaper?: string
          web_search_enabled?: boolean
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          gifted_by_user_id: string | null
          id: string
          product_id: string
          starts_at: string
          status: string
          stripe_customer_id: string | null
          stripe_session_id: string | null
          stripe_subscription_id: string | null
          subscription_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          gifted_by_user_id?: string | null
          id?: string
          product_id: string
          starts_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          subscription_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          gifted_by_user_id?: string | null
          id?: string
          product_id?: string
          starts_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_session_id?: string | null
          stripe_subscription_id?: string | null
          subscription_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vedic_charts: {
        Row: {
          birth_date: string
          birth_time: string
          city_label: string | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
          notes: string | null
          tz_offset: number
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date: string
          birth_time: string
          city_label?: string | null
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          name: string
          notes?: string | null
          tz_offset: number
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string
          birth_time?: string
          city_label?: string | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          notes?: string | null
          tz_offset?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vibe_video_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          project_id: string
          role: string
          user_id: string
          version_id: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          project_id: string
          role?: string
          user_id: string
          version_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vibe_video_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vibe_video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_video_messages_project_id_fkey_cascade"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vibe_video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_video_messages_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "vibe_video_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_video_projects: {
        Row: {
          created_at: string
          id: string
          name: string
          template: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          template?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          template?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vibe_video_versions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          is_uploaded: boolean
          metadata: Json | null
          parent_id: string | null
          project_id: string
          prompt: string
          style_preset: string | null
          thumbnail_url: string | null
          user_id: string
          version_number: number
          video_url: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_uploaded?: boolean
          metadata?: Json | null
          parent_id?: string | null
          project_id: string
          prompt?: string
          style_preset?: string | null
          thumbnail_url?: string | null
          user_id: string
          version_number?: number
          video_url: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          is_uploaded?: boolean
          metadata?: Json | null
          parent_id?: string | null
          project_id?: string
          prompt?: string
          style_preset?: string | null
          thumbnail_url?: string | null
          user_id?: string
          version_number?: number
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibe_video_versions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "vibe_video_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_video_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vibe_video_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vibe_video_versions_project_id_fkey_cascade"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "vibe_video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      wifi_networks: {
        Row: {
          band: string | null
          bssid: string
          captive_portal_url: string | null
          channel: number | null
          connect_count: number
          connected_devices: number | null
          created_at: string
          dns_servers: string[]
          enrichment: Json
          estimated_distance_m: number | null
          findings: Json
          first_seen: string
          frequency_mhz: number | null
          gateway_ip: string | null
          id: string
          is_hidden: boolean
          last_seen: string
          latitude: number | null
          longitude: number | null
          public_ip: string | null
          risk_level: string
          risk_score: number
          rssi: number | null
          security: string | null
          ssid: string | null
          updated_at: string
          user_id: string
          vendor: string | null
        }
        Insert: {
          band?: string | null
          bssid: string
          captive_portal_url?: string | null
          channel?: number | null
          connect_count?: number
          connected_devices?: number | null
          created_at?: string
          dns_servers?: string[]
          enrichment?: Json
          estimated_distance_m?: number | null
          findings?: Json
          first_seen?: string
          frequency_mhz?: number | null
          gateway_ip?: string | null
          id?: string
          is_hidden?: boolean
          last_seen?: string
          latitude?: number | null
          longitude?: number | null
          public_ip?: string | null
          risk_level?: string
          risk_score?: number
          rssi?: number | null
          security?: string | null
          ssid?: string | null
          updated_at?: string
          user_id: string
          vendor?: string | null
        }
        Update: {
          band?: string | null
          bssid?: string
          captive_portal_url?: string | null
          channel?: number | null
          connect_count?: number
          connected_devices?: number | null
          created_at?: string
          dns_servers?: string[]
          enrichment?: Json
          estimated_distance_m?: number | null
          findings?: Json
          first_seen?: string
          frequency_mhz?: number | null
          gateway_ip?: string | null
          id?: string
          is_hidden?: boolean
          last_seen?: string
          latitude?: number | null
          longitude?: number | null
          public_ip?: string | null
          risk_level?: string
          risk_score?: number
          rssi?: number | null
          security?: string | null
          ssid?: string | null
          updated_at?: string
          user_id?: string
          vendor?: string | null
        }
        Relationships: []
      }
      workspace_items: {
        Row: {
          content: Json | null
          created_at: string | null
          id: string
          item_type: string
          position: number | null
          source_url: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          id?: string
          item_type: string
          position?: number | null
          source_url?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          id?: string
          item_type?: string
          position?: number | null
          source_url?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "research_workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      zacoon_cortex_events: {
        Row: {
          created_at: string
          data: Json | null
          detail: string
          event_type: string
          id: number
          mission_id: string
          phase: string
          ts_ms: number
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          detail?: string
          event_type: string
          id?: number
          mission_id: string
          phase: string
          ts_ms?: number
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          detail?: string
          event_type?: string
          id?: number
          mission_id?: string
          phase?: string
          ts_ms?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zacoon_cortex_events_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "zacoon_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      zacoon_missions: {
        Row: {
          created_at: string
          duration_ms: number | null
          fingerprint: string
          finished_at: string | null
          id: string
          integrity_cert: string | null
          intel: Json
          mode: string
          objective: string
          output: Json
          risk_envelope: string
          status: string
          target_url: string | null
          teg: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          fingerprint: string
          finished_at?: string | null
          id?: string
          integrity_cert?: string | null
          intel?: Json
          mode: string
          objective?: string
          output?: Json
          risk_envelope?: string
          status?: string
          target_url?: string | null
          teg?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          fingerprint?: string
          finished_at?: string | null
          id?: string
          integrity_cert?: string | null
          intel?: Json
          mode?: string
          objective?: string
          output?: Json
          risk_envelope?: string
          status?: string
          target_url?: string | null
          teg?: Json
          user_id?: string
        }
        Relationships: []
      }
      zali_components: {
        Row: {
          compatible_names: string[] | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          lead_days: number | null
          name: string
          reused: number | null
          success_rate: number | null
          supplier: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          compatible_names?: string[] | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          lead_days?: number | null
          name: string
          reused?: number | null
          success_rate?: number | null
          supplier?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          compatible_names?: string[] | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          lead_days?: number | null
          name?: string
          reused?: number | null
          success_rate?: number | null
          supplier?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zali_materials: {
        Row: {
          avg_cost: number | null
          category: string
          created_at: string
          failure_mode: string | null
          id: string
          name: string
          notes: string | null
          success_rate: number | null
          sustainability: string | null
          times_used: number | null
          top_use: string | null
          trend: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cost?: number | null
          category?: string
          created_at?: string
          failure_mode?: string | null
          id?: string
          name: string
          notes?: string | null
          success_rate?: number | null
          sustainability?: string | null
          times_used?: number | null
          top_use?: string | null
          trend?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cost?: number | null
          category?: string
          created_at?: string
          failure_mode?: string | null
          id?: string
          name?: string
          notes?: string | null
          success_rate?: number | null
          sustainability?: string | null
          times_used?: number | null
          top_use?: string | null
          trend?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zali_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zali_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "zali_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      zali_mfg_results: {
        Row: {
          analysis_type: string
          created_at: string
          id: string
          project_name: string
          results: Json | null
          user_id: string
        }
        Insert: {
          analysis_type?: string
          created_at?: string
          id?: string
          project_name?: string
          results?: Json | null
          user_id: string
        }
        Update: {
          analysis_type?: string
          created_at?: string
          id?: string
          project_name?: string
          results?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      zali_optimization_results: {
        Row: {
          created_at: string
          id: string
          project_name: string
          results: Json | null
          user_id: string
          weights: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          project_name?: string
          results?: Json | null
          user_id: string
          weights?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          project_name?: string
          results?: Json | null
          user_id?: string
          weights?: Json | null
        }
        Relationships: []
      }
      zali_projects: {
        Row: {
          cost_analysis: Json | null
          created_at: string
          description: string | null
          design_type: string | null
          id: string
          manufacturing: Json | null
          name: string
          phase: string | null
          research_domains: Json | null
          simulation_results: Json | null
          specifications: Json | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_analysis?: Json | null
          created_at?: string
          description?: string | null
          design_type?: string | null
          id?: string
          manufacturing?: Json | null
          name: string
          phase?: string | null
          research_domains?: Json | null
          simulation_results?: Json | null
          specifications?: Json | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_analysis?: Json | null
          created_at?: string
          description?: string | null
          design_type?: string | null
          id?: string
          manufacturing?: Json | null
          name?: string
          phase?: string | null
          research_domains?: Json | null
          simulation_results?: Json | null
          specifications?: Json | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zali_research: {
        Row: {
          confidence: number | null
          content: string | null
          created_at: string
          domain: string
          id: string
          project_id: string
          sources: Json | null
          title: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          content?: string | null
          created_at?: string
          domain: string
          id?: string
          project_id: string
          sources?: Json | null
          title: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          content?: string | null
          created_at?: string
          domain?: string
          id?: string
          project_id?: string
          sources?: Json | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zali_research_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "zali_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zali_research_project_id_fkey_cascade"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "zali_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      zali_simulation_results: {
        Row: {
          created_at: string
          id: string
          project_name: string
          results: Json | null
          sim_type: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_name?: string
          results?: Json | null
          sim_type: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_name?: string
          results?: Json | null
          sim_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      zanoem_autopilot_decisions: {
        Row: {
          chosen_option: string | null
          conversation_ref: string | null
          created_at: string
          id: string
          options: Json
          overridden_at: string | null
          override_choice: string | null
          project_ref: string | null
          rationale: string | null
          reply_sent: string | null
          round: number
          status: string
          surface: string
          trigger_excerpt: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chosen_option?: string | null
          conversation_ref?: string | null
          created_at?: string
          id?: string
          options?: Json
          overridden_at?: string | null
          override_choice?: string | null
          project_ref?: string | null
          rationale?: string | null
          reply_sent?: string | null
          round?: number
          status?: string
          surface: string
          trigger_excerpt: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chosen_option?: string | null
          conversation_ref?: string | null
          created_at?: string
          id?: string
          options?: Json
          overridden_at?: string | null
          override_choice?: string | null
          project_ref?: string | null
          rationale?: string | null
          reply_sent?: string | null
          round?: number
          status?: string
          surface?: string
          trigger_excerpt?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zaxin_cases: {
        Row: {
          case_code: string
          created_at: string
          id: string
          owner: string | null
          severity: string
          status: string
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_code: string
          created_at?: string
          id?: string
          owner?: string | null
          severity?: string
          status?: string
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_code?: string
          created_at?: string
          id?: string
          owner?: string | null
          severity?: string
          status?: string
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zaxin_response_actions: {
        Row: {
          action_type: string
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          params: Json
          response: Json | null
          status: string
          target: string
          user_id: string
        }
        Insert: {
          action_type: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          params?: Json
          response?: Json | null
          status?: string
          target: string
          user_id: string
        }
        Update: {
          action_type?: string
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          params?: Json
          response?: Json | null
          status?: string
          target?: string
          user_id?: string
        }
        Relationships: []
      }
      zeeion_sessions: {
        Row: {
          anomalies: Json | null
          category_breakdown: Json | null
          created_at: string
          currency: string | null
          department_performance: Json | null
          executive_summary: string | null
          file_name: string
          file_type: string | null
          id: string
          savings_opportunities: Json | null
          status: string | null
          summary: Json | null
          updated_at: string
          user_id: string
          wasteful_items: Json | null
        }
        Insert: {
          anomalies?: Json | null
          category_breakdown?: Json | null
          created_at?: string
          currency?: string | null
          department_performance?: Json | null
          executive_summary?: string | null
          file_name: string
          file_type?: string | null
          id?: string
          savings_opportunities?: Json | null
          status?: string | null
          summary?: Json | null
          updated_at?: string
          user_id: string
          wasteful_items?: Json | null
        }
        Update: {
          anomalies?: Json | null
          category_breakdown?: Json | null
          created_at?: string
          currency?: string | null
          department_performance?: Json | null
          executive_summary?: string | null
          file_name?: string
          file_type?: string | null
          id?: string
          savings_opportunities?: Json | null
          status?: string | null
          summary?: Json | null
          updated_at?: string
          user_id?: string
          wasteful_items?: Json | null
        }
        Relationships: []
      }
      zerlal_background_jobs: {
        Row: {
          aggregated_findings: Json
          attempts: number
          byok: Json | null
          code_content: string | null
          completed_at: string | null
          created_at: string
          current_section: number
          email_sent_at: string | null
          file_name: string | null
          final_risk_grade: string | null
          final_summary: string | null
          findings_count: number
          first_pass_risk_grade: string | null
          first_pass_summary: string | null
          github_url: string | null
          id: string
          include_workflow_function_flaws: boolean
          last_error: string | null
          last_run_at: string | null
          project_id: string
          project_name: string | null
          provider_profile: Json | null
          recipient_email: string
          scan_errors: Json
          scan_id: string | null
          scan_profile: string
          source_storage_path: string | null
          status: string
          total_sections: number
          updated_at: string
          user_id: string
        }
        Insert: {
          aggregated_findings?: Json
          attempts?: number
          byok?: Json | null
          code_content?: string | null
          completed_at?: string | null
          created_at?: string
          current_section?: number
          email_sent_at?: string | null
          file_name?: string | null
          final_risk_grade?: string | null
          final_summary?: string | null
          findings_count?: number
          first_pass_risk_grade?: string | null
          first_pass_summary?: string | null
          github_url?: string | null
          id?: string
          include_workflow_function_flaws?: boolean
          last_error?: string | null
          last_run_at?: string | null
          project_id: string
          project_name?: string | null
          provider_profile?: Json | null
          recipient_email: string
          scan_errors?: Json
          scan_id?: string | null
          scan_profile?: string
          source_storage_path?: string | null
          status?: string
          total_sections?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          aggregated_findings?: Json
          attempts?: number
          byok?: Json | null
          code_content?: string | null
          completed_at?: string | null
          created_at?: string
          current_section?: number
          email_sent_at?: string | null
          file_name?: string | null
          final_risk_grade?: string | null
          final_summary?: string | null
          findings_count?: number
          first_pass_risk_grade?: string | null
          first_pass_summary?: string | null
          github_url?: string | null
          id?: string
          include_workflow_function_flaws?: boolean
          last_error?: string | null
          last_run_at?: string | null
          project_id?: string
          project_name?: string | null
          provider_profile?: Json | null
          recipient_email?: string
          scan_errors?: Json
          scan_id?: string | null
          scan_profile?: string
          source_storage_path?: string | null
          status?: string
          total_sections?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zerlal_compliance_mappings: {
        Row: {
          control_id: string
          control_name: string | null
          created_at: string
          evidence: string | null
          finding_id: string | null
          framework: string
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          control_id: string
          control_name?: string | null
          created_at?: string
          evidence?: string | null
          finding_id?: string | null
          framework: string
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          control_id?: string
          control_name?: string | null
          created_at?: string
          evidence?: string | null
          finding_id?: string | null
          framework?: string
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zerlal_compliance_mappings_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "zerlal_findings"
            referencedColumns: ["id"]
          },
        ]
      }
      zerlal_findings: {
        Row: {
          age_days: number | null
          assignee: string | null
          category: string | null
          chained_with: string[] | null
          code_snippet: string | null
          compliance_controls: string[] | null
          confidence: number | null
          created_at: string
          cvss_score: number | null
          cwe_id: string | null
          dataflow_trace: Json | null
          description: string | null
          exploitation_steps: Json | null
          file_path: string | null
          finding_type: string
          first_seen_at: string | null
          id: string
          impact: string | null
          is_false_positive: boolean | null
          line_number: number | null
          project_id: string | null
          resolved_at: string | null
          scan_id: string | null
          severity: string
          similar_cves: string[] | null
          status: string | null
          suggested_fix: string | null
          title: string
          updated_at: string
          user_id: string
          waived_at: string | null
          waived_by: string | null
          waiver_reason: string | null
        }
        Insert: {
          age_days?: number | null
          assignee?: string | null
          category?: string | null
          chained_with?: string[] | null
          code_snippet?: string | null
          compliance_controls?: string[] | null
          confidence?: number | null
          created_at?: string
          cvss_score?: number | null
          cwe_id?: string | null
          dataflow_trace?: Json | null
          description?: string | null
          exploitation_steps?: Json | null
          file_path?: string | null
          finding_type?: string
          first_seen_at?: string | null
          id?: string
          impact?: string | null
          is_false_positive?: boolean | null
          line_number?: number | null
          project_id?: string | null
          resolved_at?: string | null
          scan_id?: string | null
          severity?: string
          similar_cves?: string[] | null
          status?: string | null
          suggested_fix?: string | null
          title: string
          updated_at?: string
          user_id: string
          waived_at?: string | null
          waived_by?: string | null
          waiver_reason?: string | null
        }
        Update: {
          age_days?: number | null
          assignee?: string | null
          category?: string | null
          chained_with?: string[] | null
          code_snippet?: string | null
          compliance_controls?: string[] | null
          confidence?: number | null
          created_at?: string
          cvss_score?: number | null
          cwe_id?: string | null
          dataflow_trace?: Json | null
          description?: string | null
          exploitation_steps?: Json | null
          file_path?: string | null
          finding_type?: string
          first_seen_at?: string | null
          id?: string
          impact?: string | null
          is_false_positive?: boolean | null
          line_number?: number | null
          project_id?: string | null
          resolved_at?: string | null
          scan_id?: string | null
          severity?: string
          similar_cves?: string[] | null
          status?: string | null
          suggested_fix?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          waived_at?: string | null
          waived_by?: string | null
          waiver_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zerlal_findings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "zerlal_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zerlal_findings_project_id_fkey_cascade"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "zerlal_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zerlal_findings_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "zerlal_scans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zerlal_findings_scan_id_fkey_cascade"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "zerlal_scans"
            referencedColumns: ["id"]
          },
        ]
      }
      zerlal_projects: {
        Row: {
          created_at: string
          critical_count: number | null
          deleted_at: string | null
          file_size: number | null
          high_count: number | null
          id: string
          info_count: number | null
          language: string | null
          last_scan_at: string | null
          low_count: number | null
          medium_count: number | null
          name: string
          repo_url: string | null
          risk_grade: string | null
          scan_duration: number | null
          source_type: string
          status: string | null
          storage_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          critical_count?: number | null
          deleted_at?: string | null
          file_size?: number | null
          high_count?: number | null
          id?: string
          info_count?: number | null
          language?: string | null
          last_scan_at?: string | null
          low_count?: number | null
          medium_count?: number | null
          name: string
          repo_url?: string | null
          risk_grade?: string | null
          scan_duration?: number | null
          source_type?: string
          status?: string | null
          storage_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          critical_count?: number | null
          deleted_at?: string | null
          file_size?: number | null
          high_count?: number | null
          id?: string
          info_count?: number | null
          language?: string | null
          last_scan_at?: string | null
          low_count?: number | null
          medium_count?: number | null
          name?: string
          repo_url?: string | null
          risk_grade?: string | null
          scan_duration?: number | null
          source_type?: string
          status?: string | null
          storage_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      zerlal_sbom_components: {
        Row: {
          created_at: string
          cve_ids: string[] | null
          ecosystem: string | null
          id: string
          is_direct: boolean | null
          is_vulnerable: boolean | null
          last_update: string | null
          license: string | null
          maintainer_status: string | null
          name: string
          origin_country: string | null
          project_id: string | null
          risk_score: number | null
          user_id: string
          version: string | null
        }
        Insert: {
          created_at?: string
          cve_ids?: string[] | null
          ecosystem?: string | null
          id?: string
          is_direct?: boolean | null
          is_vulnerable?: boolean | null
          last_update?: string | null
          license?: string | null
          maintainer_status?: string | null
          name: string
          origin_country?: string | null
          project_id?: string | null
          risk_score?: number | null
          user_id: string
          version?: string | null
        }
        Update: {
          created_at?: string
          cve_ids?: string[] | null
          ecosystem?: string | null
          id?: string
          is_direct?: boolean | null
          is_vulnerable?: boolean | null
          last_update?: string | null
          license?: string | null
          maintainer_status?: string | null
          name?: string
          origin_country?: string | null
          project_id?: string | null
          risk_score?: number | null
          user_id?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zerlal_sbom_components_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "zerlal_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zerlal_sbom_components_project_id_fkey_cascade"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "zerlal_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      zerlal_scans: {
        Row: {
          completed_at: string | null
          created_at: string
          critical_count: number | null
          duration: number | null
          error: string | null
          findings_count: number | null
          high_count: number | null
          id: string
          info_count: number | null
          low_count: number | null
          medium_count: number | null
          project_id: string | null
          scan_profile: string | null
          started_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          critical_count?: number | null
          duration?: number | null
          error?: string | null
          findings_count?: number | null
          high_count?: number | null
          id?: string
          info_count?: number | null
          low_count?: number | null
          medium_count?: number | null
          project_id?: string | null
          scan_profile?: string | null
          started_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          critical_count?: number | null
          duration?: number | null
          error?: string | null
          findings_count?: number | null
          high_count?: number | null
          id?: string
          info_count?: number | null
          low_count?: number | null
          medium_count?: number | null
          project_id?: string | null
          scan_profile?: string | null
          started_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zerlal_scans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "zerlal_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zerlal_scans_project_id_fkey_cascade"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "zerlal_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      zerlal_settings: {
        Row: {
          alert_email: string | null
          auto_remediation: boolean
          created_at: string
          notify_critical: boolean
          retention_days: number
          scan_frequency: string
          severity_threshold: string
          slack_webhook: string | null
          updated_at: string
          user_id: string
          weekly_report: boolean
        }
        Insert: {
          alert_email?: string | null
          auto_remediation?: boolean
          created_at?: string
          notify_critical?: boolean
          retention_days?: number
          scan_frequency?: string
          severity_threshold?: string
          slack_webhook?: string | null
          updated_at?: string
          user_id: string
          weekly_report?: boolean
        }
        Update: {
          alert_email?: string | null
          auto_remediation?: boolean
          created_at?: string
          notify_critical?: boolean
          retention_days?: number
          scan_frequency?: string
          severity_threshold?: string
          slack_webhook?: string | null
          updated_at?: string
          user_id?: string
          weekly_report?: boolean
        }
        Relationships: []
      }
      zerlal_team_members: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_at: string
          last_active_at: string | null
          name: string | null
          owner_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_at?: string
          last_active_at?: string | null
          name?: string | null
          owner_id: string
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_at?: string
          last_active_at?: string | null
          name?: string | null
          owner_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ziaassets_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          ip: string | null
          metadata: Json | null
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      ziaassets_channels: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_archived: boolean
          kind: Database["public"]["Enums"]["ziaassets_channel_kind"]
          min_rank: Database["public"]["Enums"]["ziaassets_rank"]
          name: string
          slug: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_archived?: boolean
          kind?: Database["public"]["Enums"]["ziaassets_channel_kind"]
          min_rank?: Database["public"]["Enums"]["ziaassets_rank"]
          name: string
          slug: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_archived?: boolean
          kind?: Database["public"]["Enums"]["ziaassets_channel_kind"]
          min_rank?: Database["public"]["Enums"]["ziaassets_rank"]
          name?: string
          slug?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ziaassets_gate_attempts: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          reason: string | null
          success: boolean
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          reason?: string | null
          success?: boolean
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          reason?: string | null
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      ziaassets_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          codename: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          rank: Database["public"]["Enums"]["ziaassets_rank"]
          revoked_at: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          codename?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          rank?: Database["public"]["Enums"]["ziaassets_rank"]
          revoked_at?: string | null
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          codename?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          rank?: Database["public"]["Enums"]["ziaassets_rank"]
          revoked_at?: string | null
          token?: string
        }
        Relationships: []
      }
      ziaassets_members: {
        Row: {
          codename: string
          created_at: string
          duress_hash: string | null
          failed_attempts: number
          full_name: string | null
          id: string
          invited_by: string | null
          joined_at: string
          key_salt: string | null
          last_seen_at: string | null
          locked_until: string | null
          mfa_enrolled: boolean
          phrase_hash: string | null
          rank: Database["public"]["Enums"]["ziaassets_rank"]
          status: Database["public"]["Enums"]["ziaassets_member_status"]
          totp_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          codename: string
          created_at?: string
          duress_hash?: string | null
          failed_attempts?: number
          full_name?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string
          key_salt?: string | null
          last_seen_at?: string | null
          locked_until?: string | null
          mfa_enrolled?: boolean
          phrase_hash?: string | null
          rank?: Database["public"]["Enums"]["ziaassets_rank"]
          status?: Database["public"]["Enums"]["ziaassets_member_status"]
          totp_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          codename?: string
          created_at?: string
          duress_hash?: string | null
          failed_attempts?: number
          full_name?: string | null
          id?: string
          invited_by?: string | null
          joined_at?: string
          key_salt?: string | null
          last_seen_at?: string | null
          locked_until?: string | null
          mfa_enrolled?: boolean
          phrase_hash?: string | null
          rank?: Database["public"]["Enums"]["ziaassets_rank"]
          status?: Database["public"]["Enums"]["ziaassets_member_status"]
          totp_secret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ziaassets_messages: {
        Row: {
          aad: string | null
          channel_id: string
          ciphertext: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          iv: string
          kind: string
          reply_to: string | null
          sender_id: string
        }
        Insert: {
          aad?: string | null
          channel_id: string
          ciphertext: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          iv: string
          kind?: string
          reply_to?: string | null
          sender_id: string
        }
        Update: {
          aad?: string | null
          channel_id?: string
          ciphertext?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          iv?: string
          kind?: string
          reply_to?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ziaassets_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "ziaassets_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ziaassets_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "ziaassets_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ziaassets_vault_files: {
        Row: {
          created_at: string
          display_name: string | null
          filename_ct: string
          filename_iv: string
          folder_id: string | null
          id: string
          iv: string
          mime: string | null
          min_rank: Database["public"]["Enums"]["ziaassets_rank"]
          sha256: string | null
          size_bytes: number | null
          storage_path: string
          tags: string[] | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          filename_ct: string
          filename_iv: string
          folder_id?: string | null
          id?: string
          iv: string
          mime?: string | null
          min_rank?: Database["public"]["Enums"]["ziaassets_rank"]
          sha256?: string | null
          size_bytes?: number | null
          storage_path: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          filename_ct?: string
          filename_iv?: string
          folder_id?: string | null
          id?: string
          iv?: string
          mime?: string | null
          min_rank?: Database["public"]["Enums"]["ziaassets_rank"]
          sha256?: string | null
          size_bytes?: number | null
          storage_path?: string
          tags?: string[] | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "ziaassets_vault_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "ziaassets_vault_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      ziaassets_vault_folders: {
        Row: {
          created_at: string
          created_by: string
          id: string
          min_rank: Database["public"]["Enums"]["ziaassets_rank"]
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          min_rank?: Database["public"]["Enums"]["ziaassets_rank"]
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          min_rank?: Database["public"]["Enums"]["ziaassets_rank"]
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ziaassets_vault_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ziaassets_vault_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      zophiel_query_outcomes: {
        Row: {
          avg_relevance: number
          claim_count: number
          clicked_rank: number | null
          clicked_url: string | null
          contradiction_count: number
          created_at: string
          data_type_distribution: Json
          engine_hit_rate: Json
          entity_kind: string | null
          id: string
          independence_classes: Json
          mode: string | null
          on_target_rate: number
          operator_rating: number | null
          query: string
          query_shape: string | null
          rescue_used: boolean
          result_count: number
          user_id: string
        }
        Insert: {
          avg_relevance?: number
          claim_count?: number
          clicked_rank?: number | null
          clicked_url?: string | null
          contradiction_count?: number
          created_at?: string
          data_type_distribution?: Json
          engine_hit_rate?: Json
          entity_kind?: string | null
          id?: string
          independence_classes?: Json
          mode?: string | null
          on_target_rate?: number
          operator_rating?: number | null
          query: string
          query_shape?: string | null
          rescue_used?: boolean
          result_count?: number
          user_id: string
        }
        Update: {
          avg_relevance?: number
          claim_count?: number
          clicked_rank?: number | null
          clicked_url?: string | null
          contradiction_count?: number
          created_at?: string
          data_type_distribution?: Json
          engine_hit_rate?: Json
          entity_kind?: string | null
          id?: string
          independence_classes?: Json
          mode?: string | null
          on_target_rate?: number
          operator_rating?: number | null
          query?: string
          query_shape?: string | null
          rescue_used?: boolean
          result_count?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_active_sessions: {
        Args: { _window_minutes?: number }
        Returns: {
          browser: string
          city: string
          country: string
          current_path: string
          device_type: string
          email: string
          last_active_at: string
          latitude: number
          longitude: number
          os: string
          referrer: string
          user_id: string
          utm_source: string
        }[]
      }
      admin_aureon_overview: { Args: never; Returns: Json }
      admin_module_usage: {
        Args: { _since: string }
        Returns: {
          module: string
          tier: string
          usage_count: number
          user_count: number
        }[]
      }
      admin_page_analytics: {
        Args: { _since: string }
        Returns: {
          avg_seconds: number
          path: string
          total_seconds: number
          unique_users: number
          visits: number
        }[]
      }
      admin_page_timeline: {
        Args: { _bucket?: string; _since: string }
        Returns: {
          avg_seconds: number
          bucket: string
          path: string
          unique_users: number
          visits: number
        }[]
      }
      asher_accept_invitation: { Args: { _token: string }; Returns: string }
      asher_has_role_in_org: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["asher_role"][]
          _uid: string
        }
        Returns: boolean
      }
      asher_is_channel_admin: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      asher_is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      asher_is_dept_admin: {
        Args: { _dept: string; _uid: string }
        Returns: boolean
      }
      asher_is_org_admin: {
        Args: { _org: string; _uid: string }
        Returns: boolean
      }
      asher_is_org_member: {
        Args: { _org: string; _uid: string }
        Returns: boolean
      }
      asher_is_section_officer: {
        Args: { _section: string; _uid: string }
        Returns: boolean
      }
      ble_can_claim: { Args: { _fingerprint: string }; Returns: Json }
      delete_conversation: { Args: { p_conv_id: string }; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_team_role: {
        Args: { _team_id: string; _user_id: string }
        Returns: string
      }
      get_user_id_by_email: { Args: { _email: string }; Returns: string }
      ghost_buffer_purge: { Args: never; Returns: number }
      has_notebook_share: {
        Args: { _notebook_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      heartbeat_intel_slot: { Args: { _job_id: string }; Returns: undefined }
      hoa_has_permission: {
        Args: { _perm: string; _server: string; _user: string }
        Returns: boolean
      }
      hoa_is_houseofasher: { Args: { _user: string }; Returns: boolean }
      hoa_is_member: {
        Args: { _server: string; _user: string }
        Returns: boolean
      }
      hoa_member_clearance: {
        Args: { _server: string; _user: string }
        Returns: number
      }
      hoa_member_role: {
        Args: { _server: string; _user: string }
        Returns: Database["public"]["Enums"]["hoa_server_role"]
      }
      hoodie_vote_totals: {
        Args: never
        Returns: {
          no_count: number
          yes_count: number
        }[]
      }
      is_admin_user: { Args: { _user_id: string }; Returns: boolean }
      is_asher_brain_contributor: { Args: { _uid: string }; Returns: boolean }
      is_asher_conv_member: {
        Args: { _conv_id: string; _user_id: string }
        Returns: boolean
      }
      is_asher_operator: { Args: { _user_id: string }; Returns: boolean }
      is_asher_super_owner: { Args: { _uid: string }; Returns: boolean }
      is_blocked_display_name: { Args: { raw: string }; Returns: boolean }
      is_notebook_owner: {
        Args: { _notebook_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      locate_owned_device: {
        Args: { _fingerprint: string; _hours?: number; _limit?: number }
        Returns: {
          accuracy_m: number
          distance_m: number
          lat: number
          lng: number
          rssi: number
          seen_at: string
        }[]
      }
      locate_owned_devices_group: {
        Args: { _hours?: number }
        Returns: {
          accuracy_m: number
          distance_m: number
          fingerprint: string
          fix_count: number
          kind: string
          label: string
          last_seen_at: string
          lat: number
          lng: number
          rssi: number
          state: string
        }[]
      }
      match_asher_code_chunks: {
        Args: {
          _project_id: string
          _user_id: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          file_id: string
          file_path: string
          id: string
          language: string
          similarity: number
        }[]
      }
      match_vault_chunks: {
        Args: {
          _user_id: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          source_id: string
        }[]
      }
      mesh_peer_user_ids: { Args: { _user: string }; Returns: string[] }
      mesh_roster: {
        Args: never
        Returns: {
          accuracy: number
          battery_at: string
          battery_charging: boolean
          battery_pct: number
          device_id: string
          effective_type: string
          fix_at: string
          form_factor: string
          google_emails: string[]
          id: string
          label: string
          last_seen_at: string
          lat: number
          link_type: string
          lng: number
          owner_is_self: boolean
          platform: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      normalize_display_name: { Args: { raw: string }; Returns: string }
      notebook_team_id: { Args: { _notebook_id: string }; Returns: string }
      purge_soft_deleted: { Args: { p_retention_days?: number }; Returns: Json }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      release_intel_slot: {
        Args: { _job_id: string; _success?: boolean }
        Returns: undefined
      }
      restore_soft_deleted: {
        Args: { p_id: string; p_table: string }
        Returns: undefined
      }
      soft_delete_asher_message: {
        Args: { p_message_id: string }
        Returns: undefined
      }
      soft_delete_row: {
        Args: { p_id: string; p_table: string }
        Returns: undefined
      }
      try_acquire_intel_slot: {
        Args: { _job_id: string; _job_type: string; _max_concurrent?: number }
        Returns: {
          acquired: boolean
          queue_pos: number
          running_count: number
        }[]
      }
      unaccent_fallback: { Args: { raw: string }; Returns: string }
      ziaassets_bootstrap_emperor: { Args: never; Returns: string }
      ziaassets_has_min_rank: {
        Args: {
          _min: Database["public"]["Enums"]["ziaassets_rank"]
          _uid: string
        }
        Returns: boolean
      }
      ziaassets_is_active_member: { Args: { _uid: string }; Returns: boolean }
      ziaassets_is_emperor: { Args: { _uid: string }; Returns: boolean }
      ziaassets_set_phrase: {
        Args: { _duress_phrase?: string; _key_salt: string; _phrase: string }
        Returns: undefined
      }
      ziaassets_verify_phrase: {
        Args: { _phrase: string }
        Returns: {
          duress: boolean
          key_salt: string
          locked_until: string
          member_rank: Database["public"]["Enums"]["ziaassets_rank"]
          ok: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      asher_brain_category:
        | "general"
        | "map"
        | "coding"
        | "personality"
        | "azplen"
        | "zali"
      asher_channel_kind: "org" | "department" | "section" | "team" | "shared"
      asher_classification:
        | "UNCLASSIFIED"
        | "CUI"
        | "CONFIDENTIAL"
        | "SECRET"
        | "TOP_SECRET"
        | "TS_SCI"
      asher_code_visibility: "private" | "team" | "organization" | "public"
      asher_invite_status: "pending" | "accepted" | "revoked" | "expired"
      asher_role:
        | "super_owner"
        | "primary_admin"
        | "secondary_admin"
        | "dept_admin"
        | "officer"
        | "analyst"
      forum_category: "idea" | "leak" | "bug" | "theory"
      hoa_channel_kind: "text" | "voice" | "vault" | "broadcast"
      hoa_server_role:
        | "owner"
        | "operator"
        | "analyst"
        | "guest"
        | "houseofasher"
      ziaassets_channel_kind:
        | "chamber"
        | "direct"
        | "broadcast"
        | "vault-thread"
      ziaassets_member_status: "active" | "suspended" | "revoked" | "pending"
      ziaassets_rank:
        | "emperor"
        | "hand"
        | "admin"
        | "officer"
        | "researcher"
        | "worker"
        | "initiate"
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
      app_role: ["admin", "moderator", "user"],
      asher_brain_category: [
        "general",
        "map",
        "coding",
        "personality",
        "azplen",
        "zali",
      ],
      asher_channel_kind: ["org", "department", "section", "team", "shared"],
      asher_classification: [
        "UNCLASSIFIED",
        "CUI",
        "CONFIDENTIAL",
        "SECRET",
        "TOP_SECRET",
        "TS_SCI",
      ],
      asher_code_visibility: ["private", "team", "organization", "public"],
      asher_invite_status: ["pending", "accepted", "revoked", "expired"],
      asher_role: [
        "super_owner",
        "primary_admin",
        "secondary_admin",
        "dept_admin",
        "officer",
        "analyst",
      ],
      forum_category: ["idea", "leak", "bug", "theory"],
      hoa_channel_kind: ["text", "voice", "vault", "broadcast"],
      hoa_server_role: [
        "owner",
        "operator",
        "analyst",
        "guest",
        "houseofasher",
      ],
      ziaassets_channel_kind: [
        "chamber",
        "direct",
        "broadcast",
        "vault-thread",
      ],
      ziaassets_member_status: ["active", "suspended", "revoked", "pending"],
      ziaassets_rank: [
        "emperor",
        "hand",
        "admin",
        "officer",
        "researcher",
        "worker",
        "initiate",
      ],
    },
  },
} as const
