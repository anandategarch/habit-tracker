// ---------------------------------------------------------------------------
// src/components/work/note-kilat-input.tsx — input "catatan kilat" 1 baris di
// atas sub-tab Catatan (pecahan Task 71-e dari work-notes.tsx).
// ---------------------------------------------------------------------------
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Zap } from 'lucide-react';
import { MiniSpinner } from './work-shared';
import { useSaveNote } from './use-work-api';

export function KilatInput({ date }: { date: string }) {
  const saveNote = useSaveNote(date);
  const [draft, setDraft] = useState('');
  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setDraft('');
    saveNote.mutate({ content: trimmed });
  };
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Zap className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-warning" aria-hidden="true" />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Catatan kilat 1 baris, tekan Enter…"
          aria-label="Tulis catatan kilat"
          maxLength={200}
          className="pl-9"
        />
      </div>
      <Button
        type="button"
        size="icon"
        onClick={submit}
        disabled={!draft.trim() || saveNote.isPending}
        aria-label="Simpan catatan"
        className="btn-primary-gradient shrink-0"
      >
        {saveNote.isPending ? <MiniSpinner className="text-white" /> : <Check className="h-4 w-4" />}
      </Button>
    </div>
  );
}
