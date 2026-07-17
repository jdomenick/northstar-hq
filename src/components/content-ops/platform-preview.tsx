// Platform-shaped preview panel. Renders one variant in a low-fidelity
// approximation of how it will look on the destination. The goal is
// "recognisable at a glance", not pixel-perfect - we deliberately keep it
// Paper & Ink so it composes into the editor without visual dissonance.

import { type ReactNode } from "react";
import { getPlatformConfig, type EditorPlatform } from "@/lib/content-ops/platform-registry";

export interface PreviewData {
  platform: EditorPlatform;
  title: string | null;
  hook: string | null;
  body: string;
  cta: string | null;
  hashtags: string[];
  mentions: string[];
  linkUrl: string | null;
  firstComment: string | null;
  newsletterSubject: string | null;
  newsletterPreview: string | null;
  media: Array<{ storageRef: string; mimeType: string; altText: string | null }>;
}

function composedBody(v: PreviewData): string {
  const parts: string[] = [];
  if (v.hook) parts.push(v.hook);
  parts.push(v.body);
  if (v.cta) parts.push(v.cta);
  return parts.join("\n\n");
}

function MediaGrid({ media }: { media: PreviewData["media"] }) {
  if (!media.length) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-1 border border-foreground/12 bg-foreground/[0.03] p-1">
      {media.slice(0, 4).map((m, i) => (
        <div
          key={m.storageRef + i}
          className="grid aspect-square place-items-center bg-foreground/[0.05] px-2 text-[10px] uppercase tracking-[0.2em] text-foreground/50"
          title={m.altText ?? undefined}
        >
          {m.mimeType.startsWith("video/") ? "video" : "image"}
          {media.length > 4 && i === 3 ? ` +${media.length - 4}` : ""}
        </div>
      ))}
    </div>
  );
}

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border border-foreground/12 bg-card/70">
      <div className="border-b border-foreground/12 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.24em] text-foreground/55">
        {label}
      </div>
      <div className="p-4 text-[13.5px] leading-[1.55] text-foreground/90">{children}</div>
    </div>
  );
}

export function PlatformPreview({ data }: { data: PreviewData }) {
  const cfg = getPlatformConfig(data.platform);
  const shape = cfg.previewShape;

  if (shape === "microblog") {
    // X / Bluesky / Threads style - single card, tight body limit, hashtags inline.
    return (
      <Frame label={`${cfg.displayName} preview`}>
        <div className="whitespace-pre-wrap">{composedBody(data)}</div>
        {data.hashtags.length > 0 && (
          <div className="mt-2 text-[13px] text-foreground/70">
            {data.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")}
          </div>
        )}
        {data.linkUrl && (
          <div className="mt-2 truncate text-[12px] text-foreground/60 underline">{data.linkUrl}</div>
        )}
        <MediaGrid media={data.media} />
      </Frame>
    );
  }

  if (shape === "community") {
    // Reddit-style: title first, then self-post body.
    return (
      <Frame label="Reddit preview">
        <div className="font-medium text-foreground">{data.title || "(missing title)"}</div>
        <div className="mt-3 whitespace-pre-wrap text-[13px] text-foreground/85">{composedBody(data)}</div>
        {data.linkUrl && (
          <div className="mt-2 truncate text-[12px] text-foreground/60 underline">{data.linkUrl}</div>
        )}
        <MediaGrid media={data.media} />
        {data.firstComment && (
          <div className="mt-4 border-l-2 border-foreground/20 pl-3 text-[12.5px] text-foreground/70">
            <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/55">First comment</div>
            <div className="mt-1 whitespace-pre-wrap">{data.firstComment}</div>
          </div>
        )}
      </Frame>
    );
  }

  if (shape === "newsletter" || shape === "email") {
    return (
      <Frame label={`${cfg.displayName} preview`}>
        {data.newsletterSubject && (
          <div className="font-display text-[20px] leading-tight text-foreground">
            {data.newsletterSubject}
          </div>
        )}
        {data.newsletterPreview && (
          <div className="mt-1 text-[12.5px] text-foreground/60">{data.newsletterPreview}</div>
        )}
        {data.title && (
          <div className="mt-4 font-display text-[26px] leading-tight text-foreground">{data.title}</div>
        )}
        <MediaGrid media={data.media} />
        <div className="mt-4 whitespace-pre-wrap text-[13.5px] text-foreground/90">{composedBody(data)}</div>
        {data.linkUrl && (
          <div className="mt-4">
            <span className="inline-block border border-foreground bg-foreground px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-background">
              {data.cta || "Read more"}
            </span>
          </div>
        )}
      </Frame>
    );
  }

  // Default feed shape: Facebook / Instagram / LinkedIn / YouTube / Pinterest / TikTok.
  return (
    <Frame label={`${cfg.displayName} preview`}>
      {data.title && (
        <div className="font-display text-[18px] leading-tight text-foreground">{data.title}</div>
      )}
      <MediaGrid media={data.media} />
      <div className="mt-3 whitespace-pre-wrap">{composedBody(data)}</div>
      {data.hashtags.length > 0 && (
        <div className="mt-2 text-[12.5px] text-foreground/60">
          {data.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")}
        </div>
      )}
      {data.mentions.length > 0 && (
        <div className="mt-1 text-[12.5px] text-foreground/60">
          {data.mentions.map((m) => (m.startsWith("@") ? m : `@${m}`)).join(" ")}
        </div>
      )}
      {data.linkUrl && (
        <div className="mt-2 truncate text-[12px] text-foreground/60 underline">{data.linkUrl}</div>
      )}
      {data.firstComment && cfg.fields.firstComment !== "unsupported" && (
        <div className="mt-4 border-l-2 border-foreground/20 pl-3 text-[12.5px] text-foreground/70">
          <div className="text-[10px] uppercase tracking-[0.2em] text-foreground/55">First comment</div>
          <div className="mt-1 whitespace-pre-wrap">{data.firstComment}</div>
        </div>
      )}
    </Frame>
  );
}
