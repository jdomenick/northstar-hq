import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { toConversationalText } from "@/lib/sam/humanize";

type Block =
  | { kind: "p"; text: string }
  | { kind: "label"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "p", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list && list.items.length) {
      blocks.push(list.ordered ? { kind: "ol", items: list.items } : { kind: "ul", items: list.items });
    }
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const ol = /^(\d+)[.)]\s+(.*)$/.exec(line);
    const ul = /^[-*\u2022]\s+(.*)$/.exec(line);
    if (ol) {
      flushParagraph();
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(ol[2]);
      continue;
    }
    if (ul) {
      flushParagraph();
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }
    flushList();
    if (/^[A-Z][^.!?]{2,48}:$/.test(line)) {
      flushParagraph();
      blocks.push({ kind: "label", text: line.replace(/:$/, "") });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

/** Emphasise a leading "Name: detail" pattern inside list items. */
function ListItemText({ text }: { text: string }) {
  const m = /^([^:]{2,48}):\s+(.+)$/.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      <span className="font-medium text-foreground">{m[1]}</span> {m[2]}
    </>
  );
}

/**
 * The single safe renderer for SAM assistant output. Used by every SAM
 * surface (desktop and mobile floating messenger included) so structured
 * payloads can never reach the transcript.
 */
export function SamMessageBody({ content, className }: { content: string; className?: string }) {
  const blocks = useMemo(() => parseBlocks(toConversationalText(content)), [content]);

  if (blocks.length === 0) return null;

  return (
    <div className={cn("space-y-2.5", className)}>
      {blocks.map((b, i) => {
        if (b.kind === "p") return <p key={i}>{b.text}</p>;
        if (b.kind === "label")
          return (
            <p
              key={i}
              className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground"
            >
              {b.text}
            </p>
          );
        if (b.kind === "ol")
          return (
            <ol key={i} className="space-y-1.5 pl-5">
              {b.items.map((it, j) => (
                <li key={j} className="list-decimal">
                  <ListItemText text={it} />
                </li>
              ))}
            </ol>
          );
        return (
          <ul key={i} className="space-y-1 pl-5">
            {b.items.map((it, j) => (
              <li key={j} className="list-disc">
                <ListItemText text={it} />
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}
