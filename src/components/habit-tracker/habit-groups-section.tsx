'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
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
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { GROUP_EMOJIS, type HabitGroup } from './habit-master-types';
import { deriveColorFromEmoji } from '@/lib/emoji-color';

interface HabitGroupsSectionProps {
  groups: HabitGroup[];
  groupsLoading: boolean;
  groupsOpen: boolean;
  setGroupsOpen: (v: boolean) => void;
  newGroupName: string;
  setNewGroupName: (v: string) => void;
  newGroupEmoji: string;
  setNewGroupEmoji: (v: string) => void;
  newGroupColor: string;
  setNewGroupColor: (v: string) => void;
  showGroupEmojiPicker: boolean;
  setShowGroupEmojiPicker: (v: boolean) => void;
  addingGroup: boolean;
  handleCreateGroup: () => void;
  handleDeleteGroup: (id: string) => void;
}

export function HabitGroupsSection({
  groups, groupsLoading, groupsOpen, setGroupsOpen,
  newGroupName, setNewGroupName, newGroupEmoji, setNewGroupEmoji,
  newGroupColor, setNewGroupColor, showGroupEmojiPicker, setShowGroupEmojiPicker,
  addingGroup, handleCreateGroup, handleDeleteGroup,
}: HabitGroupsSectionProps) {
  return (
    <Collapsible open={groupsOpen} onOpenChange={setGroupsOpen}>
      {/* Div polong premium-card (bukan Card — pola agent 2-a/2-b/2-c). */}
      <div className="premium-card premium-card-sheen rounded-2xl">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full text-left mx-1 mt-1 px-4 py-3 flex items-center justify-between hover:bg-accent/40 transition-colors rounded-xl focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none cursor-pointer"
            aria-label="Buka atau tutup bagian grup habit"
          >
            <div className="flex items-center gap-2 min-w-0">
              {groupsOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
              <span className="premium-label">Grup Habit</span>
              {!groupsLoading && groups.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 rounded-full">
                  {groups.length}
                </Badge>
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="pt-0 pb-4 px-4">
            {/* Inline form */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative">
                <button
                  type="button"
                  className="chip-soft h-10 w-10 text-base cursor-pointer hover:bg-accent/60 transition-colors active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none shrink-0"
                  onClick={() => setShowGroupEmojiPicker(!showGroupEmojiPicker)}
                  aria-label={`Pilih emoji grup, sekarang ${newGroupEmoji}`}
                >
                  {newGroupEmoji}
                </button>
                {showGroupEmojiPicker && (
                  <div className="absolute top-full mt-1.5 z-50 rounded-2xl border border-border bg-popover/95 backdrop-blur shadow-lg p-2 grid grid-cols-4 gap-1 w-56">
                    {GROUP_EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        className="text-xl hover:bg-accent rounded-xl p-1.5 transition-all min-w-[40px] min-h-[40px] flex items-center justify-center active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                        onClick={() => {
                          setNewGroupEmoji(e);
                          // Auto-derive color from emoji — no manual color picker.
                          // Resolve conflicts with existing group colors.
                          const existingColors = groups
                            .map(g => g.color)
                            .filter((c): c is string => !!c);
                          const derived = deriveColorFromEmoji(e, existingColors);
                          setNewGroupColor(derived);
                          setShowGroupEmojiPicker(false);
                        }}
                        aria-label={`Pilih emoji ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="col-span-4 text-xs text-muted-foreground hover:text-foreground py-1.5 rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                      onClick={() => setShowGroupEmojiPicker(false)}
                    >
                      tutup
                    </button>
                  </div>
                )}
              </div>
              <Input
                placeholder="Nama grup baru..."
                className="flex-1 h-10 text-sm rounded-xl"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateGroup();
                }}
                disabled={addingGroup}
                aria-label="Nama grup baru"
              />
              {/* Color preview — auto-derived from emoji */}
              <div
                className="h-10 w-10 rounded-xl border border-border shrink-0"
                style={{ backgroundColor: newGroupColor }}
                aria-label={`Warna otomatis: ${newGroupColor}`}
                title="Warna otomatis dari emoji"
              />
              <Button
                onClick={handleCreateGroup}
                disabled={addingGroup || !newGroupName.trim()}
                className="btn-primary-gradient h-10 gap-1 shrink-0"
                size="sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah
              </Button>
            </div>

            {/* Group chips */}
            {groupsLoading ? (
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-7 w-24 bg-muted animate-pulse rounded-full" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada grup. Buat grup pertamamu di atas.</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {groups.map((g) => (
                  <span
                    key={g.id}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium border transition-colors"
                    style={{
                      borderColor: g.color ? `${g.color}40` : undefined,
                      backgroundColor: g.color ? `${g.color}10` : undefined,
                      color: g.color || undefined,
                    }}
                  >
                    <span aria-hidden="true">{g.emoji || '📌'}</span>
                    <span>{g.name}</span>
                    {g._count.habits > 0 && (
                      <span className="text-xs opacity-60 tabular-nums">({g._count.habits})</span>
                    )}
                    {/* Hapus grup — sebelumnya one-click destroy tanpa konfirmasi.
                        Dibungkus AlertDialog (pola konfirmasi hapus habit/goal);
                        handler handleDeleteGroup tidak berubah. */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          className="ml-0.5 h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                          aria-label={`Hapus grup ${g.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus grup?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Yakin ingin menghapus grup &ldquo;{g.name}&rdquo;?
                            {g._count.habits > 0
                              ? ` Grup ini berisi ${g._count.habits} habit — habit di dalamnya tidak ikut terhapus, hanya dikeluarkan dari grup.`
                              : ' Grup ini belum berisi habit.'}
                            {' '}Tindakan ini tidak bisa dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteGroup(g.id)}
                            className="bg-destructive hover:bg-destructive text-white focus:ring-destructive"
                          >
                            Hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </span>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export default HabitGroupsSection;
