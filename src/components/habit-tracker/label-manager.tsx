'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Plus, Pencil, Trash2, Check, X, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { LABEL_COLORS } from '@/lib/label-colors';
import { useHabitOptions, type HabitOption } from '@/hooks/use-habit-options';

type OptionType = 'category' | 'priority' | 'difficulty';

const TABS: { type: OptionType; label: string; description: string }[] = [
  { type: 'category', label: 'Kategori', description: 'Kelompokkan habit berdasarkan tipe' },
  { type: 'priority', label: 'Prioritas', description: 'Atur tingkat urgensi' },
  { type: 'difficulty', label: 'Level Kesulitan', description: 'Definisikan level kesulitan & XP' },
];

// Color keys to show in the picker
const COLOR_KEYS = Object.keys(LABEL_COLORS);

// Inline item editor state
interface EditState {
  id: string;
  name: string;
  color: string;
  xp: number;
}

export default function LabelManager() {
  const { categories, priorities, difficulties, loading, refetch } = useHabitOptions();
  const [activeTab, setActiveTab] = useState<OptionType>('category');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addState, setAddState] = useState<EditState>({
    id: '',
    name: '',
    color: COLOR_KEYS[0],
    xp: 10,
  });
  const [saving, setSaving] = useState(false);

  // Usage count per label — reuses the shared ['habits'] query cache
  // (read-only, deduped by TanStack; no new endpoint, no mutation). Only used
  // for display ("dipakai N habit") and the delete-confirm description.
  const { data: habits = [] } = useQuery<{ category: string; priority: string; difficulty: string }[]>({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await fetch('/api/habits');
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30_000,
  });

  const getUsageCount = useCallback((name: string) => {
    return habits.filter((h) =>
      activeTab === 'category'
        ? h.category === name
        : activeTab === 'priority'
          ? h.priority === name
          : h.difficulty === name
    ).length;
  }, [habits, activeTab]);

  const getItems = useCallback((): HabitOption[] => {
    switch (activeTab) {
      case 'category': return categories;
      case 'priority': return priorities;
      case 'difficulty': return difficulties;
      default: return [];
    }
  }, [activeTab, categories, priorities, difficulties]);

  const items = getItems();

  const handleStartEdit = useCallback((item: HabitOption) => {
    setEditingId(item.id);
    setEditState({ id: item.id, name: item.name, color: item.color, xp: item.xp });
    setIsAdding(false);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditState(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editState || !editState.name.trim()) {
      toast.error('Nama wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/habit-options/${editState.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editState.name.trim(),
          color: editState.color,
          ...(activeTab === 'difficulty' ? { xp: editState.xp } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update');
      }
      toast.success('Berhasil diperbarui');
      setEditingId(null);
      setEditState(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal memperbarui');
    } finally {
      setSaving(false);
    }
  }, [editState, activeTab, refetch]);

  const handleDelete = useCallback(async (item: HabitOption) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/habit-options/${item.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete');
      }
      toast.success(`"${item.name}" dihapus`);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setSaving(false);
    }
  }, [refetch]);

  const handleStartAdd = useCallback(() => {
    setIsAdding(true);
    setEditingId(null);
    setEditState(null);
    setAddState({
      id: '',
      name: '',
      color: COLOR_KEYS[0],
      xp: 10,
    });
  }, []);

  const handleCancelAdd = useCallback(() => {
    setIsAdding(false);
  }, []);

  const handleSaveAdd = useCallback(async () => {
    if (!addState.name.trim()) {
      toast.error('Nama wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/habit-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab,
          name: addState.name.trim(),
          color: addState.color,
          ...(activeTab === 'difficulty' ? { xp: addState.xp } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create');
      }
      toast.success('Berhasil dibuat');
      setIsAdding(false);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat');
    } finally {
      setSaving(false);
    }
  }, [addState, activeTab, refetch]);

  const currentTabInfo = TABS.find(t => t.type === activeTab)!;

  return (
    <div className="premium-card premium-card-sheen rounded-2xl">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
        <span className="chip-soft chip-soft-violet h-9 w-9" aria-hidden="true">
          <Tags className="h-4 w-4" />
        </span>
        <h3 className="text-base font-semibold">Label Habit</h3>
      </div>
      <div className="space-y-4 px-5 pb-5 sm:px-6 sm:pb-6">
        {/* Tabs — premium segmented control */}
        <div
          className="premium-segment w-full"
          role="group"
          aria-label="Jenis label"
        >
          {TABS.map(tab => (
            <button
              key={tab.type}
              type="button"
              onClick={() => {
                setActiveTab(tab.type);
                setEditingId(null);
                setEditState(null);
                setIsAdding(false);
              }}
              data-active={activeTab === tab.type}
              aria-pressed={activeTab === tab.type}
              className="premium-segment-item flex-1 data-[active=true]:bg-primary data-[active=true]:shadow-sm"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">{currentTabInfo.description}</p>

        {/* Item list */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-7 w-7 rounded" />
                  <Skeleton className="h-7 w-7 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-xl border border-border/70 p-1">
            {items.length === 0 && !isAdding && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Belum ada {currentTabInfo.type}. Tambahkan di bawah.
              </div>
            )}

            {items.map(item => {
              const usage = getUsageCount(item.name);
              return (
              <div key={item.id}>
                {editingId === item.id && editState ? (
                  /* Editing row */
                  <div className="px-3 py-2.5 space-y-2 border-b border-border/60 last:border-b-0">
                    <ColorPicker
                      selected={editState.color}
                      onSelect={(color) => setEditState(prev => prev ? { ...prev, color } : prev)}
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        value={editState.name}
                        onChange={(e) => setEditState(prev => prev ? { ...prev, name: e.target.value } : prev)}
                        placeholder="Nama"
                        className="h-8 text-xs flex-1 rounded-lg"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                      />
                      {activeTab === 'difficulty' && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">XP</span>
                          <Input
                            type="number"
                            min={0}
                            value={editState.xp}
                            onChange={(e) => setEditState(prev => prev ? { ...prev, xp: parseInt(e.target.value) || 0 } : prev)}
                            className="h-8 text-xs w-16 rounded-lg"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                        </div>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={handleSaveEdit}
                        disabled={saving}
                        aria-label="Simpan perubahan"
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-success" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={handleCancelEdit}
                        disabled={saving}
                        aria-label="Batal edit"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Display row — premium list item */
                  <div className="premium-list-item group">
                    <span
                      className="h-3 w-3 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                      style={{ backgroundColor: LABEL_COLORS[item.color]?.hex || LABEL_COLORS.gray.hex }}
                    />
                    <span className="text-sm font-medium truncate flex-1 min-w-0">{item.name}</span>
                    {activeTab === 'difficulty' && (
                      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{item.xp} XP</span>
                    )}
                    <span
                      className="text-[11px] text-muted-foreground/80 tabular-nums whitespace-nowrap hidden sm:inline"
                      title={`Dipakai ${usage} habit`}
                    >
                      {usage} dipakai
                    </span>
                    <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleStartEdit(item)}
                        disabled={saving}
                        aria-label={`Edit ${item.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {/* Delete confirmation — previously one click destroyed the
                          label instantly. Wrapped in AlertDialog (same pattern
                          as habit/goal delete confirms); handler unchanged. */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring/60"
                            disabled={saving}
                            aria-label={`Hapus ${item.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus label?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Yakin ingin menghapus {currentTabInfo.label.toLowerCase()}{' '}
                              &ldquo;{item.name}&rdquo;?
                              {usage > 0
                                ? ` Label ini masih dipakai ${usage} habit — habit tersebut tidak ikut terhapus.`
                                : ' Label ini tidak sedang dipakai habit mana pun.'}
                              {' '}Tindakan ini tidak bisa dibatalkan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(item)}
                              disabled={saving}
                              className="bg-destructive hover:bg-destructive text-white focus:ring-destructive"
                            >
                              {saving ? 'Menghapus...' : 'Hapus'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </div>
              );
            })}

            {/* Add new form */}
            {isAdding && (
              <div className="px-3 py-2.5 space-y-2 bg-muted/30 rounded-lg mt-1">
                <ColorPicker
                  selected={addState.color}
                  onSelect={(color) => setAddState(prev => ({ ...prev, color }))}
                />
                <div className="flex items-center gap-2">
                  <Input
                    value={addState.name}
                    onChange={(e) => setAddState(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nama baru..."
                    className="h-8 text-xs flex-1 rounded-lg"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveAdd();
                      if (e.key === 'Escape') handleCancelAdd();
                    }}
                  />
                  {activeTab === 'difficulty' && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">XP</span>
                      <Input
                        type="number"
                        min={0}
                        value={addState.xp}
                        onChange={(e) => setAddState(prev => ({ ...prev, xp: parseInt(e.target.value) || 0 }))}
                        className="h-8 text-xs w-16 rounded-lg"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveAdd();
                          if (e.key === 'Escape') handleCancelAdd();
                        }}
                      />
                    </div>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleSaveAdd}
                    disabled={saving}
                    aria-label="Simpan label baru"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-success" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleCancelAdd}
                    disabled={saving}
                    aria-label="Batal tambah"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add button */}
        {!isAdding && (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 text-xs gap-1.5 rounded-xl border-dashed hover:bg-accent/50"
            onClick={handleStartAdd}
            disabled={loading}
          >
            <Plus className="h-3.5 w-3.5" />
            Tambah {currentTabInfo.label}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------- Color Picker ---------- */

function ColorPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOR_KEYS.map(key => {
        const hex = LABEL_COLORS[key].hex;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={cn(
              'h-[14px] w-[14px] rounded-full transition-all',
              'hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
              selected === key
                ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110'
                : 'ring-1 ring-black/10 dark:ring-white/10'
            )}
            style={{ backgroundColor: hex }}
            title={key}
            aria-label={`Warna ${key}`}
          />
        );
      })}
    </div>
  );
}
