'use client';

// components/habit-tracker/rich-notes-editor.tsx — editor catatan harian.
//
// GELOMBANG 1 (rebuild): TipTap diganti textarea premium polos — TANPA
// dependensi baru (sesuai brief). Sepenuhnya CONTROLLED (tanpa state
// internal): sinkronisasi tanggal / re-seed query ditangani parent lewat
// props value, autosave tetap lewat debounce parent (onChange → 600 ms).
// Catatan lama berformat HTML era TipTap dibersihkan parent memakai
// htmlToPlainText() dari ./daily-tracker-helpers sebelum masuk ke sini.

interface RichNotesEditorProps {
  /** Isi catatan (teks polos; HTML lama sudah dibersihkan parent). */
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  className?: string;
  /** Jumlah baris minimum. */
  minRows?: number;
  disabled?: boolean;
}

export function RichNotesEditor({
  value,
  onChange,
  placeholder,
  className,
  minRows = 4,
  disabled,
}: RichNotesEditorProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'Bagaimana harimu? Tulis refleksi di sini…'}
      rows={minRows}
      spellCheck={false}
      disabled={disabled}
      aria-label="Catatan harian"
      className={
        'w-full resize-none bg-transparent border-0 outline-none focus:ring-0 focus-visible:ring-0 p-0 text-sm leading-relaxed placeholder:text-muted-foreground/50 disabled:opacity-60 ' +
        (className ?? '')
      }
    />
  );
}
