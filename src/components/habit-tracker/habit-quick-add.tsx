'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { DEFAULT_EMOJIS } from './habit-master-types';

interface QuickAddBarProps {
  quickIcon: string;
  setQuickIcon: (v: string) => void;
  quickName: string;
  setQuickName: (v: string) => void;
  handleQuickAdd: () => void;
  quickAdding: boolean;
  showEmojiPicker: boolean;
  setShowEmojiPicker: (v: boolean) => void;
}

export function QuickAddBar({
  quickIcon, setQuickIcon, quickName, setQuickName,
  handleQuickAdd, quickAdding, showEmojiPicker, setShowEmojiPicker,
}: QuickAddBarProps) {
  return (
    // Div polong premium-card (pola agent 2-a/2-b/2-c) + dashed inner drop
    // area untuk afordansi "tambah cepat".
    <div className="premium-card premium-card-hover rounded-2xl p-2.5">
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-primary/25 p-2 transition-colors focus-within:border-primary/40">
        <div className="relative shrink-0">
          <button
            type="button"
            className="chip-soft h-10 w-10 text-xl cursor-pointer hover:bg-accent/60 transition-colors active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            aria-label={`Pilih emoji habit, sekarang ${quickIcon}`}
          >
            {quickIcon}
          </button>
          {showEmojiPicker && (
            <div className="absolute top-full mt-1.5 z-50 rounded-2xl border border-border bg-popover/95 backdrop-blur shadow-lg p-2 grid grid-cols-4 gap-1 w-48">
              {DEFAULT_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="text-2xl hover:bg-accent rounded-xl p-1.5 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                  onClick={() => {
                    setQuickIcon(e);
                    setShowEmojiPicker(false);
                  }}
                  aria-label={`Pilih emoji ${e}`}
                >
                  {e}
                </button>
              ))}
              <button
                type="button"
                className="col-span-4 text-xs text-muted-foreground hover:text-foreground py-1.5 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                onClick={() => setShowEmojiPicker(false)}
              >
                tutup
              </button>
            </div>
          )}
        </div>
        <Input
          placeholder="Tambah cepat habit..."
          className="flex-1 rounded-xl bg-transparent"
          value={quickName}
          onChange={(e) => setQuickName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleQuickAdd();
          }}
          disabled={quickAdding}
          aria-label="Nama habit baru (tambah cepat)"
        />
        <Button
          onClick={handleQuickAdd}
          disabled={quickAdding || !quickName.trim()}
          className="btn-primary-gradient gap-1 shrink-0 h-10"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Tambah
        </Button>
      </div>
    </div>
  );
}

export default QuickAddBar;
