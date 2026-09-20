'use client';

// components/habit-tracker/habit-master.tsx — komposisi root Habit Master
// (Task 71-b: pemecahan god file). File ini sekarang hanya menyusun
// sub-komponen + state lokal UI:
//   · use-habit-master-data.ts  → query + mutasi server + derived options
//   · use-habit-master-form.ts  → sesi dialog create/edit + quick-add FAB
//   · habit-master-form-dialog  → dialog form (bagian field di habit-form-*)
//   · habit-filters.tsx         → toolbar cari/filter (sudah terpisah)
//   · habit-quick-add.tsx       → bar quick-add
//   · habit-groups-section.tsx  → kelola grup
//   · habit-master-list.tsx     → skeleton/empty/tabel/kartu
//   · habit-master-delete-dialog.tsx → konfirmasi hapus
// Kontrak publik dijaga: path + default export (settings.tsx memuat dinamis).

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { ListChecks } from 'lucide-react';
import { useHabitMasterData, filterHabits } from './use-habit-master-data';
import { useHabitMasterForm } from './use-habit-master-form';
import { HabitFormDialog } from './habit-master-form-dialog';
import { QuickAddBar } from './habit-quick-add';
import { FiltersBar } from './habit-filters';
import { HabitGroupsSection } from './habit-groups-section';
import { HabitMasterList } from './habit-master-list';
import { HabitDeleteDialog } from './habit-master-delete-dialog';

export default function HabitMaster() {
  // ── Data layer (query + mutasi + derived options) ───────────────────────
  const {
    habits,
    loading,
    groups,
    groupsLoading,
    categories,
    priorities,
    difficulties,
    categoryMap,
    priorityMap,
    difficultyMap,
    submitHabit,
    deleteHabit,
    toggleStatus,
    archiveHabit,
    quickAddHabit,
    createGroup,
    deleteGroup,
  } = useHabitMasterData();

  // ── Sesi dialog create/edit (state form + alur quick-add FAB) ──────────
  const session = useHabitMasterForm(submitHabit);
  const { formEmojiPicker, setFormEmojiPicker, openAdd, openEdit } = session;

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Quick add
  const [quickName, setQuickName] = useState('');
  const [quickIcon, setQuickIcon] = useState('🎯');
  const [quickAdding, setQuickAdding] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Groups
  const [groupsOpen, setGroupsOpen] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#22c55e');
  const [addingGroup, setAddingGroup] = useState(false);

  // Delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Task 61 (audit 61-a P3, revisi pusat): tutup KEDUA popover emoji (form
  // dialog + quick-add bar) saat pointer down di luar area masing-masing.
  // Penanda bersama data-emoji-popover-wrap dipakai karena popover quick-add
  // bar dirender komponen terpisah (habit-quick-add.tsx) tanpa akses ref.
  useEffect(() => {
    if (!formEmojiPicker && !showEmojiPicker) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-emoji-popover-wrap]')) return;
      if (formEmojiPicker) setFormEmojiPicker(false);
      if (showEmojiPicker) setShowEmojiPicker(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [formEmojiPicker, showEmojiPicker]);

  // ── Filtered habits ─────────────────────────────────────────────────────

  const filteredHabits = filterHabits(habits, search, categoryFilter, statusFilter);

  // ── Wrapper UI lokal (state reset pasca-sukses ada di sini; toast +
  //    mutasi server ada di use-habit-master-data) ─────────────────────────

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    setAddingGroup(true);
    try {
      const ok = await createGroup(newGroupName, newGroupColor);
      if (ok) {
        setNewGroupName('');
        setNewGroupColor('#22c55e');
      }
    } finally {
      setAddingGroup(false);
    }
  }

  async function handleQuickAdd() {
    if (!quickName.trim()) return;
    setQuickAdding(true);
    try {
      const ok = await quickAddHabit(quickName, quickIcon);
      if (ok) setQuickName('');
    } finally {
      setQuickAdding(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const ok = await deleteHabit(deleteId);
      if (ok) setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title="Habit Master"
        subtitle="Kelola dan atur semua habit kamu di satu tempat."
        icon={ListChecks}
        eyebrow="Perpustakaan Habit"
      >
        <HabitFormDialog
          session={session}
          categories={categories}
          priorities={priorities}
          difficulties={difficulties}
          groups={groups}
        />
      </PageHeader>

      {/* Quick Add Bar */}
      <QuickAddBar
        quickIcon={quickIcon}
        setQuickIcon={setQuickIcon}
        quickName={quickName}
        setQuickName={setQuickName}
        handleQuickAdd={handleQuickAdd}
        quickAdding={quickAdding}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
      />

      {/* Filters Bar */}
      <FiltersBar
        search={search}
        setSearch={setSearch}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        categories={categories}
      />

      {/* Habit Groups */}
      <HabitGroupsSection
        groups={groups}
        groupsLoading={groupsLoading}
        groupsOpen={groupsOpen}
        setGroupsOpen={setGroupsOpen}
        newGroupName={newGroupName}
        setNewGroupName={setNewGroupName}
        newGroupColor={newGroupColor}
        setNewGroupColor={setNewGroupColor}
        addingGroup={addingGroup}
        handleCreateGroup={handleCreateGroup}
        handleDeleteGroup={deleteGroup}
      />

      {/* ── Habit List (Desktop Table + Mobile Cards) ────────────────────── */}
      <HabitMasterList
        loading={loading}
        habits={habits}
        filteredHabits={filteredHabits}
        categoryMap={categoryMap}
        priorityMap={priorityMap}
        difficultyMap={difficultyMap}
        onEdit={openEdit}
        onToggleStatus={toggleStatus}
        onArchive={archiveHabit}
        onDelete={setDeleteId}
        onAdd={openAdd}
      />

      {/* ── Delete Confirmation ──────────────────────────────────────────── */}
      <HabitDeleteDialog
        open={!!deleteId}
        deleting={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
