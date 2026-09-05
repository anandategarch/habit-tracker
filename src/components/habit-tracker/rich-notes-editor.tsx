'use client';

// ── RichNotesEditor (PHASE4-POLISH) ───────────────────────────────────────
// Minimal TipTap editor that replaces the plain <Textarea> for the daily
// reflection notes. Stores HTML in the same DailyLog.notes column — fully
// backward compatible with plain-text legacy notes (rendered as-is).
//
// Design decisions:
//  - Only THREE toolbar buttons: Bold, Italic, BulletList. Spec demanded
//    minimal — no headings, no images, no code blocks. The StarterKit is
//    bundled but only these three are exposed in the UI.
//  - Content is the editor's HTML output (`editor.getHTML()`). Empty content
//    yields "<p></p>" which we normalize to "" before save so legacy empty
//    notes remain empty in the DB.
//  - Debounced save stays the responsibility of the parent (daily-tracker
//    passes an onChange callback that mirrors the textarea's old onChange).

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useCallback, useRef } from 'react';
import { Bold, Italic, List } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RichNotesEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

// Toolbar button — reflects the active state of its associated mark/node.
function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors',
        'text-muted-foreground hover:bg-muted hover:text-foreground',
        active && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
        disabled && 'opacity-40 pointer-events-none',
      )}
    >
      {children}
    </button>
  );
}

export function RichNotesEditor({
  value,
  onChange,
  placeholder = 'Bagaimana harimu? Tulis refleksi di sini…',
  className,
}: RichNotesEditorProps) {
  // ── Editor instance ──────────────────────────────────────────────────────
  // `editable` defaults to true. The editor is uncontrolled for performance:
  // we DO NOT call editor.commands.setContent on every keystroke — only on
  // external value changes (e.g. date navigation, which swaps the entire
  // note). The on-update callback propagates the new HTML up to the parent.
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable everything we don't expose in the UI to keep the editor
        // minimal and prevent paste/upload from injecting unexpected marks.
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        orderedList: false, // only bullet list is exposed
        strike: false,
        code: false,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'min-h-[80px] outline-none',
          'text-sm leading-relaxed',
          'placeholder:text-muted-foreground/50',
          className,
        ),
      },
    },
    // Fire onChange on every edit. We strip the empty-paragraph placeholder
    // so legacy empty notes stay empty in storage.
    onUpdate: ({ editor: ed }) => {
      const html = ed.isEmpty ? '' : ed.getHTML();
      onChange(html);
    },
    // Prevent the editor from stealing focus on mount — the daily-tracker
    // grid should remain the primary focus.
    autofocus: false,
    immediatelyRender: false,
  });

  // ── Sync external value → editor (e.g. when date changes) ────────────────
  // Only update if the external value differs from the editor's current HTML
  // to avoid a feedback loop (editor → onChange → value → setContent → editor).
  // Using a ref to track the last externally-applied value avoids re-running
  // the effect on every keystroke (which would jump the caret to position 0).
  const lastExternalValueRef = useRef(value);
  useEffect(() => {
    if (!editor) return;
    // If the editor itself triggered the change, the value already matches
    // and we skip the setContent (which would reset caret position).
    if (value === lastExternalValueRef.current) return;
    lastExternalValueRef.current = value;
    // TipTap v3: setContent takes an options object. emitUpdate:false
    // prevents an onUpdate callback (which would loop back through
    // onChange → value → this effect). Other defaults are fine.
    editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  // ── Toolbar handlers ─────────────────────────────────────────────────────
  const toggleBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const toggleItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
  const toggleBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);

  if (!editor) {
    // Render an empty placeholder div of the same height to avoid layout shift
    return (
      <div className={cn('min-h-[112px] rounded-md', className)} aria-busy="true" />
    );
  }

  return (
    <div className="rounded-md">
      {/* Toolbar — 3 buttons only */}
      <div className="flex items-center gap-0.5 mb-1.5 -mt-1">
        <ToolbarButton
          active={editor.isActive('bold')}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          onClick={toggleBold}
          label="Tebal"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          onClick={toggleItalic}
          label="Miring"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          disabled={!editor.can().chain().focus().toggleBulletList().run()}
          onClick={toggleBulletList}
          label="Daftar poin"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

// Silence the unused-import warning for the Editor type re-export guard.
export type { Editor };
