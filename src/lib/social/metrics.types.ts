import type { SocialPlatform } from "@/lib/constants";

export interface SocialContentMetricDescriptor {
  id: string;
  organizationId: string;
  ventureId: string;
  socialAccountId: string;
  contentItemId: string;
  platform: SocialPlatform | string;
  externalPostId: string;
  measurementWindow: string;
  measuredAt: string;
  impressions: number | null;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  linkClicks: number | null;
  watchTimeSeconds: number | null;
  completionRate: number | null;
  follows: number | null;
  leads: number | null;
  conversions: number | null;
  engagementRate: number | null;
  rawMetricsSummary: Record<string, unknown>;
  connectorVersion: string;
  createdAt: string;
}