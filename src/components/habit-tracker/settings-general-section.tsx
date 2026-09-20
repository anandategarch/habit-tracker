'use client';

// components/habit-tracker/settings-general-section.tsx — sub-tab "Umum"
// dari settings.tsx (Task 71-h): profil, tampilan (mode tema + preset
// warna), preferensi (awal minggu), label habit, kunci aplikasi, dan tombol
// simpan. State form + pratinjau tema + handleSave hidup di sini; router
// sub-tab dan query ['settings'] tetap di settings.tsx (prop `settings`).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Save, User, Palette, Globe, Check } from 'lucide-react';
import {
  applyThemeColors,
  applyThemeMode,
  resetThemeColors,
  THEME_PRESETS,
  type ThemePreset,
} from '@/lib/theme-utils';
import LabelManager from './label-manager';
import { AppLockSection } from './app-lock-settings';
import type { AppSettings, SettingsFormState } from './settings-types';
import { SectionCard, FormRow } from './settings-ui';

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

interface GeneralSectionProps {
  /** Snapshot query ['settings'] milik settings.tsx (null saat belum termuat). */
  settings: AppSettings | null;
}

export function GeneralSection({ settings }: GeneralSectionProps) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

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

  return (
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
  );
}
