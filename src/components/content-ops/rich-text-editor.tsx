// Minimal Tiptap wrapper used for Body and Creative Brief. Persists a
// platform-safe plain-text value via `editor.getText()`. Visual formatting
// (bold/italic/headings/lists/quote) helps the operator author, but never
// leaks HTML into what the publish adapters send to third parties.

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { Bold, Italic, Heading2, Heading3, List, ListOrdered, Quote, Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";

function textToDoc(text: string): string {
  // Preserve paragraph breaks on hydration; the editor's own state manages
  // formatting from here.
  const safe = (text ?? "").replace(/\r\n?/g, "\n");
  const paras = safe.split(/\n{2,}/).map((p) => {
    const inner = p
      .split("\n")
      .map((line) => line.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!)))
      .join("<br/>");
    return `<p>${inner || "&nbsp;"}</p>`;
  });
  return paras.join("");
}

function docToText(editor: Editor): string {
  // getText with a blockSeparator of \n\n preserves paragraph boundaries
  // for downstream platforms.
  return editor.getText({ blockSeparator: "\n\n" });
}

interface Props {
  value: string;
  onChange: (nextPlainText: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minRows?: number;
  ariaLabel?: string;
}

export function RichTextEditor({ value, onChange, disabled, minRows = 8, ariaLabel }: Props) {
  const initialHtml = useRef(textToDoc(value ?? "")).current;
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
    ],
    editable: !disabled,
    content: initialHtml,
    onUpdate: ({ editor }) => onChange(docToText(editor)),
    editorProps: {
      attributes: {
        "aria-label": ariaLabel ?? "Rich text editor",
        class: cn(
          "prose prose-sm max-w-none focus:outline-none",
          "block w-full border border-foreground/15 bg-background px-3 py-2 text-[14px] leading-relaxed text-foreground",
          "focus:border-foreground/60",
        ),
        style: `min-height:${Math.max(4, minRows) * 1.6}em`,
      },
    },
  });

  // Keep the editor in sync when the parent replaces the value (e.g. after
  // a Restore-from-version). Compares against the current serialized text
  // so we do not clobber in-flight edits.
  useEffect(() => {
    if (!editor) return;
    const current = docToText(editor);
    if ((value ?? "") !== current) {
      editor.commands.setContent(textToDoc(value ?? ""), { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) {
    return (
      <div className="min-h-[8em] w-full border border-foreground/15 bg-background px-3 py-2 text-[13px] text-foreground/50">
        Loading editor...
      </div>
    );
  }

  const btn = "inline-flex h-7 w-7 items-center justify-center border border-foreground/12 text-foreground/70 hover:border-foreground/40 hover:text-foreground disabled:opacity-40";
  const active = "!border-foreground bg-foreground text-background hover:text-background";

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()} className={cn(btn, editor.isActive("bold") && active)} aria-label="Bold" title="Bold"><Bold className="h-3.5 w-3.5" /></button>
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()} className={cn(btn, editor.isActive("italic") && active)} aria-label="Italic" title="Italic"><Italic className="h-3.5 w-3.5" /></button>
        <span className="mx-1 h-4 w-px bg-foreground/15" />
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={cn(btn, editor.isActive("heading", { level: 2 }) && active)} aria-label="Heading 2" title="Heading 2"><Heading2 className="h-3.5 w-3.5" /></button>
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={cn(btn, editor.isActive("heading", { level: 3 }) && active)} aria-label="Heading 3" title="Heading 3"><Heading3 className="h-3.5 w-3.5" /></button>
        <span className="mx-1 h-4 w-px bg-foreground/15" />
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()} className={cn(btn, editor.isActive("bulletList") && active)} aria-label="Bulleted list" title="Bulleted list"><List className="h-3.5 w-3.5" /></button>
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()} className={cn(btn, editor.isActive("orderedList") && active)} aria-label="Numbered list" title="Numbered list"><ListOrdered className="h-3.5 w-3.5" /></button>
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()} className={cn(btn, editor.isActive("blockquote") && active)} aria-label="Quote" title="Quote"><Quote className="h-3.5 w-3.5" /></button>
        <span className="mx-1 h-4 w-px bg-foreground/15" />
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().undo().run()} className={btn} aria-label="Undo" title="Undo"><Undo2 className="h-3.5 w-3.5" /></button>
        <button type="button" disabled={disabled} onClick={() => editor.chain().focus().redo().run()} className={btn} aria-label="Redo" title="Redo"><Redo2 className="h-3.5 w-3.5" /></button>
        <span className="ml-auto text-[10.5px] uppercase tracking-[0.2em] text-foreground/40">Plain-text safe on publish</span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
