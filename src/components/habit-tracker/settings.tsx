'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppStore } from '@/store/app-store';
import { useRef } from 'react';
import dynamic from 'next/dynamic';
import LabelManager from './label-manager';

const HabitMaster = dynamic(() => import('./habit-master'), { ssr: false });
import {
  Settings as SettingsIcon,
  User,
  Palette,
  Globe,
  Target,
  Save,
  Database,
  Trash2,
  AlertTriangle,
  Loader2,
  Upload,
  FileSpreadsheet,
  HardDriveDownload,
  Check,
  ListChecks,
} from 'lucide-react';
import {
  applyThemeColors,
  applyThemeMode,
  resetThemeColors,
  THEME_PRESETS,
  type ThemePreset,
} from '@/lib/theme-utils';

interface AppSettings {
  id: string;
  userName: string;
  theme: string;
  primaryColor: string;
  secondaryColor: string;
  weekStart: string;
  language: string;
  targetCompletion: number;
  createdAt: string;
  updatedAt: string;
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function FormRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="sm:w-64 shrink-0">{children}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-48" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-4">
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex justify-between items-center">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-9 w-64" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Live preview theme colors without saving to DB */
function previewTheme(primary: string, secondary: string, theme: string) {
  const isDark = theme === 'dark';
  applyThemeMode(isDark);

  if (
    primary.toLowerCase() === '#22c55e' &&
    secondary.toLowerCase() === '#10b981'
  ) {
    resetThemeColors();
  } else {
    applyThemeColors(primary, secondary, isDark);
  }
}

export default function Settings() {
  const triggerRefresh = useAppStore(s => s.triggerRefresh);
  const [activeSection, setActiveSection] = useState<'umum' | 'habits' | 'data'>('umum');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dbStats, setDbStats] = useState<{ habits: number; logs: number; days: number } | null>(null);

  // Local form state
  const [form, setForm] = useState({
    userName: '',
    theme: 'light',
    primaryColor: '#22c55e',
    secondaryColor: '#10b981',
    weekStart: 'monday',
    language: 'en',
    targetCompletion: 80,
  });

