// Capability-filtered metric selection for Meta v25.0.
// Never returns invented values. When a metric is not applicable, we
// omit it - callers surface "unavailable" rather than zero.

export type MetaPlatform = "facebook" | "instagram";

export const FACEBOOK_POST_METRICS = [
  "post_impressions",
  "post_impressions_organic",
  "post_reactions_by_type_total",
  "post_clicks",
  "post_video_views",
] as const;

export const INSTAGRAM_MEDIA_METRICS = [
  "reach",
  "likes",
  "comments",
  "saved",
  "shares",
  "views",
  "total_interactions",
  "profile_activity",
  "profile_visits",
  "follows",
  "reposts",
] as const;

export interface MetricSelectionInput {
  provider: MetaPlatform;
  grantedPermissions: string[];
  contentType: "text" | "image" | "carousel" | "short_video" | "long_video" | "reel" | "story" | string;
}

export function selectMetricsFor(input: MetricSelectionInput): string[] {
  if (input.provider === "facebook") {
    if (!input.grantedPermissions.includes("pages_read_engagement")) return [];
    const base = ["post_impressions", "post_impressions_organic", "post_reactions_by_type_total", "post_clicks"];
    if (input.contentType === "short_video" || input.contentType === "long_video") {
      base.push("post_video_views");
    }
    return base;
  }
  if (!input.grantedPermissions.includes("instagram_manage_insights")) return [];
  const base = ["reach", "likes", "comments", "saved", "shares", "total_interactions"];
  if (input.contentType === "reel" || input.contentType === "short_video") base.push("views");
  return base;
}
