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
 HardDriveDownload,
 Check,
 ListChecks,
 Activity,
 CalendarCheck,
 Sprout,
} from 'lucide-react';
import {
 applyThemeColors,
 applyThemeMode,
 resetThemeColors,
 THEME_PRESETS,
 type ThemePreset,
} from '@/lib/theme-utils';
import { jakartaMonthString } from '@/lib/timezone';
import type { AppSettings, SettingsFormState, SettingsSection } from './settings-types';
import { SectionCard, FormRow } from './settings-ui';
import { LoadingSkeleton } from './settings-skeleton';
import { AppLockSection } from './app-lock-settings';

/** Pratinjau langsung tema tanpa menyimpan ke DB (pola theme-utils baru:
 * applyThemeColors(presetId) + applyThemeMode(mode)). */
function previewTheme(themeColor: string, theme: SettingsFormState['theme']) {
 applyThemeMode(theme);
 if (THEME_PRESETS.some((p) => p.id === themeColor)) {
   applyThemeColors(themeColor);
 } else {
   resetThemeColors();
 }
}

export default function Settings() {
 const triggerRefresh = useAppStore(s => s.triggerRefresh);
 const queryClient = useQueryClient();
 // fix 6-d SETTINGS-SECTION-1: sub-section diangkat ke store supaya tidak
 // reset ke 'umum' tiap kali pindah main tab.
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
 const [seeding, setSeeding] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);

 // Local form state (Gel 1 — tanpa Bahasa & Target Penyelesaian; kolom DB
 // language/targetCompletion tetap ada di API, tidak dikirim form ini).
 const [form, setForm] = useState<SettingsFormState>({
   userName: '',
   theme: 'system',
   themeColor: 'teal',
   weekStart: 1,
 });

 const updateField = useCallback(
   <K extends keyof SettingsFormState>(key: K, value: SettingsFormState[K]) => {
     const next = { ...form, [key]: value };
     setForm(next);
     // Live preview untuk perubahan tema/warna.
     if (key === 'themeColor' || key === 'theme') {
       previewTheme(next.themeColor, next.theme);
     }
   },
   [form],
 );

 /** Apakah preset warna ini yang sedang aktif di form? */
 const isPresetActive = (preset: ThemePreset) => form.themeColor === preset.id;

 /** Terapkan preset + pratinjau langsung. */
 const applyPreset = (preset: ThemePreset) => {
   updateField('themeColor', preset.id);
 };

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
 // 61-g (audit 61-d P3): dirty-guard sederhana. Dulunya efek ini menimpa
 // form setiap data ['settings'] berganti identitas — termasuk refetch
 // pasca-handleSave (invalidate ['settings']) yang mendarat ±0,5 dtk
 // kemudian, sehingga ketikan user di jendela itu hilang. Kini form hanya
 // ditimpa bila isinya masih identik dengan snapshot sinkronisasi
 // terakhir (user belum menyentuh apa pun); begitu user mengetik, efek
 // menyerah (snapshot tidak berubah → perbandingan tetap valid).
 const lastSyncedFormRef = useRef<SettingsFormState | null>(null);
 useEffect(() => {
   if (!settings) return;
   const next: SettingsFormState = {
     userName: settings.userName || '',
     theme: settings.theme || 'system',
     themeColor: settings.themeColor || 'teal',
     weekStart: typeof settings.weekStart === 'number' ? settings.weekStart : 1,
   };
   const untouched =
     !lastSyncedFormRef.current ||
     JSON.stringify(form) === JSON.stringify(lastSyncedFormRef.current);
   if (!untouched) return; // user sedang mengedit — jangan timpa
   lastSyncedFormRef.current = next;
   setForm((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
 }, [settings, form]);

 // ── Fetch DB stats (shares cache with other components) ──
 const { data: habitsData = [] } = useQuery<unknown[]>({
   queryKey: ['habits'],
   queryFn: async () => {
     const r = await fetch('/api/habits');
     if (!r.ok) return [];
     const json = await r.json();
     // Kontrak API: { habits: [...] } — fallback array untuk bentuk lama.
     return Array.isArray(json) ? json : (json.habits ?? []);
   },
   staleTime: 60_000,
 });

 const { data: logsData = [] } = useQuery<unknown[]>({
   queryKey: ['daily-logs-month', jakartaMonthString()],
   queryFn: async () => {
     // Statistik log harian memakai bulan Jakarta berjalan (kontrak API
     // /api/daily-logs hanya mendukung ?date= / ?month=).
     const r = await fetch(`/api/daily-logs?month=${jakartaMonthString()}`);
     if (!r.ok) return [];
     const json = await r.json();
     return Array.isArray(json) ? json : (json.logs ?? []);
   },
   staleTime: 60_000,
 });

 const dbStats: { habits: number; logs: number; days: number } | null = settings ? {
   habits: Array.isArray(habitsData) ? habitsData.length : 0,
   logs: Array.isArray(logsData) ? logsData.length : 0,
   // "Hari Dilacak Bulan Ini" = jumlah hari unik dengan entri log harian
   // bulan berjalan (DailyLog unik per tanggal, jadi length = hari unik
   // bulan ini) — BUGHUNT-54 (3-d #12): label lama "Hari Dilacak"
   // mengklaim total sepanjang masa padahal datanya identik dgn tile
   // "Log Bulan Ini" (query yang sama, bulan Jakarta berjalan).
   days: Array.isArray(logsData) ? logsData.length : 0,
 } : null;

 /** DB benar-benar kosong? → tampilkan tombol isi data contoh (seed). */
 const isDbEmpty = dbStats !== null && dbStats.habits === 0 && dbStats.logs === 0;

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
      // CONNECTED-APP: sapaan hero Beranda (userName) datang dari payload
      // /api/dashboard — ikut disegarkan supaya "Selamat pagi, <nama>"
      // berubah tanpa reload.
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
     // TASK 59-b5 #3: API mengirim { ok, restored: {tabel: n} } — TIDAK ada
     // field `total` (dulu `result.total ?? 0` → toast selalu "0 record
     // dipulihkan" meski import sukses). Jumlahkan nilai semua tabel.
     const restoredCount = Object.values(result?.restored ?? {}).reduce<number>(
       (sum, n) => sum + (typeof n === 'number' ? n : 0),
       0
     );
     toast.success(`Data berhasil diimport! ${restoredCount} record dipulihkan 🎉`);
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
     // Kontrak API: POST /api/data/reset-all (bukan /api/reset-all).
     const res = await fetch('/api/data/reset-all', { method: 'POST' });
     if (res.ok) {
       toast.success('Semua data berhasil dihapus! Mulai dari awal ya 🎉');
       setResetDialogOpen(false);
       triggerRefresh();
       queryClient.invalidateQueries();
     } else {
       const err = await res.json().catch(() => ({}));
       toast.error(err.error || 'Gagal menghapus data. Coba lagi.');
     }
   } catch {
     toast.error('Gagal menghapus data. Coba lagi.');
   } finally {
     setResetting(false);
   }
 }, [triggerRefresh, queryClient]);

 /** Isi data contoh saat DB masih kosong (POST /api/data/seed — guard
  * server menolak bila sudah ada data). */
 const handleSeed = useCallback(async () => {
   setSeeding(true);
   try {
     const res = await fetch('/api/data/seed', { method: 'POST' });
     if (!res.ok) {
       const err = await res.json().catch(() => ({}));
       throw new Error(err.error || 'Gagal mengisi data contoh');
     }
     toast.success('Data contoh berhasil dimuat! Selamat mencoba Rutina 🌱');
     triggerRefresh();
     queryClient.invalidateQueries();
   } catch (e) {
     toast.error(e instanceof Error ? e.message : 'Gagal mengisi data contoh');
   } finally {
     setSeeding(false);
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
       subtitle="Kelola preferensi, habits, dan data"
       icon={SettingsIcon}
       eyebrow="Sektor"
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
             className="premium-segment-item flex items-center gap-1.5"
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

         {/* Appearance Section — Gel 1: theme mode + themeColor preset */}
         <SectionCard icon={Palette} title="Tampilan">
           <FormRow label="Tema" description="Pilih mode terang, gelap, atau ikut sistem">
             <Select
               value={form.theme}
               onValueChange={(v) => updateField('theme', v as SettingsFormState['theme'])}
             >
               <SelectTrigger className="h-9">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {/* BUGHUNT-OTHER-1 BUG-L3: schema allows 'system' (z.enum
                     ['light','dark','system']) — expose it in the UI so the
                     setting matches the schema. */}
                 <SelectItem value="light">Terang</SelectItem>
                 <SelectItem value="dark">Gelap</SelectItem>
                 <SelectItem value="system">Sistem</SelectItem>
               </SelectContent>
             </Select>
           </FormRow>

           <Separator className="my-3" />

           {/* Tema warna — preset THEME_PRESETS (kolom themeColor = id preset) */}
           <div className="space-y-2.5">
             <div>
               <Label className="text-sm font-medium">Tema Warna</Label>
               <p className="text-xs text-muted-foreground">Pilih palet warna aksen siap-pakai</p>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
               {THEME_PRESETS.map((preset) => {
                 const active = isPresetActive(preset);
                 return (
                   <button
                     key={preset.id}
                     type="button"
                     onClick={() => applyPreset(preset)}
                     aria-pressed={active}
                     className={cn(
                       'group relative flex flex-col gap-1.5 p-2 rounded-lg border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                       active
                         ? 'border-primary bg-primary/5 shadow-sm'
                         : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'
                     )}
                     title={preset.name}
                   >
                     {/* Baris swatch dua warna preset */}
                     <div className="flex h-6 w-full overflow-hidden rounded-md" aria-hidden="true">
                       <div className="flex-1" style={{ backgroundColor: preset.primary }} />
                       <div className="flex-1" style={{ backgroundColor: preset.secondary }} />
                     </div>
                     <div className="flex items-center gap-1 min-w-0">
                       <span
                         className="h-3 w-3 rounded-full shrink-0"
                         style={{ backgroundColor: preset.primary }}
                         aria-hidden="true"
                       />
                       <span className="text-xs font-medium truncate">{preset.name}</span>
                     </div>
                     {active && (
                       <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full p-0.5 border-2 border-background">
                         <Check className="h-3 w-3" aria-hidden="true" />
                       </span>
                     )}
                   </button>
                 );
               })}
             </div>
           </div>

           <Separator className="my-3" />

           {/* Pratinjau warna aktif */}
           <div className="rounded-lg border border-border p-3 space-y-2">
             <p className="text-xs font-medium text-muted-foreground">Pratinjau</p>
             <div className="flex gap-2">
               <div
                 className="flex-1 h-8 rounded-md flex items-center justify-center text-xs font-medium"
                 style={{
                   backgroundColor:
                     THEME_PRESETS.find((p) => p.id === form.themeColor)?.primary ?? 'var(--primary)',
                   color: '#fff',
                 }}
               >
                 Utama
               </div>
               <div
                 className="flex-1 h-8 rounded-md flex items-center justify-center text-xs font-medium border border-border"
                 style={{
                   backgroundColor:
                     (THEME_PRESETS.find((p) => p.id === form.themeColor)?.secondary ?? '#10b981') + '22',
                   color:
                     THEME_PRESETS.find((p) => p.id === form.themeColor)?.secondary ?? 'var(--secondary)',
                 }}
               >
                 Sekunder
               </div>
             </div>
           </div>
         </SectionCard>

         {/* Preferences Section — Gel 1: hanya Awal Minggu (dropdown Bahasa &
             Target Penyelesaian dihapus — lihat worklog 9-b: kolom DB tetap
             ada di API tapi 0 konsumen UI, kontrol no-op jangan ditampilkan). */}
         <SectionCard icon={Globe} title="Preferensi">
           <FormRow label="Awal Minggu" description="Hari pertama dalam minggu">
             <Select
               value={String(form.weekStart)}
               onValueChange={(v) => updateField('weekStart', Number(v))}
             >
               <SelectTrigger className="h-9">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 {/* Schema: weekStart Int — 1 = Senin, 0 = Minggu. */}
                 <SelectItem value="1">Senin</SelectItem>
                 <SelectItem value="0">Minggu</SelectItem>
               </SelectContent>
             </Select>
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
               { label: 'Total Habit', value: dbStats?.habits ?? '-', icon: ListChecks, tint: 'chip-soft-teal' },
               { label: 'Log Bulan Ini', value: dbStats?.logs ?? '-', icon: Activity, tint: 'chip-soft-violet' },
               { label: 'Hari Dilacak Bulan Ini', value: dbStats?.days ?? '-', icon: CalendarCheck, tint: 'chip-soft-amber' },
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

           {/* DB masih kosong → tawarkan isi data contoh (POST /api/data/seed) */}
           {isDbEmpty && (
             <div className="premium-card rounded-2xl p-4 space-y-2.5">
               <div className="flex items-center gap-3">
                 <span className="chip-soft chip-soft-teal h-9 w-9 shrink-0" aria-hidden="true">
                   <Sprout className="h-4 w-4" />
                 </span>
                 <div className="min-w-0 flex-1">
                   <p className="text-sm font-semibold leading-tight">Belum Ada Data</p>
                   <p className="mt-0.5 text-xs text-muted-foreground">
                     Isi dengan data contoh (habit, log, tujuan, transaksi) untuk mencoba Rutina.
                   </p>
                 </div>
                 <Button
                   size="sm"
                   onClick={() => void handleSeed()}
                   disabled={seeding}
                   className="btn-primary-gradient h-8 shrink-0"
                 >
                   {seeding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sprout className="h-3.5 w-3.5" aria-hidden="true" />}
                   {seeding ? 'Mengisi...' : 'Isi Data Contoh'}
                 </Button>
               </div>
             </div>
           )}

           {/* Export / Import — kontrak API Gel 1 hanya punya export JSON +
               import JSON (tombol CSV dihapus: endpoint tidak ada di kontrak). */}
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
               onClick={() => setImportDialogOpen(true)}
               disabled={importing}
             >
               <Upload className="h-4 w-4" />
               Import JSON
             </Button>
           </div>
           <p className="text-xs text-muted-foreground">Backup JSON berisi seluruh data (habit, log, tujuan, transaksi, dll) dan bisa dipulihkan lewat Import JSON.</p>

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
