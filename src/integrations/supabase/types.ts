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
          status: string
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
          status?: string
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
          status?: string
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
      executive_graph_edges: {
        Row: {
          confidence_score: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          metadata: Json
          organization_id: string
          relationship_type: Database["public"]["Enums"]["graph_relationship_type"]
          source: string
          source_entity_id: string
          source_entity_type: Database["public"]["Enums"]["graph_entity_type"]
          target_entity_id: string
          target_entity_type: Database["public"]["Enums"]["graph_entity_type"]
          updated_at: string
          venture_id: string | null
          weight: number
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          relationship_type: Database["public"]["Enums"]["graph_relationship_type"]
          source?: string
          source_entity_id: string
          source_entity_type: Database["public"]["Enums"]["graph_entity_type"]
          target_entity_id: string
          target_entity_type: Database["public"]["Enums"]["graph_entity_type"]
          updated_at?: string
          venture_id?: string | null
          weight?: number
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          relationship_type?: Database["public"]["Enums"]["graph_relationship_type"]
          source?: string
          source_entity_id?: string
          source_entity_type?: Database["public"]["Enums"]["graph_entity_type"]
          target_entity_id?: string
          target_entity_type?: Database["public"]["Enums"]["graph_entity_type"]
          updated_at?: string
          venture_id?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "executive_graph_edges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_graph_edges_venture_id_fkey"
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
      sam_invocation_context_refs: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          invocation_id: string
          organization_id: string
          role: string
          source: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          invocation_id: string
          organization_id: string
          role?: string
          source: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          invocation_id?: string
          organization_id?: string
          role?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_invocation_context_refs_invocation_id_fkey"
            columns: ["invocation_id"]
            isOneToOne: false
            referencedRelation: "sam_invocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_invocation_context_refs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_invocation_provider_calls: {
        Row: {
          created_at: string
          error_code: string | null
          id: string
          input_tokens: number | null
          invocation_id: string
          latency_ms: number | null
          model_id: string
          organization_id: string
          output_tokens: number | null
          prompt_version: string
          provider_id: string
          status: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          id?: string
          input_tokens?: number | null
          invocation_id: string
          latency_ms?: number | null
          model_id: string
          organization_id: string
          output_tokens?: number | null
          prompt_version: string
          provider_id: string
          status?: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          id?: string
          input_tokens?: number | null
          invocation_id?: string
          latency_ms?: number | null
          model_id?: string
          organization_id?: string
          output_tokens?: number | null
          prompt_version?: string
          provider_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_invocation_provider_calls_invocation_id_fkey"
            columns: ["invocation_id"]
            isOneToOne: false
            referencedRelation: "sam_invocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_invocation_provider_calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_invocations: {
        Row: {
          actor_user_id: string | null
          citation_count: number
          citation_lineage: Json
          confidence_framework_version: string | null
          confidence_method: string
          conflict_count: number
          constitution_version: string
          context_counts: Json
          conversation_id: string | null
          created_at: string
          error_code: string | null
          finished_at: string | null
          graph_depth: number
          graph_edges_count: number
          graph_nodes_count: number
          id: string
          input_tokens: number | null
          intent: string
          latency_ms: number | null
          learning_event_ids: string[]
          memory_considered_ids: string[]
          memory_excluded_ids: string[]
          memory_framework_version: string | null
          memory_selected_ids: string[]
          message_id: string | null
          organization_id: string
          output_tokens: number | null
          pipeline_version: string
          precedence_version: string | null
          prompt_version: string
          rollup_confidence: number | null
          rollup_confidence_band: string | null
          scope: Json
          started_at: string
          status: string
          strategy: string
          surface: string
          truncations: Json
          weights_version: string
          workflow_key: string | null
        }
        Insert: {
          actor_user_id?: string | null
          citation_count?: number
          citation_lineage?: Json
          confidence_framework_version?: string | null
          confidence_method: string
          conflict_count?: number
          constitution_version: string
          context_counts?: Json
          conversation_id?: string | null
          created_at?: string
          error_code?: string | null
          finished_at?: string | null
          graph_depth?: number
          graph_edges_count?: number
          graph_nodes_count?: number
          id?: string
          input_tokens?: number | null
          intent: string
          latency_ms?: number | null
          learning_event_ids?: string[]
          memory_considered_ids?: string[]
          memory_excluded_ids?: string[]
          memory_framework_version?: string | null
          memory_selected_ids?: string[]
          message_id?: string | null
          organization_id: string
          output_tokens?: number | null
          pipeline_version: string
          precedence_version?: string | null
          prompt_version: string
          rollup_confidence?: number | null
          rollup_confidence_band?: string | null
          scope?: Json
          started_at?: string
          status?: string
          strategy?: string
          surface?: string
          truncations?: Json
          weights_version: string
          workflow_key?: string | null
        }
        Update: {
          actor_user_id?: string | null
          citation_count?: number
          citation_lineage?: Json
          confidence_framework_version?: string | null
          confidence_method?: string
          conflict_count?: number
          constitution_version?: string
          context_counts?: Json
          conversation_id?: string | null
          created_at?: string
          error_code?: string | null
          finished_at?: string | null
          graph_depth?: number
          graph_edges_count?: number
          graph_nodes_count?: number
          id?: string
          input_tokens?: number | null
          intent?: string
          latency_ms?: number | null
          learning_event_ids?: string[]
          memory_considered_ids?: string[]
          memory_excluded_ids?: string[]
          memory_framework_version?: string | null
          memory_selected_ids?: string[]
          message_id?: string | null
          organization_id?: string
          output_tokens?: number | null
          pipeline_version?: string
          precedence_version?: string | null
          prompt_version?: string
          rollup_confidence?: number | null
          rollup_confidence_band?: string | null
          scope?: Json
          started_at?: string
          status?: string
          strategy?: string
          surface?: string
          truncations?: Json
          weights_version?: string
          workflow_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sam_invocations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_invocations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_invocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_learning_events: {
        Row: {
          conversation_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["sam_learning_event_type"]
          feedback_text: string | null
          id: string
          invocation_id: string | null
          memory_item_id: string | null
          message_id: string | null
          organization_id: string
          original_payload: Json
          outcome_status: string | null
          revised_payload: Json | null
          user_id: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["sam_learning_event_type"]
          feedback_text?: string | null
          id?: string
          invocation_id?: string | null
          memory_item_id?: string | null
          message_id?: string | null
          organization_id: string
          original_payload?: Json
          outcome_status?: string | null
          revised_payload?: Json | null
          user_id?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["sam_learning_event_type"]
          feedback_text?: string | null
          id?: string
          invocation_id?: string | null
          memory_item_id?: string | null
          message_id?: string | null
          organization_id?: string
          original_payload?: Json
          outcome_status?: string | null
          revised_payload?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sam_learning_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_learning_events_invocation_id_fkey"
            columns: ["invocation_id"]
            isOneToOne: false
            referencedRelation: "sam_invocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_learning_events_memory_item_id_fkey"
            columns: ["memory_item_id"]
            isOneToOne: false
            referencedRelation: "sam_memory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_learning_events_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_learning_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_memory_conflicts: {
        Row: {
          created_at: string
          id: string
          memory_item_a_id: string
          memory_item_b_id: string
          metadata: Json
          organization_id: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory_item_a_id: string
          memory_item_b_id: string
          metadata?: Json
          organization_id: string
          reason: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          memory_item_a_id?: string
          memory_item_b_id?: string
          metadata?: Json
          organization_id?: string
          reason?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_memory_conflicts_memory_item_a_id_fkey"
            columns: ["memory_item_a_id"]
            isOneToOne: false
            referencedRelation: "sam_memory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_conflicts_memory_item_b_id_fkey"
            columns: ["memory_item_b_id"]
            isOneToOne: false
            referencedRelation: "sam_memory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_conflicts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_memory_feedback: {
        Row: {
          correction_text: string | null
          created_at: string
          feedback_type: Database["public"]["Enums"]["sam_memory_feedback_type"]
          id: string
          memory_item_id: string
          metadata: Json
          organization_id: string
          user_id: string
        }
        Insert: {
          correction_text?: string | null
          created_at?: string
          feedback_type: Database["public"]["Enums"]["sam_memory_feedback_type"]
          id?: string
          memory_item_id: string
          metadata?: Json
          organization_id: string
          user_id: string
        }
        Update: {
          correction_text?: string | null
          created_at?: string
          feedback_type?: Database["public"]["Enums"]["sam_memory_feedback_type"]
          id?: string
          memory_item_id?: string
          metadata?: Json
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_memory_feedback_memory_item_id_fkey"
            columns: ["memory_item_id"]
            isOneToOne: false
            referencedRelation: "sam_memory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_memory_items: {
        Row: {
          category: string
          confidence_band: string | null
          confidence_score: number | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_at: string | null
          evidence_refs: Json
          expires_at: string | null
          id: string
          last_confirmed_at: string | null
          layer: Database["public"]["Enums"]["sam_memory_layer"]
          organization_id: string
          owner_user_id: string | null
          source_conversation_id: string | null
          source_entity_id: string | null
          source_entity_type: string | null
          source_knowledge_record_id: string | null
          source_message_id: string | null
          source_type: Database["public"]["Enums"]["sam_memory_source_type"]
          statement: string
          status: Database["public"]["Enums"]["sam_memory_status"]
          structured_value: Json | null
          superseded_by: string | null
          title: string
          updated_at: string
          venture_id: string | null
        }
        Insert: {
          category: string
          confidence_band?: string | null
          confidence_score?: number | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_at?: string | null
          evidence_refs?: Json
          expires_at?: string | null
          id?: string
          last_confirmed_at?: string | null
          layer: Database["public"]["Enums"]["sam_memory_layer"]
          organization_id: string
          owner_user_id?: string | null
          source_conversation_id?: string | null
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_knowledge_record_id?: string | null
          source_message_id?: string | null
          source_type: Database["public"]["Enums"]["sam_memory_source_type"]
          statement: string
          status?: Database["public"]["Enums"]["sam_memory_status"]
          structured_value?: Json | null
          superseded_by?: string | null
          title: string
          updated_at?: string
          venture_id?: string | null
        }
        Update: {
          category?: string
          confidence_band?: string | null
          confidence_score?: number | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_at?: string | null
          evidence_refs?: Json
          expires_at?: string | null
          id?: string
          last_confirmed_at?: string | null
          layer?: Database["public"]["Enums"]["sam_memory_layer"]
          organization_id?: string
          owner_user_id?: string | null
          source_conversation_id?: string | null
          source_entity_id?: string | null
          source_entity_type?: string | null
          source_knowledge_record_id?: string | null
          source_message_id?: string | null
          source_type?: Database["public"]["Enums"]["sam_memory_source_type"]
          statement?: string
          status?: Database["public"]["Enums"]["sam_memory_status"]
          structured_value?: Json | null
          superseded_by?: string | null
          title?: string
          updated_at?: string
          venture_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sam_memory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_items_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_items_source_knowledge_record_id_fkey"
            columns: ["source_knowledge_record_id"]
            isOneToOne: false
            referencedRelation: "knowledge_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_items_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_items_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "sam_memory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_items_venture_id_fkey"
            columns: ["venture_id"]
            isOneToOne: false
            referencedRelation: "ventures"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_memory_versions: {
        Row: {
          change_reason: string | null
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          memory_item_id: string
          organization_id: string
          snapshot: Json
          version_number: number
        }
        Insert: {
          change_reason?: string | null
          change_type: string
          changed_by?: string | null
          created_at?: string
          id?: string
          memory_item_id: string
          organization_id: string
          snapshot: Json
          version_number: number
        }
        Update: {
          change_reason?: string | null
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          memory_item_id?: string
          organization_id?: string
          snapshot?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "sam_memory_versions_memory_item_id_fkey"
            columns: ["memory_item_id"]
            isOneToOne: false
            referencedRelation: "sam_memory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_memory_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_rate_counters: {
        Row: {
          count: number
          day: string
          organization_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          day: string
          organization_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          day?: string
          organization_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_rate_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_response_feedback: {
        Row: {
          conversation_id: string | null
          created_at: string
          feedback_type: Database["public"]["Enums"]["sam_response_feedback_type"]
          id: string
          message_id: string
          note: string | null
          organization_id: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          feedback_type: Database["public"]["Enums"]["sam_response_feedback_type"]
          id?: string
          message_id: string
          note?: string | null
          organization_id: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          feedback_type?: Database["public"]["Enums"]["sam_response_feedback_type"]
          id?: string
          message_id?: string
          note?: string | null
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sam_response_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_response_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "conversation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sam_response_feedback_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sam_settings: {
        Row: {
          allow_memory_proposals: boolean
          challenge_level: string
          enabled: boolean
          include_citations: boolean
          include_founder_memory: boolean
          include_org_memory: boolean
          include_venture_memory: boolean
          memory_review_reminders: boolean
          organization_id: string
          response_style: string
          retain_conversation_history: boolean
          show_confidence: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allow_memory_proposals?: boolean
          challenge_level?: string
          enabled?: boolean
          include_citations?: boolean
          include_founder_memory?: boolean
          include_org_memory?: boolean
          include_venture_memory?: boolean
          memory_review_reminders?: boolean
          organization_id: string
          response_style?: string
          retain_conversation_history?: boolean
          show_confidence?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allow_memory_proposals?: boolean
          challenge_level?: string
          enabled?: boolean
          include_citations?: boolean
          include_founder_memory?: boolean
          include_org_memory?: boolean
          include_venture_memory?: boolean
          memory_review_reminders?: boolean
          organization_id?: string
          response_style?: string
          retain_conversation_history?: boolean
          show_confidence?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sam_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
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
      shares_org_with: { Args: { _a: string; _b: string }; Returns: boolean }
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
      graph_entity_type:
        | "organization"
        | "profile"
        | "member"
        | "venture"
        | "project"
        | "task"
        | "goal"
        | "decision"
        | "commitment"
        | "knowledge"
        | "document"
        | "memory"
        | "activity"
      graph_relationship_type:
        | "belongs_to"
        | "supports"
        | "blocks"
        | "depends_on"
        | "advances"
        | "contradicts"
        | "informs"
        | "derived_from"
        | "related_to"
        | "assigned_to"
        | "owned_by"
        | "supersedes"
        | "caused"
        | "resulted_in"
        | "references"
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
      sam_learning_event_type:
        | "recommendation_accepted"
        | "recommendation_rejected"
        | "recommendation_edited"
        | "recommendation_ignored"
        | "memory_confirmed"
        | "memory_corrected"
        | "memory_rejected"
        | "memory_disputed"
        | "memory_expired"
        | "outcome_completed"
        | "outcome_failed"
        | "outcome_superseded"
      sam_memory_feedback_type:
        | "accurate"
        | "inaccurate"
        | "incomplete"
        | "outdated"
        | "disputed"
      sam_memory_layer:
        | "founder"
        | "organization"
        | "venture"
        | "operational"
        | "historical"
        | "preference"
      sam_memory_source_type:
        | "manual"
        | "profile"
        | "organization_settings"
        | "venture_settings"
        | "knowledge_record"
        | "decision"
        | "commitment"
        | "goal"
        | "conversation"
        | "correction"
        | "proposal"
        | "integration"
      sam_memory_status:
        | "proposed"
        | "confirmed"
        | "disputed"
        | "outdated"
        | "superseded"
        | "archived"
      sam_response_feedback_type:
        | "helpful"
        | "not_helpful"
        | "partially_helpful"
        | "incorrect"
        | "missing_context"
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
      graph_entity_type: [
        "organization",
        "profile",
        "member",
        "venture",
        "project",
        "task",
        "goal",
        "decision",
        "commitment",
        "knowledge",
        "document",
        "memory",
        "activity",
      ],
      graph_relationship_type: [
        "belongs_to",
        "supports",
        "blocks",
        "depends_on",
        "advances",
        "contradicts",
        "informs",
        "derived_from",
        "related_to",
        "assigned_to",
        "owned_by",
        "supersedes",
        "caused",
        "resulted_in",
        "references",
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
      sam_learning_event_type: [
        "recommendation_accepted",
        "recommendation_rejected",
        "recommendation_edited",
        "recommendation_ignored",
        "memory_confirmed",
        "memory_corrected",
        "memory_rejected",
        "memory_disputed",
        "memory_expired",
        "outcome_completed",
        "outcome_failed",
        "outcome_superseded",
      ],
      sam_memory_feedback_type: [
        "accurate",
        "inaccurate",
        "incomplete",
        "outdated",
        "disputed",
      ],
      sam_memory_layer: [
        "founder",
        "organization",
        "venture",
        "operational",
        "historical",
        "preference",
      ],
      sam_memory_source_type: [
        "manual",
        "profile",
        "organization_settings",
        "venture_settings",
        "knowledge_record",
        "decision",
        "commitment",
        "goal",
        "conversation",
        "correction",
        "proposal",
        "integration",
      ],
      sam_memory_status: [
        "proposed",
        "confirmed",
        "disputed",
        "outdated",
        "superseded",
        "archived",
      ],
      sam_response_feedback_type: [
        "helpful",
        "not_helpful",
        "partially_helpful",
        "incorrect",
        "missing_context",
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
