'use client';

// components/habit-tracker/habit-form-basic-fields.tsx — bagian form habit:
// identitas (nama + emoji + picker), klasifikasi (kategori/prioritas/grup),
// dan target + kesulitan. (Pemecahan habit-master.tsx, Task 71-b — markup
// dipindah apa adanya.)

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { HabitOptionRow } from '@/hooks/use-habit-options';
import { DEFAULT_EMOJIS } from './habit-master-types';
import type { HabitGroup } from './habit-master-types';
import type { HabitFormSession } from './use-habit-master-form';

export interface HabitFormBasicFieldsProps {
  session: HabitFormSession;
  categories: HabitOptionRow[];
  priorities: HabitOptionRow[];
  difficulties: HabitOptionRow[];
  groups: HabitGroup[];
}

export function HabitFormBasicFields({
  session,
  categories,
  priorities,
  difficulties,
  groups,
}: HabitFormBasicFieldsProps) {
  const { form, updateForm, formEmojiPicker, setFormEmojiPicker } = session;

  return (
    <>
      {/* Row: Name + Icon */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
        <div className="space-y-2">
          <Label htmlFor="habit-name">
            Nama <span className="text-destructive">*</span>
          </Label>
          <Input
            id="habit-name"
            placeholder="misal Meditasi Pagi"
            value={form.name}
            onChange={(e) => updateForm('name', e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="habit-emoji">Emoji</Label>
          <div className="relative" data-emoji-popover-wrap>
            <Input
              id="habit-emoji"
              className="w-20 text-center text-xl rounded-xl"
              value={form.icon}
              onChange={(e) => updateForm('icon', e.target.value)}
              onFocus={() => setFormEmojiPicker(true)}
              maxLength={11}
              aria-label="Emoji habit"
            />
            {formEmojiPicker && (
              <div className="absolute top-full mt-1.5 z-50 rounded-2xl border border-border bg-popover/95 backdrop-blur shadow-lg p-2 grid grid-cols-4 gap-1 w-48">
                {DEFAULT_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="text-2xl hover:bg-accent rounded-xl p-1.5 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                    aria-label={`Pilih emoji ${e}`}
                    onClick={() => {
                      updateForm('icon', e);
                      setFormEmojiPicker(false);
                    }}
                  >
                    {e}
                  </button>
                ))}
                <button
                  type="button"
                  className="col-span-4 text-xs text-muted-foreground hover:text-foreground py-1.5 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                  onClick={() => setFormEmojiPicker(false)}
                >
                  tutup
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row: Category + Priority + Grup */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Kategori</Label>
          <Select
            value={form.category}
            onValueChange={(v) => updateForm('category', v)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.label}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Prioritas</Label>
          <Select
            value={form.priority}
            onValueChange={(v) => updateForm('priority', v)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorities.map((p) => (
                <SelectItem key={p.id} value={p.label}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Grup</Label>
          <Select
            value={form.groupId || '__none__'}
            onValueChange={(v) => updateForm('groupId', v === '__none__' ? null : v)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Tanpa Grup" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Tanpa Grup</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row: Target + Kesulitan (Tipe Target lama dihapus — digantikan
          Jadwal Tampil di bawah; targetType tetap dipertahankan di
          payload untuk data lama, BUG-14). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Target</Label>
          <Input
            type="number"
            min={1}
            max={form.habitType === 'amount' ? 1000 : 1}
            value={form.target}
            onChange={(e) => {
              // BUG-3 fix: clamp target to 1. The UI only sends binary
              // completion (done/not-done); allowing target > 1 would
              // create a habit that can never be "completed" since the
              // UI never increments `value` past 1. Existing habits
              // with target > 1 (legacy data) are left untouched by
              // this clamp — only new edits are affected.
              //
              // PHASE3-HABIT: for "amount" habits (daily goal with a
              // numeric target, e.g. "drink 2L water"), allow target
              // up to 1000. The HabitLog.value column tracks progress
              // toward this target.
              const max = form.habitType === 'amount' ? 1000 : 1;
              const n = Number(e.target.value) || 1;
              updateForm('target', Math.min(max, Math.max(1, n)));
            }}
            className="rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            {form.habitType === 'amount'
              ? 'Target harian (mis. 2 untuk 2 gelas, 30 untuk 30 menit).'
              : 'Multi-completion (target > 1) belum didukung.'}
          </p>
        </div>
        <div className="space-y-2">
          <Label>Level Kesulitan</Label>
          <Select
            value={form.difficulty}
            onValueChange={(v) => updateForm('difficulty', v)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {difficulties.map((d) => (
                <SelectItem key={d.id} value={d.label}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  );
}
