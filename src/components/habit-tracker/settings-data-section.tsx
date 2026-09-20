'use client';

// components/habit-tracker/settings-data-section.tsx — sub-tab "Data" dari
// settings.tsx (Task 71-h): stat DB (total habit / log bulan ini / hari
// dilacak), seed data contoh saat DB kosong, backup/import JSON, dan
// hapus semua data (AlertDialog konfirmasi). Semua handler + state lokal
// hidup di sini; router sub-tab tetap di settings.tsx.

import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import {
  Database,
  Trash2,
  AlertTriangle,
  Loader2,
  Upload,
  HardDriveDownload,
  ListChecks,
  Activity,
  CalendarCheck,
  Sprout,
} from 'lucide-react';
import { jakartaMonthString } from '@/lib/timezone';
import type { AppSettings } from './settings-types';
import { SectionCard } from './settings-ui';

interface DataSectionProps {
  /** Snapshot query ['settings'] milik settings.tsx — stat hanya dihitung
   *  setelah settings termuat (null → tile menampilkan '-'). */
  settings: AppSettings | null;
}

export function DataSection({ settings }: DataSectionProps) {
  const triggerRefresh = useAppStore(s => s.triggerRefresh);
  const queryClient = useQueryClient();
  const [resetting, setResetting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
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
  );
}
