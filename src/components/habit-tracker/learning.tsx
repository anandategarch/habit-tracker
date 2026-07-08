'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  RefreshCw,
  CheckCircle,
  Flame,
  Plus,
  Trash2,
  Edit,
  Settings,
  Sparkles,
  GraduationCap,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';

// ── Types ────────────────────────────────────────────────────────────────────

interface LearningTopic {
  id: string;
  name: string;
  emoji: string;
  order: number;
}

interface Article {
  title: string;
  content: string;
  funFact: string;
  topic: string;
  source: string;
}

interface LearningStatus {
  completedToday: boolean;
  streak: number;
  longestStreak: number;
  totalDays: number;
}

// ── EMOJI OPTIONS ────────────────────────────────────────────────────────────

const EMOJI_OPTIONS = [
  '📒', '💰', '📈', '🧾', '🏦', '📊', '🎓', '💡', '📋', '🏛️',
  '🔢', '💼', '🏦', '📉', '🪙', '💼', '📊', '🏦',
];

// ── Component ────────────────────────────────────────────────────────────────

export default function LearningTab() {
  const { refreshKey, triggerRefresh } = useAppStore();

  const [topics, setTopics] = useState<LearningTopic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string>('');
  const [article, setArticle] = useState<Article | null>(null);
  const [status, setStatus] = useState<LearningStatus>({ completedToday: false, streak: 0, longestStreak: 0, totalDays: 0 });

  const [articleLoading, setArticleLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [topicsLoading, setTopicsLoading] = useState(true);

  // Dialog states
  const [manageOpen, setManageOpen] = useState(false);
  const [addTopicOpen, setAddTopicOpen] = useState(false);
  const [editTopic, setEditTopic] = useState<LearningTopic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LearningTopic | null>(null);

  const [topicName, setTopicName] = useState('');
  const [topicEmoji, setTopicEmoji] = useState('📚');

  // ── Fetch topics (with auto-migrate) ──────────────────────────────

  const fetchTopics = useCallback(async () => {
    try {
      // Step 1: Try auto-migrate first (creates table if missing)
      try {
        await fetch('/api/migrate-learning');
      } catch { /* ignore */ }

      // Step 2: Fetch topics
      const res = await fetch('/api/learning/topics');
      if (!res.ok) throw new Error();
      const data: LearningTopic[] = await res.json();

      // If DB is empty, use fallback topics
      if (data.length === 0) {
        const fallback: LearningTopic[] = [
          { id: 'fb-1', name: 'Akuntansi', emoji: '📒', order: 0 },
          { id: 'fb-2', name: 'Keuangan', emoji: '💰', order: 1 },
          { id: 'fb-3', name: 'Ekonomi', emoji: '📈', order: 2 },
          { id: 'fb-4', name: 'Pajak', emoji: '🧾', order: 3 },
          { id: 'fb-5', name: 'Investasi', emoji: '🏦', order: 4 },
          { id: 'fb-6', name: 'Manajemen', emoji: '📊', order: 5 },
        ];
        setTopics(fallback);
        if (!selectedTopic) setSelectedTopic(fallback[0].name);
      } else {
        setTopics(data);
        if (data.length > 0 && !selectedTopic) {
          setSelectedTopic(data[0].name);
        }
      }
    } catch {
      // Final fallback: hardcoded topics
      const fallback: LearningTopic[] = [
        { id: 'fb-1', name: 'Akuntansi', emoji: '📒', order: 0 },
        { id: 'fb-2', name: 'Keuangan', emoji: '💰', order: 1 },
        { id: 'fb-3', name: 'Ekonomi', emoji: '📈', order: 2 },
        { id: 'fb-4', name: 'Pajak', emoji: '🧾', order: 3 },
        { id: 'fb-5', name: 'Investasi', emoji: '🏦', order: 4 },
        { id: 'fb-6', name: 'Manajemen', emoji: '📊', order: 5 },
      ];
      setTopics(fallback);
      if (!selectedTopic) setSelectedTopic(fallback[0].name);
    } finally {
      setTopicsLoading(false);
    }
  }, [selectedTopic]);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics, refreshKey]);

  // ── Fetch article when topic changes ────────────────────────────────────

  useEffect(() => {
    if (!selectedTopic) return;
    let cancelled = false;
    setArticleLoading(true);
    setArticle(null);

    requestAnimationFrame(() => {
      fetch(`/api/learning/article?topic=${encodeURIComponent(selectedTopic)}`)
        .then(r => r.json())
        .then(d => {
          if (!cancelled && d.title) {
            setArticle({ title: d.title, content: d.content, funFact: d.funFact, topic: d.topic, source: d.source });
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setArticleLoading(false);
        });
    });

    return () => { cancelled = true; };
  }, [selectedTopic]);

  // ── Fetch learning status ───────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    requestAnimationFrame(() => {
      fetch('/api/learning/complete')
        .then(r => r.json())
        .then(d => {
          if (!cancelled) setStatus(d);
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleRefresh = () => {
    if (!selectedTopic) return;
    setArticleLoading(true);
    setArticle(null);
    fetch(`/api/learning/article?topic=${encodeURIComponent(selectedTopic)}&refresh=true`)
      .then(r => r.json())
      .then(d => {
        if (d.title) {
          setArticle({ title: d.title, content: d.content, funFact: d.funFact, topic: d.topic, source: d.source });
        }
      })
      .catch(() => {})
      .finally(() => setArticleLoading(false));
  };

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const res = await fetch('/api/learning/complete', { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success('Daily Learning selesai! 🎉');
      triggerRefresh();
      setStatus(s => ({ ...s, completedToday: true, streak: s.streak + 1, totalDays: s.totalDays + 1 }));
    } catch {
      toast.error('Gagal menyimpan');
    } finally {
      setCompleting(false);
    }
  };

  const handleAddTopic = async () => {
    if (!topicName.trim()) {
      toast.error('Nama topik wajib diisi');
      return;
    }
    try {
      const res = await fetch('/api/learning/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: topicName.trim(), emoji: topicEmoji }),
      });
      if (!res.ok) throw new Error();
      toast.success('Topik ditambahkan');
      setTopicName('');
      setTopicEmoji('📚');
      setAddTopicOpen(false);
      await fetchTopics();
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'message' in e && (e as { message: string }).message.includes('409')) {
        toast.error('Topik sudah ada');
      } else {
        toast.error('Gagal menambahkan topik');
      }
    }
  };

  const handleEditTopic = async () => {
    if (!editTopic || !topicName.trim()) return;
    try {
      const res = await fetch(`/api/learning/topics/${editTopic.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: topicName.trim(), emoji: topicEmoji }),
      });
      if (!res.ok) throw new Error();
      toast.success('Topik diperbarui');
      setEditTopic(null);
      setTopicName('');
      setTopicEmoji('📚');
      await fetchTopics();
    } catch {
      toast.error('Gagal memperbarui topik');
    }
  };

  const handleDeleteTopic = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/learning/topics/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Topik dihapus');
      if (selectedTopic === deleteTarget.name) {
        setSelectedTopic(topics.filter(t => t.id !== deleteTarget.id)[0]?.name || '');
      }
      setDeleteTarget(null);
      await fetchTopics();
    } catch {
      toast.error('Gagal menghapus topik');
    }
  };

  const openEditDialog = (topic: LearningTopic) => {
    setTopicName(topic.name);
    setTopicEmoji(topic.emoji);
    setEditTopic(topic);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Daily Learning</h2>
            <p className="text-xs text-muted-foreground">Belajar sesuatu setiap hari</p>
          </div>
        </div>

        {/* Streak & Status */}
        <div className="flex items-center gap-3">
          {status.streak > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{status.streak}</span>
              <span className="text-xs text-orange-500">hari</span>
            </div>
          )}
          <Badge variant="secondary" className="text-xs">
            {status.totalDays} hari total
          </Badge>
          <Dialog open={manageOpen} onOpenChange={setManageOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-1.5" />
                Kelola Topik
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Kelola Topik Pembelajaran
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                {/* Add topic */}
                <Button
                  onClick={() => { setTopicName(''); setTopicEmoji('📚'); setAddTopicOpen(true); }}
                  variant="outline"
                  className="w-full border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Topik Baru
                </Button>

                {/* Topic list */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {topics.map((topic) => (
                    <div
                      key={topic.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                        selectedTopic === topic.name && 'border-violet-300 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800'
                      )}
                    >
                      <span className="text-xl">{topic.emoji}</span>
                      <span className="text-sm font-medium flex-1">{topic.name}</span>
                      {!topic.id.startsWith('fb-') && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditDialog(topic)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(topic)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {topics.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Belum ada topik. Tambahkan topik pertamamu!
                    </p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Topic Selector ─────────────────────────────────────────────────── */}
      {topicsLoading ? (
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-full" />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {topics.map((topic) => (
            <button
              key={topic.id}
              onClick={() => setSelectedTopic(topic.name)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 border',
                selectedTopic === topic.name
                  ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                  : 'bg-card text-muted-foreground hover:text-foreground hover:bg-accent border-border'
              )}
            >
              <span>{topic.emoji}</span>
              <span>{topic.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Article Card ───────────────────────────────────────────────────── */}
      {articleLoading ? (
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Separator className="my-2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </CardContent>
        </Card>
      ) : article ? (
        <Card className="overflow-hidden border-violet-200 dark:border-violet-900/50">
          {/* Article header */}
          <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/90">
                <BookOpen className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wider">Pembelajaran Hari Ini</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-white/20 text-white border-0 text-[10px]">
                  {article.topic}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                  onClick={handleRefresh}
                  aria-label="Refresh artikel"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <CardContent className="p-6">
            {/* Title */}
            <h3 className="text-xl font-bold mb-4 leading-tight">{article.title}</h3>

            {/* Content */}
            <div className="space-y-4 mb-6">
              {article.content.split('\n\n').filter(Boolean).map((paragraph, i) => (
                <p key={i} className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  {paragraph.trim()}
                </p>
              ))}
            </div>

            <Separator className="my-4" />

            {/* Fun Fact */}
            <div className="flex items-start gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-4">
              <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Fun Fact
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                  {article.funFact}
                </p>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Complete Button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {status.completedToday ? (
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Sudah dibaca hari ini</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Klik tombol untuk mencatat progres belajar hari ini
                  </span>
                )}
              </div>
              <Button
                onClick={handleComplete}
                disabled={status.completedToday || completing}
                className={cn(
                  'min-w-[160px]',
                  status.completedToday
                    ? 'bg-green-600 text-white'
                    : 'bg-violet-600 hover:bg-violet-700 text-white'
                )}
              >
                {status.completedToday ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Sudah Selesai
                  </>
                ) : completing ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                ) : (
                  <>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Selesai Baca
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Pilih topik untuk mulai belajar</p>
          </div>
        </Card>
      )}

      {/* ── Stats Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-muted-foreground font-medium">Streak Saat Ini</span>
          </div>
          <div className="text-2xl font-bold">{status.streak}</div>
          <p className="text-xs text-muted-foreground">hari berturut-turut</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Flame className="h-4 w-4 text-yellow-500" />
            <span className="text-xs text-muted-foreground font-medium">Streak Terpanjang</span>
          </div>
          <div className="text-2xl font-bold">{status.longestStreak}</div>
          <p className="text-xs text-muted-foreground">hari</p>
        </Card>
        <Card className="p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <GraduationCap className="h-4 w-4 text-violet-500" />
            <span className="text-xs text-muted-foreground font-medium">Total Belajar</span>
          </div>
          <div className="text-2xl font-bold">{status.totalDays}</div>
          <p className="text-xs text-muted-foreground">hari</p>
        </Card>
      </div>

      {/* ── Add Topic Dialog ──────────────────────────────────────────────── */}
      <Dialog open={addTopicOpen} onOpenChange={setAddTopicOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah Topik Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setTopicEmoji(e)}
                    className={cn(
                      'text-xl p-1.5 rounded-lg border-2 transition-all hover:scale-110',
                      topicEmoji === e
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950'
                        : 'border-transparent hover:border-muted'
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="topic-name">Nama Topik</Label>
              <Input
                id="topic-name"
                placeholder="contoh: Fintech"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
              />
            </div>
            <Button onClick={handleAddTopic} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
              <Plus className="h-4 w-4 mr-2" />
              Tambah
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Topic Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!editTopic} onOpenChange={(open) => !open && setEditTopic(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Topik</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setTopicEmoji(e)}
                    className={cn(
                      'text-xl p-1.5 rounded-lg border-2 transition-all hover:scale-110',
                      topicEmoji === e
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950'
                        : 'border-transparent hover:border-muted'
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-topic-name">Nama Topik</Label>
              <Input
                id="edit-topic-name"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEditTopic()}
              />
            </div>
            <Button onClick={handleEditTopic} className="w-full bg-violet-600 hover:bg-violet-700 text-white">
              <Edit className="h-4 w-4 mr-2" />
              Simpan Perubahan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Topik &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Topik yang dihapus tidak dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTopic} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="h-4 w-4 mr-2" />
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}