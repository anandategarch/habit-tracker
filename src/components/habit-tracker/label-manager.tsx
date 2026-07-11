'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Plus, Pencil, Trash2, Check, X, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { LABEL_COLORS, type LabelColorSet } from '@/lib/label-colors';
import { useHabitOptions, type HabitOption } from '@/hooks/use-habit-options';

type OptionType = 'category' | 'priority' | 'difficulty';

const TABS: { type: OptionType; label: string; description: string }[] = [
  { type: 'category', label: 'Categories', description: 'Group your habits by type' },
  { type: 'priority', label: 'Priorities', description: 'Set urgency levels' },
  { type: 'difficulty', label: 'Difficulties', description: 'Define difficulty levels & XP' },
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
      toast.error('Name is required');
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
      toast.success('Updated successfully');
      setEditingId(null);
      setEditState(null);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update');
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
      toast.success(`"${item.name}" deleted`);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
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
      toast.error('Name is required');
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
      toast.success('Created successfully');
      setIsAdding(false);
      refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }, [addState, activeTab, refetch]);

  const currentTabInfo = TABS.find(t => t.type === activeTab)!;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Tags className="h-4 w-4 text-primary" />
          Habit Labels
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {TABS.map(tab => (
            <button
              key={tab.type}
              onClick={() => {
                setActiveTab(tab.type);
                setEditingId(null);
                setEditState(null);
                setIsAdding(false);
              }}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                activeTab === tab.type
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
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
          <div className="max-h-80 overflow-y-auto space-y-0.5 rounded-md border">
            {items.length === 0 && !isAdding && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No {currentTabInfo.type}s yet. Add one below.
              </div>
            )}

            {items.map(item => (
              <div key={item.id}>
                {editingId === item.id && editState ? (
                  /* Editing row */
                  <div className="px-3 py-2 space-y-2 border-b last:border-b-0">
                    <ColorPicker
                      selected={editState.color}
                      onSelect={(color) => setEditState(prev => prev ? { ...prev, color } : prev)}
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        value={editState.name}
                        onChange={(e) => setEditState(prev => prev ? { ...prev, name: e.target.value } : prev)}
                        placeholder="Name"
                        className="h-7 text-xs flex-1"
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
                            className="h-7 text-xs w-16"
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
                        className="h-7 w-7"
                        onClick={handleSaveEdit}
                        disabled={saving}
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={handleCancelEdit}
                        disabled={saving}
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Display row */
                  <div className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 group hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: LABEL_COLORS[item.color]?.hex || LABEL_COLORS.gray.hex }}
                      />
                      <span className="text-sm truncate">{item.name}</span>
                      {activeTab === 'difficulty' && (
                        <span className="text-xs text-muted-foreground ml-1">{item.xp} XP</span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleStartEdit(item)}
                        disabled={saving}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(item)}
                        disabled={saving}
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add new form */}
            {isAdding && (
              <div className="px-3 py-2 space-y-2 bg-muted/30">
                <ColorPicker
                  selected={addState.color}
                  onSelect={(color) => setAddState(prev => ({ ...prev, color }))}
                />
                <div className="flex items-center gap-2">
                  <Input
                    value={addState.name}
                    onChange={(e) => setAddState(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="New name..."
                    className="h-7 text-xs flex-1"
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
                        className="h-7 text-xs w-16"
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
                    className="h-7 w-7"
                    onClick={handleSaveAdd}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleCancelAdd}
                    disabled={saving}
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
            className="w-full h-8 text-xs gap-1.5"
            onClick={handleStartAdd}
            disabled={loading}
          >
            <Plus className="h-3.5 w-3.5" />
            Add {currentTabInfo.type === 'category' ? 'category' : currentTabInfo.type === 'priority' ? 'priority' : 'difficulty'}
          </Button>
        )}
      </CardContent>
    </Card>
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
          />
        );
      })}
    </div>
  );
}