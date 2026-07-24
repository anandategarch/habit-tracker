'use client';

import { Card, CardContent } from '@/components/ui/card';
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
    <Card className="border-dashed border-primary/20 bg-primary/10">
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              className="h-9 w-9 flex items-center justify-center rounded-md border bg-background text-lg hover:bg-accent transition-colors"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              {quickIcon}
            </button>
            {showEmojiPicker && (
              <div className="absolute top-full mt-1 z-50 bg-popover border rounded-lg shadow-lg p-2 flex flex-wrap gap-1 w-48">
                {DEFAULT_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="text-2xl hover:bg-accent rounded p-1 transition-colors"
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
                  className="text-xs text-muted-foreground hover:text-foreground p-1"
                  onClick={() => setShowEmojiPicker(false)}
                >
                  close
                </button>
              </div>
            )}
          </div>
          <Input
            placeholder="Quick add a habit..."
            className="flex-1"
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickAdd();
            }}
            disabled={quickAdding}
          />
          <Button
            onClick={handleQuickAdd}
            disabled={quickAdding || !quickName.trim()}
            className="bg-primary hover:bg-primary text-white gap-1 shrink-0"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default QuickAddBar;
