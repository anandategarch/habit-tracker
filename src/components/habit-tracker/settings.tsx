'use client';

// components/habit-tracker/settings.tsx — tab Pengaturan (Task 71-h split).
// File ini kini HANYA: router sub-section (premium-segment) + state bersama
// (activeSection di store, quickAddAction FAB, query ['settings'] sebagai
// gerbang loading). Isi tiap section dipecah ke sibling:
// - settings-general-section.tsx → sub-tab "Umum" (profil/tampilan/
//   preferensi/label/kunci aplikasi/tombol simpan)
// - settings-data-section.tsx → sub-tab "Data" (stat, seed, export/import,
//   hapus semua)
// - sub-tab "habits" → <HabitMaster /> (dynamic import, tetap di sini).

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/page-header';
import { Separator } from '@/components/ui/separator';
import dynamic from 'next/dynamic';
import {
  Settings as SettingsIcon,
  ListChecks,
  Database,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import type { AppSettings } from './settings-types';
import { LoadingSkeleton } from './settings-skeleton';
import { GeneralSection } from './settings-general-section';
import { DataSection } from './settings-data-section';

const HabitMaster = dynamic(() => import('./habit-master'), { ssr: false });

export default function Settings() {
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

  // ── Fetch settings (TanStack Query) — gerbang loading seluruh tab +
  // snapshot yang diteruskan ke kedua section (stat Data dihitung hanya
  // setelah settings termuat). ────────────────────────────────────────────
  const { data: settings = null, isLoading: loading } = useQuery<AppSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 60_000,
  });

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
      {activeSection === 'umum' && <GeneralSection settings={settings} />}

      {/* ── DATA SECTION ── */}
      {activeSection === 'data' && <DataSection settings={settings} />}
    </div>
  );
}
