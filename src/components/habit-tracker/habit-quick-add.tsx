'use client';

// components/habit-tracker/habit-quick-add.tsx — bar quick-add habit
// (nama + emoji → POST /api/habits lewat handler parent).

import { Plus, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DEFAULT_EMOJIS } from './habit-master-types';

export interface QuickAddBarProps {
  quickIcon: string;
  setQuickIcon: (v: string) => void;
  quickName: string;
  setQuickName: (v: string) => void;
  handleQuickAdd: () => void | Promise<void>;
  quickAdding: boolean;
  showEmojiPicker: boolean;
  setShowEmojiPicker: (v: boolean) => void;
}

export function QuickAddBar({
  quickIcon,
  setQuickIcon,
  quickName,
  setQuickName,
  handleQuickAdd,
  quickAdding,
  showEmojiPicker,
  setShowEmojiPicker,
}: QuickAddBarProps) {
  return (
    <div className="premium-card rounded-2xl p-3 sm:p-4">
      <div className="flex items-center gap-2">
        {/* Tombol emoji → picker grid — data-emoji-popover-wrap: penanda
            efek tutup-klik-luar di habit-master (Task 61, revisi pusat) */}
        <div className="relative shrink-0" data-emoji-popover-wrap>
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            aria-label="Pilih emoji habit"
            aria-expanded={showEmojiPicker}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted/40 text-2xl transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            {quickIcon}
          </button>
          {showEmojiPicker && (
            <div className="absolute top-full left-0 z-50 mt-1.5 grid w-56 grid-cols-5 gap-1 rounded-2xl border border-border bg-popover/95 p-2 shadow-lg backdrop-blur">
              {DEFAULT_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="flex min-h-[40px] items-center justify-center rounded-xl text-2xl transition-all hover:bg-accent active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                  aria-label={`Pilih emoji ${e}`}
                  onClick={() => {
                    setQuickIcon(e);
                    setShowEmojiPicker(false);
                  }}
                >
                  {e}
                </button>
              ))}
              <button
                type="button"
                className="col-span-5 rounded-xl py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                onClick={() => setShowEmojiPicker(false)}
              >
                tutup
              </button>
            </div>
          )}
        </div>

        <Input
          value={quickName}
          onChange={(e) => setQuickName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && quickName.trim() && !quickAdding) {
              e.preventDefault();
              void handleQuickAdd();
            }
          }}
          placeholder="Tambah habit cepat (misal Tidur lebih awal)..."
          maxLength={60}
          className="rounded-xl h-10"
          aria-label="Nama habit baru (quick add)"
        />

        <Button
          size="sm"
          onClick={() => void handleQuickAdd()}
          disabled={quickAdding || !quickName.trim()}
          className="btn-primary-gradient h-10 shrink-0"
        >
          {quickAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
          Tambah
        </Button>
      </div>
    </div>
  );
}
