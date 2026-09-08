'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
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
import {
  AlertDialog,
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
import dynamic from 'next/dynamic';
import LabelManager from './label-manager';

const HabitMaster = dynamic(() => import('./habit-master'), { ssr: false });
import {
  Settings as SettingsIcon,
  User,
  Palette,
  Globe,
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
  Pipette,
  Activity,
  CalendarCheck,
} from 'lucide-react';
import {
  applyThemeColors,
  applyThemeMode,
  resetThemeColors,
  THEME_PRESETS,
  CURATED_THEME_PRESETS,
  type ThemePreset,
} from '@/lib/theme-utils';
import type { AppSettings, SettingsFormState } from './settings-types';
import { SectionCard, FormRow } from './settings-ui';
import { LoadingSkeleton } from './settings-skeleton';
import { AppLockSection } from './app-lock-settings';

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
  const queryClient = useQueryClient();
  // BUGHUNT-ROUND3 SETTINGS-SECTION-1: activeSection lifted from local
  // useState into the global store so the section SURVIVES switching to
  // another main tab and back (parity with financeSubTab / trackerViewMode).
  // The local useState was reset to 'umum' on every re-mount of this tab.
  const activeSection = useAppStore(s => s.settingsSection);
  const setActiveSection = useAppStore(s => s.setSettingsSection);
  // BUGHUNT-ROUND2 FAB-1: FAB "Habit Baru" navigates to this tab and sets
  // quickAddAction='habit'. Switch to the Habit Master section so the
  // HabitMaster component mounts (it consumes + clears the action and
  // opens its add-habit dialog). Deliberately does NOT clear the action
  // here — HabitMaster owns the consumption.
  const quickAddAction = useAppStore(s => s.quickAddAction);
  useEffect(() => {
    if (quickAddAction === 'habit') {
      setActiveSection('habits');
    }
  }, [quickAddAction, setActiveSection]);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local form state
  const [form, setForm] = useState<SettingsFormState>({
    userName: '',
    theme: 'light',
    primaryColor: '#22c55e',
    secondaryColor: '#10b981',
    weekStart: 'monday',
    language: 'en',
    targetCompletion: 80,
  });

  const updateField = useCallback(<K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) => {
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

  /** True when current colors don't match any curated/basic preset → "Kustom" mode */
  const isCustomActive =
    !CURATED_THEME_PRESETS.some(isPresetActive) &&
    !THEME_PRESETS.some(isPresetActive);

  /** Apply a preset and live-preview it */
  const applyPreset = (preset: ThemePreset) => {
    setForm((prev) => {
      const next = { ...prev, primaryColor: preset.primaryColor, secondaryColor: preset.secondaryColor };
      previewTheme(next.primaryColor, next.secondaryColor, next.theme);
      return next;
    });
  };

  // Scroll target for "Kustom" card click → focus the custom color picker section
  const customColorRef = useRef<HTMLDivElement>(null);
  const focusCustomPicker = useCallback(() => {
    customColorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Briefly flash the picker to draw attention
    customColorRef.current?.classList.add('ring-2', 'ring-primary');
    setTimeout(() => {
      customColorRef.current?.classList.remove('ring-2', 'ring-primary');
    }, 1200);
  }, []);

  // ── Fetch settings (TanStack Query) ────────────────────────────────────
  const { data: settings = null, isLoading: loading } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 60_000,
  });

  // Sync settings → form state
  useEffect(() => {
    if (settings) {
      setForm({
        userName: settings.userName || '',
        theme: settings.theme || 'light',
        primaryColor: settings.primaryColor || '#22c55e',
        secondaryColor: settings.secondaryColor || '#10b981',
        weekStart: settings.weekStart || 'monday',
        language: settings.language || 'en',
        targetCompletion: settings.targetCompletion ?? 80,
      });
    }
  }, [settings]);

  // ── Fetch DB stats (shares cache with other components) ──
  const { data: habitsData = [] } = useQuery<unknown[]>({
    queryKey: ['habits'],
    queryFn: async () => {
      const r = await fetch('/api/habits');
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });

  const { data: logsData = [] } = useQuery<unknown[]>({
    queryKey: ['daily-logs-all'],
    queryFn: async () => {
      // BUGHUNT-OTHER-1 BUG-H2: pass ?all=true so the API returns ALL
      // all-time logs instead of defaulting to the last 30 days. The
      // "Total Logs" / "Days Tracked" stats below otherwise undercount
      // for users with >30 days of history.
      const r = await fetch('/api/daily-logs?all=true');
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });

  const dbStats: { habits: number; logs: number; days: number } | null = settings ? {
    habits: Array.isArray(habitsData) ? habitsData.length : 0,
    logs: Array.isArray(logsData) ? logsData.length : 0,
    // "Days Tracked" = number of unique days with daily-log entries.
    // DailyLog has a unique constraint on date, so length = unique days.
    days: Array.isArray(logsData) ? logsData.length : 0,
  } : null;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success('Pengaturan berhasil disimpan');
        // Notify ThemeProvider to persist the current theme
        const savedSettings = await res.json();
        sessionStorage.setItem('rutina_settings', JSON.stringify(savedSettings));
        queryClient.invalidateQueries({ queryKey: ['settings'] });
        // Dispatch theme-change event so chart components (useThemeColor)
        // re-read CSS variables immediately without waiting for window focus.
        window.dispatchEvent(new CustomEvent('rutina:theme-change', { detail: savedSettings }));
      } else {
        toast.error('Gagal menyimpan pengaturan');
      }
    } catch {
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  }, [form, queryClient]);

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
      queryClient.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal import data. Pastikan file backup valid.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [triggerRefresh, queryClient]);

  const handleResetAll = useCallback(async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/reset-all', { method: 'DELETE' });
      if (res.ok) {
        toast.success('Semua data berhasil dihapus! Mulai dari awal ya 🎉');
        setResetDialogOpen(false);
        triggerRefresh();
        queryClient.invalidateQueries();
      } else {
        toast.error('Gagal menghapus data. Coba lagi.');
      }
    } catch {
      toast.error('Gagal menghapus data. Coba lagi.');
    } finally {
      setResetting(false);
    }
  }, [triggerRefresh, queryClient]);

  if (loading) return <LoadingSkeleton />;

  const SECTION_TABS = [
    { id: 'umum' as const, label: 'Umum', icon: SettingsIcon },
    { id: 'habits' as const, label: 'Habit Master', icon: ListChecks },
    { id: 'data' as const, label: 'Data', icon: Database },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <PageHeader
        title="Pengaturan"
        description="Kelola preferensi, habits, dan data"
      />

      {/* Sub-tabs — premium segmented control (pola view-toggle daily-tracker) */}
      <div
        className="premium-segment"
        role="group"
        aria-label="Bagian pengaturan"
      >
        {SECTION_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              data-active={isActive}
              aria-pressed={isActive}
              className="premium-segment-item data-[active=true]:bg-primary data-[active=true]:shadow-sm flex items-center gap-1.5"
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
          <SectionCard icon={User} title="Profil">
            <FormRow label="Nama User" description="Nama tampilan untuk akun kamu">
              <Input
                value={form.userName}
                onChange={(e) => updateField('userName', e.target.value)}
                placeholder="Masukkan nama kamu"
                className="h-9"
              />
            </FormRow>
          </SectionCard>

          {/* Appearance Section */}
          <SectionCard icon={Palette} title="Tampilan">
            <FormRow label="Tema" description="Pilih tema favorit kamu">
              <Select value={form.theme} onValueChange={(v) => updateField('theme', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* BUGHUNT-OTHER-1 BUG-L3: schema allows 'system' (z.enum
                      ['light','dark','system']) and ThemeProvider now resolves
                      it via prefers-color-scheme — expose it in the UI so the
                      setting matches the schema. */}
                  <SelectItem value="light">Terang</SelectItem>
                  <SelectItem value="dark">Gelap</SelectItem>
                  <SelectItem value="system">Sistem</SelectItem>
                </SelectContent>
              </Select>
            </FormRow>

            <Separator className="my-3" />

            {/* Curated Theme Cards — 5 Indonesian-named presets + 1 "Kustom" card */}
            <div className="space-y-2.5">
              <div>
                <Label className="text-sm font-medium">Tema Pilihan</Label>
                <p className="text-xs text-muted-foreground">Pilih tema siap-pakai atau atur sendiri</p>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {CURATED_THEME_PRESETS.map((preset) => {
                  const active = isPresetActive(preset);
                  return (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        'group relative flex flex-col gap-1.5 p-2 rounded-lg border-2 transition-all duration-150',
                        active
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
                      )}
                      title={`${preset.name} — ${preset.description}`}
                    >
                      {/* Color swatches row */}
                      <div className="flex h-6 w-full overflow-hidden rounded-md">
                        <div className="flex-1" style={{ backgroundColor: preset.primaryColor }} />
                        <div className="flex-1" style={{ backgroundColor: preset.secondaryColor }} />
                      </div>
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-sm leading-none flex-shrink-0">{preset.emoji}</span>
                        <span className="text-xs font-medium truncate">{preset.name}</span>
                      </div>
                      {active && (
                        <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full p-0.5 border-2 border-background">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
                {/* Kustom card */}
                <button
                  onClick={focusCustomPicker}
                  className={cn(
                    'group relative flex flex-col gap-1.5 p-2 rounded-lg border-2 border-dashed transition-all duration-150',
                    isCustomActive
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
                  )}
                  title="Pilih warna sendiri"
                >
                  <div
                    className="flex h-6 w-full overflow-hidden rounded-md"
                    style={{
                      background:
                        'linear-gradient(90deg, #f43f5e 0%, #f59e0b 20%, #84cc16 40%, #14b8a6 60%, #a855f7 80%, #64748b 100%)',
                    }}
                  />
                  <div className="flex items-center gap-1 min-w-0">
                    <Pipette className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-xs font-medium truncate">Kustom</span>
                  </div>
                  {isCustomActive && (
                    <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full p-0.5 border-2 border-background">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              </div>
            </div>

            <Separator className="my-3" />

            {/* Quick presets — compact buttons (existing) */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Preset Cepat</Label>
              <div className="flex flex-wrap gap-1.5">
                {THEME_PRESETS.map((preset) => {
                  const active = isPresetActive(preset);
                  return (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className={cn(
                        'group relative flex items-center gap-1 px-2 py-1.5 rounded-md border transition-all duration-150',
                        active
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-transparent bg-muted/50 hover:bg-muted hover:border-border'
                      )}
                      title={preset.name}
                    >
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: preset.primaryColor }}
                      />
                      <span className="text-[11px] font-medium">{preset.name}</span>
                      {active && (
                        <Check className="h-3 w-3 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator className="my-3" />

            {/* Custom color pickers — "Kustom" mode */}
            <div
              ref={customColorRef}
              className={cn(
                'space-y-3 rounded-lg p-3 transition-all duration-200',
                isCustomActive && 'bg-primary/5 border border-primary/30'
              )}
            >
              <div className="flex items-center gap-2">
                <Pipette className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Warna Kustom</Label>
              </div>
              <FormRow label="Warna Utama" description="Warna aksen utama">
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

              <FormRow label="Warna Sekunder" description="Warna aksen pendamping">
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
            </div>

            {/* Live preview bar */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Pratinjau</p>
              <div className="flex gap-2">
                <div className="flex-1 h-8 rounded-md flex items-center justify-center text-xs font-medium" style={{ backgroundColor: form.primaryColor, color: '#fff' }}>
                  Utama
                </div>
                <div className="flex-1 h-8 rounded-md flex items-center justify-center text-xs font-medium border border-border" style={{ backgroundColor: form.secondaryColor + '22', color: form.secondaryColor }}>
                  Sekunder
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Preferences Section */}
          <SectionCard icon={Globe} title="Preferensi">
            <FormRow label="Awal Minggu" description="Hari pertama dalam minggu">
              <Select value={form.weekStart} onValueChange={(v) => updateField('weekStart', v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* L4 fix: schema also allows 'saturday' — expose it so the
                      setting matches what the API + calendar-view support. */}
                  <SelectItem value="monday">Senin</SelectItem>
                  <SelectItem value="sunday">Minggu</SelectItem>
                  <SelectItem value="saturday">Sabtu</SelectItem>
                </SelectContent>
              </Select>
            </FormRow>

            <Separator className="my-2" />

            {/* TODO(BUGHUNT-OTHER-1 BUG-H3): `language` is stored in AppSettings
                but no i18n implementation exists yet. The UI is hardcoded to a
                mix of English + Indonesian. Implement next-intl or remove this
                dropdown to avoid confusing users. Leaving as-is for now since
                changing it has no effect. */}
            <FormRow label="Bahasa" description="Bahasa antarmuka (belum diimplementasikan)">
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

            {/* TODO(BUGHUNT-OTHER-1 BUG-H3): `targetCompletion` is stored in
                AppSettings but no component reads it for any "completion target"
                logic yet. The value is display-only. Either implement a visual
                indicator (e.g., highlight habits below target) or remove. */}
            <FormRow label="Target Penyelesaian" description="Persentase target penyelesaian harian (hanya tampilan)">
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

          {/* App Lock Section */}
          <AppLockSection />

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px]"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </div>

          {/* Last updated */}
          {settings?.updatedAt && (
            <p className="text-xs text-center text-muted-foreground">
              Terakhir diperbarui: {new Date(settings.updatedAt).toLocaleString('id-ID')}
            </p>
          )}
        </div>
      )}

      {/* ── DATA SECTION ── */}
      {activeSection === 'data' && (
        <SectionCard icon={Database} title="Data">
          <div className="space-y-3">
            {/* Stat tiles — chip-soft + premium-label + premium-stat (pola stat goals) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {([
                { label: 'Total Habits', value: dbStats?.habits ?? '-', icon: ListChecks, tint: 'chip-soft-teal' },
                { label: 'Total Log', value: dbStats?.logs ?? '-', icon: Activity, tint: 'chip-soft-violet' },
                { label: 'Hari Dilacak', value: dbStats?.days ?? '-', icon: CalendarCheck, tint: 'chip-soft-amber' },
              ] as const).map((stat) => {
                const StatIcon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-border/70 bg-card/40 dark:bg-card/20 p-3 text-center"
                  >
                    <span className={cn('chip-soft h-8 w-8', stat.tint)} aria-hidden="true">
                      <StatIcon className="h-4 w-4" />
                    </span>
                    <p className="premium-stat text-2xl text-foreground">{stat.value}</p>
                    <p className="premium-label">{stat.label}</p>
                  </div>
                );
              })}
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
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDriveDownload className="h-4 w-4 text-primary" />}
                {exporting ? 'Mengunduh...' : 'Backup JSON'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start h-9"
                onClick={handleExportCSV}
                disabled={exporting}
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-primary" />}
                {exporting ? 'Mengunduh...' : 'Export Semua CSV'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start h-9"
                onClick={() => setImportDialogOpen(true)}
                disabled={importing}
              >
                <Upload className="h-4 w-4" />
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
                      <p className="text-warning dark:text-warning/80 text-xs font-medium">
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
                <Label className="text-sm font-medium text-destructive dark:text-destructive/80">Hapus Semua Data</Label>
                <p className="text-xs text-muted-foreground">Hapus semua habits, log, transaksi, budget, dan data lainnya</p>
              </div>
              <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive dark:border-destructive/30 dark:hover:bg-destructive/15 dark:text-destructive/80 dark:hover:text-destructive/80"
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus Semua
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Hapus Semua Data?
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2">
                        <p>
                          Tindakan ini akan <span className="font-semibold text-destructive dark:text-destructive/80">menghapus secara permanen</span> semua data kamu, termasuk:
                        </p>
                        <ul className="list-disc list-inside text-sm space-y-0.5 text-muted-foreground">
                          <li>Semua Habit dan log tracking</li>
                          <li>Daily log (mood, energi, tidur)</li>
                          <li>Entri jurnal</li>
                          <li>Tujuan & milestone</li>
                          <li>Semua transaksi keuangan & budget</li>
                          <li>Kategori keuangan</li>
                        </ul>
                        <p className="text-destructive dark:text-destructive/80 font-medium">
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
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Menghapus...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4" />
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