// Provider-neutral integration + ingestion contracts. Server-safe (no browser imports).
// Runtime tables live in Supabase; these types are the shape the framework speaks.

import type { ContentCategory, ContentReviewState, SourceTrustLevel } from "@/lib/constants";

export type IntegrationProvider =
  | "website"
  | "supabase"
  | "rest_api"
  | "webhook"
  | "csv_import"
  | "json_import"
  | "api_token"
  | "other";

export type IntegrationConnectionType =
  | "website"
  | "database"
  | "rest"
  | "webhook"
  | "file_import"
  | "api_token";

export type IntegrationConnectionStatus =
  | "pending"
  | "active"
  | "error"
  | "disabled"
  | "archived";

export type IntegrationSourceType =
  | "webpage"
  | "sitemap"
  | "blog"
  | "docs"
  | "db_table"
  | "rest_endpoint"
  | "webhook_topic"
  | "csv_file"
  | "json_file"
  | "manual"
  | "other";

export type IntegrationSyncStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "partial"
  | "failed"
  | "cancelled";

export type ContentVerificationStatus =
  | "unverified"
  | "reviewed"
  | "verified"
  | "disputed"
  | "rejected";

export type ContentFreshnessStatus =
  | "fresh"
  | "aging"
  | "stale"
  | "inaccessible"
  | "unknown";

// ─────────────────────────────────────────────
// Domain shapes (framework-level, not DB rows)
// ─────────────────────────────────────────────

export interface ConnectionScope {
  organizationId: string;
  ventureId: string | null;
}

export interface ConnectionDescriptor {
  id: string;
  provider: IntegrationProvider;
  connectionType: IntegrationConnectionType;
  displayName: string;
  status: IntegrationConnectionStatus;
  scope: ConnectionScope;
  settings: Record<string, unknown>;
  credentialsReference: string | null;
}

export interface SourceDescriptor {
  id: string;
  connectionId: string | null;
  scope: ConnectionScope;
  sourceType: IntegrationSourceType;
  sourceUrl: string | null;
  externalId: string | null;
  title: string;
  category: ContentCategory | null;
  trustLevel: SourceTrustLevel;
  syncEnabled: boolean;
  metadata: Record<string, unknown>;
}

export interface NormalizedContent {
  externalId: string | null;
  canonicalUrl: string | null;
  title: string;
  contentText: string | null;
  contentSummary: string | null;
  publishedAt: string | null;
  modifiedAt: string | null;
  author: string | null;
  category: ContentCategory | null;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface SyncRunSummary {
  discovered: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  durationMs: number;
}

export interface ConnectorSyncContext {
  scope: ConnectionScope;
  connection: ConnectionDescriptor;
  source: SourceDescriptor | null;
  startedAt: string;
}

export interface ConnectorSyncResult {
  items: NormalizedContent[];
  discovered: number;
  skipped: number;
  failed: number;
  metadata?: Record<string, unknown>;
}

// Connector contract every provider implementation must satisfy.
export interface IntegrationConnector {
  readonly provider: IntegrationProvider;
  readonly connectionType: IntegrationConnectionType;
  readonly version: string;

  validateSettings(settings: Record<string, unknown>): Record<string, unknown>;

  sync(ctx: ConnectorSyncContext): Promise<ConnectorSyncResult>;
}

export interface InboxItemDescriptor {
  id: string;
  scope: ConnectionScope;
  title: string;
  reviewStatus: ContentReviewState;
  verificationStatus: ContentVerificationStatus;
  freshnessStatus: ContentFreshnessStatus;
}