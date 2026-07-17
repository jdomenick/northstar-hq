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
      activity_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          organization_id: string
          summary: string | null
          venture_id: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          summary?: string | null
          venture_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          summary?: string | null
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          organization_id: string
          original_due_date: string | null
          owner_user_id: string | null
          postponement_count: number
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string | null
          status: Database["public"]["Enums"]["commitment_status"]
          title: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          original_due_date?: string | null
          owner_user_id?: string | null
          postponement_count?: number
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["commitment_status"]
          title: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          original_due_date?: string | null
          owner_user_id?: string | null
          postponement_count?: number
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["commitment_status"]
          title?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commitments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          created_by: string | null
          id: string
          metadata: Json | null
          organization_id: string
          role: Database["public"]["Enums"]["conversation_message_role"]
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          role: Database["public"]["Enums"]["conversation_message_role"]
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          role?: Database["public"]["Enums"]["conversation_message_role"]
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          conversation_type: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          organization_id: string
          summary: string | null
          title: string | null
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          conversation_type?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          conversation_type?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          organization_id?: string
          summary?: string | null
          title?: string | null
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          context: string | null
          created_at: string
          created_by: string | null
          decision_date: string | null
          deleted_at: string | null
          evidence: Json | null
          final_decision: string | null
          id: string
          operator_recommendation: string | null
          opportunity_cost: string | null
          options_considered: Json | null
          organization_id: string
          outcome: string | null
          owner_user_id: string | null
          project_id: string | null
          question: string | null
          rationale: string | null
          review_date: string | null
          risks: Json | null
          status: Database["public"]["Enums"]["decision_status"]
          title: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          created_by?: string | null
          decision_date?: string | null
          deleted_at?: string | null
          evidence?: Json | null
          final_decision?: string | null
          id?: string
          operator_recommendation?: string | null
          opportunity_cost?: string | null
          options_considered?: Json | null
          organization_id: string
          outcome?: string | null
          owner_user_id?: string | null
          project_id?: string | null
          question?: string | null
          rationale?: string | null
          review_date?: string | null
          risks?: Json | null
          status?: Database["public"]["Enums"]["decision_status"]
          title: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          created_by?: string | null
          decision_date?: string | null
          deleted_at?: string | null
          evidence?: Json | null
          final_decision?: string | null
          id?: string
          operator_recommendation?: string | null
          opportunity_cost?: string | null
          options_considered?: Json | null
          organization_id?: string
          outcome?: string | null
          owner_user_id?: string | null
          project_id?: string | null
          question?: string | null
          rationale?: string | null
          review_date?: string | null
          risks?: Json | null
          status?: Database["public"]["Enums"]["decision_status"]
          title?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decisions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          knowledge_record_id: string | null
          organization_id: string
          processing_status: Database["public"]["Enums"]["document_processing_status"]
          title: string
          updated_at: string
          uploaded_by: string | null
          venture_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          knowledge_record_id?: string | null
          organization_id: string
          processing_status?: Database["public"]["Enums"]["document_processing_status"]
          title: string
          updated_at?: string
          uploaded_by?: string | null
          venture_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          knowledge_record_id?: string | null
          organization_id?: string
          processing_status?: Database["public"]["Enums"]["document_processing_status"]
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_knowledge_record_id_fkey"
            columns: ["knowledge_record_id"]
            isOneToOne: false
            referencedRelation: "knowledge_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_insights: {
        Row: {
          created_at: string
          dismissed_at: string | null
          generated_at: string
          id: string
          insight_type: string
          organization_id: string
          resolved_at: string | null
          severity: Database["public"]["Enums"]["insight_severity"]
          source_records: Json | null
          status: Database["public"]["Enums"]["insight_status"]
          summary: string | null
          title: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          generated_at?: string
          id?: string
          insight_type: string
          organization_id: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["insight_severity"]
          source_records?: Json | null
          status?: Database["public"]["Enums"]["insight_status"]
          summary?: string | null
          title: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          generated_at?: string
          id?: string
          insight_type?: string
          organization_id?: string
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["insight_severity"]
          source_records?: Json | null
          status?: Database["public"]["Enums"]["insight_status"]
          summary?: string | null
          title?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "executive_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_insights_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          created_by: string | null
          current_value: number | null
          deleted_at: string | null
          description: string | null
          goal_type: string | null
          id: string
          organization_id: string
          owner_user_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          start_date: string | null
          status: Database["public"]["Enums"]["goal_status"]
          target_date: string | null
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          deleted_at?: string | null
          description?: string | null
          goal_type?: string | null
          id?: string
          organization_id: string
          owner_user_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_date?: string | null
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          deleted_at?: string | null
          description?: string | null
          goal_type?: string | null
          id?: string
          organization_id?: string
          owner_user_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          target_date?: string | null
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          connected_by: string | null
          created_at: string
          display_name: string | null
          id: string
          integration_type: string
          last_synced_at: string | null
          organization_id: string
          permissions: Json | null
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          connected_by?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          integration_type: string
          last_synced_at?: string | null
          organization_id: string
          permissions?: Json | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          connected_by?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          integration_type?: string
          last_synced_at?: string | null
          organization_id?: string
          permissions?: Json | null
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_records: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_date: string | null
          expiration_date: string | null
          id: string
          importance: Database["public"]["Enums"]["priority_level"]
          knowledge_type: Database["public"]["Enums"]["knowledge_type"]
          organization_id: string
          source: string | null
          source_url: string | null
          tags: string[]
          title: string
          updated_at: string
          venture_id: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          importance?: Database["public"]["Enums"]["priority_level"]
          knowledge_type?: Database["public"]["Enums"]["knowledge_type"]
          organization_id: string
          source?: string | null
          source_url?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          venture_id?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_date?: string | null
          expiration_date?: string | null
          id?: string
          importance?: Database["public"]["Enums"]["priority_level"]
          knowledge_type?: Database["public"]["Enums"]["knowledge_type"]
          organization_id?: string
          source?: string | null
          source_url?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          venture_id?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_records_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          slug: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          slug?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          slug?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          onboarding_completed: boolean
          preferred_name: string | null
          timezone: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          onboarding_completed?: boolean
          preferred_name?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean
          preferred_name?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          blocker_summary: string | null
          created_at: string
          created_by: string | null
          deadline: string | null
          deleted_at: string | null
          desired_outcome: string | null
          goal_id: string | null
          id: string
          name: string
          next_action: string | null
          objective: string | null
          organization_id: string
          owner_user_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          progress_percentage: number
          risk_summary: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          venture_id: string
        }
        Insert: {
          blocker_summary?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deleted_at?: string | null
          desired_outcome?: string | null
          goal_id?: string | null
          id?: string
          name: string
          next_action?: string | null
          objective?: string | null
          organization_id: string
          owner_user_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          progress_percentage?: number
          risk_summary?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          venture_id: string
        }
        Update: {
          blocker_summary?: string | null
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deleted_at?: string | null
          desired_outcome?: string | null
          goal_id?: string | null
          id?: string
          name?: string
          next_action?: string | null
          objective?: string | null
          organization_id?: string
          owner_user_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          progress_percentage?: number
          risk_summary?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          venture_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          project_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          project_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      ventures: {
        Row: {
          audience: string | null
          business_model: string | null
          created_at: string
          created_by: string | null
          current_focus: string | null
          deleted_at: string | null
          description: string | null
          id: string
          logo_url: string | null
          mission: string | null
          name: string
          organization_id: string
          owner_user_id: string | null
          priority: Database["public"]["Enums"]["priority_level"]
          slug: string | null
          status: Database["public"]["Enums"]["venture_status"]
          updated_at: string
          website_url: string | null
        }
        Insert: {
          audience?: string | null
          business_model?: string | null
          created_at?: string
          created_by?: string | null
          current_focus?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          mission?: string | null
          name: string
          organization_id: string
          owner_user_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          slug?: string | null
          status?: Database["public"]["Enums"]["venture_status"]
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          audience?: string | null
          business_model?: string | null
          created_at?: string
          created_by?: string | null
          current_focus?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          mission?: string | null
          name?: string
          organization_id?: string
          owner_user_id?: string | null
          priority?: Database["public"]["Enums"]["priority_level"]
          slug?: string | null
          status?: Database["public"]["Enums"]["venture_status"]
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ventures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_org_role: {
        Args: {
          _min: Database["public"]["Enums"]["org_role"]
          _org: string
          _user: string
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_org_owner: { Args: { _org: string; _user: string }; Returns: boolean }
      org_role_of: {
        Args: { _org: string; _user: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
    }
    Enums: {
      commitment_status:
        | "open"
        | "in_progress"
        | "waiting"
        | "overdue"
        | "completed"
        | "canceled"
      conversation_message_role: "user" | "operator" | "system" | "tool"
      decision_status:
        | "draft"
        | "under_review"
        | "waiting_for_founder"
        | "decided"
        | "revisit_later"
        | "closed"
      document_processing_status:
        | "uploaded"
        | "pending"
        | "processing"
        | "ready"
        | "failed"
      goal_status:
        | "proposed"
        | "active"
        | "at_risk"
        | "achieved"
        | "missed"
        | "paused"
        | "archived"
      insight_severity:
        | "information"
        | "attention"
        | "warning"
        | "critical"
        | "opportunity"
      insight_status: "active" | "dismissed" | "resolved" | "expired"
      integration_status:
        | "disconnected"
        | "pending"
        | "connected"
        | "error"
        | "paused"
      knowledge_type:
        | "founder_profile"
        | "venture_knowledge"
        | "person"
        | "policy"
        | "brand_guideline"
        | "strategy"
        | "research"
        | "meeting_note"
        | "conversation_summary"
        | "operating_procedure"
        | "general"
      member_status: "invited" | "active" | "suspended" | "removed"
      org_role: "owner" | "admin" | "executive" | "member" | "viewer"
      priority_level: "low" | "normal" | "high" | "critical"
      project_status:
        | "proposed"
        | "planned"
        | "active"
        | "at_risk"
        | "blocked"
        | "completed"
        | "archived"
      task_status:
        | "backlog"
        | "ready"
        | "in_progress"
        | "waiting"
        | "blocked"
        | "completed"
        | "canceled"
      venture_status:
        | "idea"
        | "active"
        | "paused"
        | "at_risk"
        | "closed"
        | "archived"
      verification_status: "unverified" | "verified" | "outdated" | "disputed"
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
      commitment_status: [
        "open",
        "in_progress",
        "waiting",
        "overdue",
        "completed",
        "canceled",
      ],
      conversation_message_role: ["user", "operator", "system", "tool"],
      decision_status: [
        "draft",
        "under_review",
        "waiting_for_founder",
        "decided",
        "revisit_later",
        "closed",
      ],
      document_processing_status: [
        "uploaded",
        "pending",
        "processing",
        "ready",
        "failed",
      ],
      goal_status: [
        "proposed",
        "active",
        "at_risk",
        "achieved",
        "missed",
        "paused",
        "archived",
      ],
      insight_severity: [
        "information",
        "attention",
        "warning",
        "critical",
        "opportunity",
      ],
      insight_status: ["active", "dismissed", "resolved", "expired"],
      integration_status: [
        "disconnected",
        "pending",
        "connected",
        "error",
        "paused",
      ],
      knowledge_type: [
        "founder_profile",
        "venture_knowledge",
        "person",
        "policy",
        "brand_guideline",
        "strategy",
        "research",
        "meeting_note",
        "conversation_summary",
        "operating_procedure",
        "general",
      ],
      member_status: ["invited", "active", "suspended", "removed"],
      org_role: ["owner", "admin", "executive", "member", "viewer"],
      priority_level: ["low", "normal", "high", "critical"],
      project_status: [
        "proposed",
        "planned",
        "active",
        "at_risk",
        "blocked",
        "completed",
        "archived",
      ],
      task_status: [
        "backlog",
        "ready",
        "in_progress",
        "waiting",
        "blocked",
        "completed",
        "canceled",
      ],
      venture_status: [
        "idea",
        "active",
        "paused",
        "at_risk",
        "closed",
        "archived",
      ],
      verification_status: ["unverified", "verified", "outdated", "disputed"],
    },
  },
} as const