  const updateField = useCallback(<K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Live preview for theme-related changes
      if (key === 'primaryColor' || key === 'secondaryColor' || key === 'theme') {
        previewTheme(next.primaryColor, next.secondaryColor, next.theme);
      }
      return next;
    });
  }, []);

  /** Check if a preset matches current form colors */
  const isPresetActive = (preset: ThemePreset) =>
    form.primaryColor.toLowerCase() === preset.primaryColor.toLowerCase() &&
    form.secondaryColor.toLowerCase() === preset.secondaryColor.toLowerCase();

  /** Apply a preset and live-preview it */
  const applyPreset = (preset: ThemePreset) => {
    setForm((prev) => {
      const next = { ...prev, primaryColor: preset.primaryColor, secondaryColor: preset.secondaryColor };
      previewTheme(next.primaryColor, next.secondaryColor, next.theme);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) {
          setSettings(d);
          setForm({
            userName: d.userName || '',
            theme: d.theme || 'light',
            primaryColor: d.primaryColor || '#22c55e',
            secondaryColor: d.secondaryColor || '#10b981',
            weekStart: d.weekStart || 'monday',
            language: d.language || 'en',
            targetCompletion: d.targetCompletion ?? 80,
          });
        }
      })
      .catch(() => { toast.error('Gagal memuat pengaturan'); })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Fetch DB stats
    Promise.allSettled([
      fetch('/api/habits').then((r) => r.json()),
      fetch('/api/daily-logs').then((r) => r.json()),
    ]).then(([habitsRes, logsRes]) => {
      if (cancelled) return;
      const habitsCount = habitsRes.status === 'fulfilled' ? (Array.isArray(habitsRes.value) ? habitsRes.value.length : habitsRes.value?.habits?.length ?? 0) : 0;
      const logsCount = logsRes.status === 'fulfilled' ? (Array.isArray(logsRes.value) ? logsRes.value.length : logsRes.value?.logs?.length ?? 0) : 0;
      setDbStats({ habits: habitsCount, logs: logsCount, days: 0 });
    });

    return () => { cancelled = true; };
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('Settings saved successfully');
        // Notify ThemeProvider to persist the current theme
        const savedSettings = await res.json();
        sessionStorage.setItem('rutina_settings', JSON.stringify(savedSettings));
        // Theme is already applied via live preview, no need to re-apply
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }, [form]);

  const handleExportJSON = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/data/export');
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rutina-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup berhasil diunduh! 📦');
    } catch {
      toast.error('Gagal mengunduh backup');
    } finally {
      setExporting(false);
    }
  }, []);

  const handleExportCSV = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/data/export-csv');
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rutina-data-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      const total = res.headers.get('X-Total-Records');
      const files = res.headers.get('X-Files-Count');
      toast.success(`Data berhasil diunduh! ${total ?? '?'} record dari ${files ?? '11'} file CSV 📊`);
    } catch {
      toast.error('Gagal mengunduh CSV');
    } finally {
      setExporting(false);
    }
  }, []);

  const handleImportJSON = useCallback(async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch('/api/data/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import gagal');
      }
      const result = await res.json();
      toast.success(`Data berhasil diimport! ${result.total ?? 0} record dipulihkan 🎉`);
      setImportDialogOpen(false);
      triggerRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal import data. Pastikan file backup valid.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [triggerRefresh]);

  const handleResetAll = useCallback(async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/reset-all', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Semua data berhasil dihapus! Mulai dari awal ya 🎉');
        setResetDialogOpen(false);
        setDbStats({ habits: 0, logs: 0, days: 0 });
        triggerRefresh();
      } else {
        toast.error('Gagal menghapus data. Coba lagi.');
      }
    } catch {
      toast.error('Gagal menghapus data. Coba lagi.');
    } finally {
      setResetting(false);
    }
  }, [triggerRefresh]);

  if (loading) return <LoadingSkeleton />;

  const SECTION_TABS = [
    { id: 'umum' as const, label: 'Umum', icon: SettingsIcon },
    { id: 'habits' as const, label: 'Habit Master', icon: ListChecks },
    { id: 'data' as const, label: 'Data', icon: Database },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pengaturan</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Kelola preferensi, habits, dan data</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        {SECTION_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <Separator />

      {/* ── HABITS SECTION ── */}
      {activeSection === 'habits' && <HabitMaster />}

      {/* ── GENERAL SECTION ── */}
      {activeSection === 'umum' && (
        <div className="space-y-6">
          {/* Profile Section */}
          <SectionCard icon={User} title="Profile">
            <FormRow label="User Name" description="Display name for your account">
              <Input
                value={form.userName}
                onChange={(e) => updateField('userName', e.target.value)}
                placeholder="Enter your name"
                className="h-9"
              />
            </FormRow>
          </SectionCard>

          {/* Appearance Section */}
          <SectionCard icon={Palette} title="Appearance">
            <FormRow label="Theme" description="Choose your preferred theme">
              <Select value={form.theme} onValueChange={(v) => updateField('theme', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </FormRow>

            <Separator className="my-3" />

            {/* Preset Theme Swatches */}
            <div className="space-y-2.5">
              <div>
                <Label className="text-sm font-medium">Color Theme</Label>
                <p className="text-xs text-muted-foreground">Click a preset or use custom colors below</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {THEME_PRESETS.map((preset) => {
                  const active = isPresetActive(preset);
                  return (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        'group relative flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 transition-all duration-150',
                        active
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-transparent bg-muted/50 hover:bg-muted hover:border-border'
                      )}
                      title={preset.name}
                    >
                      <span className="text-base leading-none">{preset.emoji}</span>
                      <span className="text-xs font-medium">{preset.name}</span>
                      {active && (
                        <Check className="h-3.5 w-3.5 text-primary absolute -top-1.5 -right-1.5 bg-background rounded-full p-0.5 border border-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator className="my-3" />

            <FormRow label="Primary Color" description="Main accent color">
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => updateField('primaryColor', e.target.value)}
                  className="h-9 w-12 p-1 cursor-pointer"
                />
                <Input
                  value={form.primaryColor}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) updateField('primaryColor', v);
                  }}
                  placeholder="#22c55e"
                  className="h-9 font-mono text-sm"
                />
              </div>
            </FormRow>

            <FormRow label="Secondary Color" description="Supporting accent color">
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={form.secondaryColor}
                  onChange={(e) => updateField('secondaryColor', e.target.value)}
                  className="h-9 w-12 p-1 cursor-pointer"
                />
                <Input
                  value={form.secondaryColor}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) updateField('secondaryColor', v);
                  }}
                  placeholder="#10b981"
                  className="h-9 font-mono text-sm"
                />
              </div>
            </FormRow>

            {/* Live preview bar */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Preview</p>
              <div className="flex gap-2">
                <div className="flex-1 h-8 rounded-md flex items-center justify-center text-xs font-medium" style={{ backgroundColor: form.primaryColor, color: '#fff' }}>
                  Primary
                </div>
                <div className="flex-1 h-8 rounded-md flex items-center justify-center text-xs font-medium border border-border" style={{ backgroundColor: form.secondaryColor + '22', color: form.secondaryColor }}>
                  Secondary
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Preferences Section */}
          <SectionCard icon={Globe} title="Preferences">
            <FormRow label="Week Start" description="First day of the week">
              <Select value={form.weekStart} onValueChange={(v) => updateField('weekStart', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monday">Monday</SelectItem>
                  <SelectItem value="sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </FormRow>

            <Separator className="my-2" />

            <FormRow label="Language" description="Interface language">
              <Select value={form.language} onValueChange={(v) => updateField('language', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="id">Bahasa Indonesia</SelectItem>
                </SelectContent>
              </Select>
            </FormRow>

            <Separator className="my-2" />

            <FormRow label="Target Completion" description="Daily completion target percentage">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.targetCompletion}
                  onChange={(e) => updateField('targetCompletion', Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="h-9 w-20 text-center"
                />
                <span className="text-sm text-muted-foreground font-medium">%</span>
              </div>
            </FormRow>
          </SectionCard>

          {/* Habit Labels Section */}
          <LabelManager />

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px]"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

          {/* Last updated */}
          {settings?.updatedAt && (
            <p className="text-xs text-center text-muted-foreground">
              Last updated: {new Date(settings.updatedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* ── DATA SECTION ── */}
      {activeSection === 'data' && (
        <SectionCard icon={Database} title="Data">
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{dbStats?.habits ?? '-'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Habits</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{dbStats?.logs ?? '-'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Logs</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{dbStats?.days ?? '-'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Days Tracked</p>
              </div>
            </div>

            <Separator className="my-2" />

            {/* Export / Import */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="justify-start h-9"
                onClick={handleExportJSON}
                disabled={exporting}
              >
                {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <HardDriveDownload className="h-4 w-4 mr-2 text-primary" />}
                {exporting ? 'Mengunduh...' : 'Backup JSON'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start h-9"
                onClick={handleExportCSV}
                disabled={exporting}
              >
                {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2 text-primary" />}
                {exporting ? 'Mengunduh...' : 'Export Semua CSV'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start h-9"
                onClick={() => setImportDialogOpen(true)}
                disabled={importing}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import JSON
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Backup JSON untuk restore penuh. Export CSV berisi 11 file (habits, log, transaksi, dll) dalam format ZIP.</p>

            {/* Hidden file input for import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportJSON(file);
              }}
            />

            {/* Import Dialog */}
            <AlertDialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open && fileInputRef.current) fileInputRef.current.value = ''; }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Import Data dari Backup
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <p>Pilih file backup <code className="text-xs bg-muted px-1 py-0.5 rounded">.json</code> yang sebelumnya sudah kamu download.</p>
                      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center">
                        {importing ? (
                          <div className="flex items-center justify-center gap-2 text-primary">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-sm font-medium">Memulihkan data...</span>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              Pilih File Backup
                            </Button>
                            <p className="text-xs text-muted-foreground mt-2">File akan divalidasi sebelum diimport</p>
                          </>
                        )}
                      </div>
                      <p className="text-amber-600 dark:text-amber-400 text-xs font-medium">
                        Data yang ada saat ini akan <strong>ditimpa</strong> oleh data dari backup.
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={importing}>Batal</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Separator className="my-2" />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium text-red-600 dark:text-red-400">Hapus Semua Data</Label>
                <p className="text-xs text-muted-foreground">Hapus semua habits, log, transaksi, budget, dan data lainnya</p>
              </div>
              <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/50 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" />
                    Hapus Semua
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Hapus Semua Data?
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2">
                        <p>
                          Tindakan ini akan <span className="font-semibold text-red-600 dark:text-red-400">menghapus secara permanen</span> semua data kamu, termasuk:
                        </p>
                        <ul className="list-disc list-inside text-sm space-y-0.5 text-muted-foreground">
                          <li>Semua Habit dan log tracking</li>
                          <li>Daily log (mood, energi, tidur)</li>
                          <li>Journal entries</li>
                          <li>Goals & milestones</li>
                          <li>Challenges</li>
                          <li>Badges & Rewards</li>
                          <li>Semua transaksi keuangan & budget</li>
                          <li>Kategori keuangan</li>
                        </ul>
                        <p className="text-red-600 dark:text-red-400 font-medium">
                          Data yang sudah dihapus tidak bisa dikembalikan!
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={resetting}>Batal</AlertDialogCancel>
                    <Button
                      variant="destructive"
                      onClick={handleResetAll}
                      disabled={resetting}
                    >
                      {resetting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Menghapus...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Ya, Hapus Semua
                        </>
                      )}
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}