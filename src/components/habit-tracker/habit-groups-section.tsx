'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';
import { GROUP_EMOJIS, type HabitGroup } from './habit-master-types';

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
      <Card>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-accent/50 transition-colors rounded-t-lg"
          >
            <div className="flex items-center gap-2">
              {groupsOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-semibold">Habit Groups</span>
              {!groupsLoading && groups.length > 0 && (
                <Badge variant="secondary" className="text-[11px] px-1.5 py-0 h-5">
                  {groups.length}
                </Badge>
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            {/* Inline form */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative">
                <button
                  type="button"
                  className="h-8 w-8 flex items-center justify-center rounded-md border bg-background text-base hover:bg-accent transition-colors shrink-0"
                  onClick={() => setShowGroupEmojiPicker(!showGroupEmojiPicker)}
                >
                  {newGroupEmoji}
                </button>
                {showGroupEmojiPicker && (
                  <div className="absolute top-full mt-1 z-50 bg-popover border rounded-lg shadow-lg p-2 flex flex-wrap gap-1 w-56">
                    {GROUP_EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        className="text-xl hover:bg-accent rounded p-1 transition-colors"
                        onClick={() => {
                          setNewGroupEmoji(e);
                          setShowGroupEmojiPicker(false);
                        }}
                      >
                        {e}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground p-1"
                      onClick={() => setShowGroupEmojiPicker(false)}
                    >
                      close
                    </button>
                  </div>
                )}
              </div>
              <Input
                placeholder="Nama grup baru..."
                className="flex-1 h-8 text-sm"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateGroup();
                }}
                disabled={addingGroup}
              />
              <input
                type="color"
                value={newGroupColor}
                onChange={(e) => setNewGroupColor(e.target.value)}
                className="h-8 w-8 rounded-md border cursor-pointer bg-transparent p-0.5 shrink-0"
              />
              <Button
                onClick={handleCreateGroup}
                disabled={addingGroup || !newGroupName.trim()}
                className="bg-primary hover:bg-primary text-white h-8 gap-1 shrink-0"
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
                    <span>{g.emoji || '📌'}</span>
                    <span>{g.name}</span>
                    {g._count.habits > 0 && (
                      <span className="text-[10px] opacity-60">({g._count.habits})</span>
                    )}
                    <button
                      type="button"
                      className="ml-0.5 h-4 w-4 inline-flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                      onClick={() => handleDeleteGroup(g.id)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default HabitGroupsSection;
