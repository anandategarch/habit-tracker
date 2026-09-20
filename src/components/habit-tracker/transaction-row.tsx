'use client';

// ── TransactionRow ──────────────────────────────────────────────────────────
// Extracted from finance-transactions.tsx (Task 71-d — split god files).
// One row of the virtualized transaction timeline (tap-to-expand notes/tags,
// multi-select checkbox, kebab menu edit/hapus). Render logic copied
// verbatim — see inline comments for behavior contracts.

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Trash2, Edit3, MoreHorizontal, CircleOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from '@/lib/date-utils';
import { formatRupiah, parseTags } from './finance-types';
import type { Transaction } from './finance-types';

// PERF-FIX (FIX-TIER3 / Fix 14): Format time from transaction date.
// Hoisted to module scope — this function is stateless and was previously
// re-created on every render.
// H3: Transaction.date menyimpan komponen UTC = jam dinding Jakarta (jam
// disimpan sebagai jam UTC) → jam dibaca dari KOMPONEN UTC langsung lewat
// format(date,'HH:mm') lib/date-utils (getUTCHours). toLocaleTimeString
// timeZone 'Asia/Jakarta' lama mengonversi +7 → jam tampil digeser 7 jam
// (19:58 → 02.58).
function formatTime(dateStr: string) {
  try {
    return format(new Date(dateStr), 'HH:mm');
  } catch {
    return '';
  }
}

// PERF-FIX (Fix 14): Extracted as a separate component so it can be
// memoized in the future (e.g. React.memo) and so the parent's render
// doesn't force re-creation of every visible row's JSX tree. Keeping
// the row's render logic out of the virtualizer map callback also
// makes the code easier to reason about.
interface TransactionRowProps {
  tx: Transaction;
  txIdx: number;
  /** 61-g: baris termasuk batch render awal → boleh anim-stagger; baris
      yang mount akibat scroll TIDAK dianimasikan (anti-kedip). */
  animateEntry: boolean;
  multiSelect: boolean;
  selectedTxIds: Set<string>;
  // SHADCN-PHASE-2: expand support. expandedTxId is the currently-expanded
  // tx id (owned by parent). onToggleExpand flips it (id -> id, same id -> null).
  expandedTxId: string | null;
  onToggleExpand: (id: string) => void;
  getCategoryMeta: (cat: string) => { emoji: string; color: string };
  getSourceEmoji: (name: string) => string;
  onToggleSelectTx: (id: string) => void;
  onEditTx: (tx: Transaction) => void;
  onDeleteTx: (id: string) => void;
}

export function TransactionRow({
  tx,
  txIdx,
  animateEntry,
  multiSelect,
  selectedTxIds,
  expandedTxId,
  onToggleExpand,
  getCategoryMeta,
  getSourceEmoji,
  onToggleSelectTx,
  onEditTx,
  onDeleteTx,
}: TransactionRowProps) {
  const meta = getCategoryMeta(tx.category);
  const isExpense = tx.type === 'expense';
  // M4: transfer tampil NETRAL (violet, tanpa tanda +/−) — bukan emerald
  // untuk kedua kaki yang mengesankan pemasukan dobel.
  const isTransfer = tx.type === 'transfer';
  // SHADCN-PHASE-2: tap-to-expand state. parseTags is null-safe (returns []
  // for missing/invalid tags), so legacy rows without the column render no
  // expand section. hasExpandContent gates both the onClick handler and the
  // expand panel render — cards with no notes AND no tags are not
  // tappable (the edit button remains the only interaction), avoiding a
  // confusing "tapped but nothing happened" UX.
  const isExpanded = expandedTxId === tx.id;
  const tags = parseTags(tx.tags);
  const hasExpandContent = !!(tx.notes || tags.length > 0);
  // CONNECTED-APP: apakah baris ini benar-benar merespons tap? (lihat className)
  const hasTapAction = multiSelect || hasExpandContent || tx.type !== 'transfer';
  return (
    <div
      className={cn('relative', animateEntry && 'anim-stagger')}
      style={animateEntry ? { animationDelay: `${Math.min(txIdx, 8) * 30}ms` } : undefined}
    >
      {/* Timeline node — warna diharmonisasi dengan amount (rose / emerald /
          violet netral untuk transfer) */}
      <div
        className="tx-node"
        style={{
          backgroundColor: isTransfer ? '#8b5cf6' : isExpense ? '#f43f5e' : '#10b981',
        }}
      />

      {/* Transaction row — PREMIUM-UI ("Rutina Aurora").
          .premium-list-item: baris kaya dengan hover tint halus; avatar
          emoji squircle (tint warna kategori), judul font-medium, label
          kategori kecil muted, nominal rata kanan tabular-nums
          (emerald + / rose −). Padding dinaikkan via important utility
          (unlayered .premium-list-item hanya set 10px/12px).
          onClick behavior (dipertahankan persis):
          - multiSelect mode: toggle selection.
          - single-select + hasExpandContent: toggle expand.
          - single-select + no expand content: fallback ke edit dialog. */}
      <div
        className={cn(
          'premium-list-item group relative mb-1.5 flex-wrap px-4! py-3!',
          // CONNECTED-APP (button audit): baris transfer tanpa konten expand
          // TIDAK punya aksi tap — jangan tampilkan affordance pointer/aktif
          // (dulu terlihat klikabel padahal tap = no-op).
          hasTapAction ? 'cursor-pointer active:scale-[0.99]' : ''
        )}
        onClick={() => {
          if (multiSelect) {
            onToggleSelectTx(tx.id);
          } else if (hasExpandContent) {
            onToggleExpand(tx.id);
          } else if (tx.type !== 'transfer') {
            // BUGFIX POST-3 #4: Fallback ke edit dialog saat card tidak punya
            // notes/tags untuk expand. Sebelum Phase 2, tap card = edit. Sekarang
            // tap card = expand (jika ada content) atau edit (jika tidak ada).
            // Transfer dikecualikan — dialog edit tidak bisa menyimpannya
            // (API menolak perubahan jumlah/kategori transfer).
            onEditTx(tx);
          }
        }}
      >
        {/* Multi-select checkbox
            BUG-FINANCE-CAL BUG-1: wrap the checkbox in a stopPropagation
            container. Without this, clicking the checkbox bubbles up to the
            tx-card's onClick (which toggles selection in multi-select mode),
            so onCheckedChange AND the parent onClick BOTH fire — net-zero
            selection change. The checkbox appeared broken: clicking it did
            nothing. Now the wrapper swallows the click so only the checkbox's
            onCheckedChange runs. */}
        {multiSelect && (
          <div
            className="absolute top-2 right-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selectedTxIds.has(tx.id)}
              onCheckedChange={() => onToggleSelectTx(tx.id)}
            />
          </div>
        )}

        {/* Avatar emoji squircle — tint warna kategori (meta.color hex +
            alpha 12.5% = RRGGBBAA; getCategoryMeta selalu mengembalikan
            6-digit hex, fallback '#78716c'). Ring hairline memberi definisi
            di atas background sage. */}
        <span
          className="h-10 w-10 rounded-xl grid place-items-center text-base shrink-0 ring-1 ring-black/5 dark:ring-white/10"
          style={{ backgroundColor: `${meta.color}20` }}
          aria-hidden="true"
        >
          {meta.emoji}
        </span>

        {/* Content: judul (description → fallback kategori) + waktu */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2.5">
            <span className="text-sm font-medium truncate flex items-center gap-1.5 min-w-0">
              {tx.description?.trim() || tx.category}
              {tx.groupId && (
                <span className="text-[9px] px-1 py-0 rounded-full bg-success/10 text-success dark:bg-success/15 dark:text-success/80 font-medium shrink-0">
                  Split
                </span>
              )}
            </span>
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {formatTime(tx.date)}
            </span>
          </div>

          {/* Meta line: kategori (label kecil muted) + sumber dana.
              Kategori hanya tampil bila judul memakai description —
              hindari duplikasi saat kategori sudah menjadi judul.
              SHADCN-PHASE-2: tag badges tetap di panel tap-to-expand
              di bawah (declutter tampilan default). */}
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 min-w-0">
            {tx.description?.trim() && (
              <>
                <span className="truncate">{tx.category}</span>
                <span aria-hidden="true" className="shrink-0">·</span>
              </>
            )}
            {/* BUGHUNT-54 (3-a #5): transaksi tanpa sumber (source & sourceName
                keduanya kosong) jangan berlabel palsu "Kas 👛" — tampil jujur
                "Tanpa Sumber" dengan ikon netral. */}
            {!tx.source && !tx.sourceName ? (
              <>
                <span className="shrink-0 text-muted-foreground/60" aria-hidden="true">
                  <CircleOff className="h-3 w-3" />
                </span>
                <span className="truncate text-muted-foreground/70">Tanpa Sumber</span>
              </>
            ) : (
              <>
                <span className="shrink-0" aria-hidden="true">{getSourceEmoji(tx.source || tx.sourceName || 'Kas')}</span>
                <span className="truncate">{tx.source || tx.sourceName || 'Kas'}</span>
              </>
            )}
          </p>
        </div>

        {/* Amount — rata kanan, tabular-nums, emerald (+) / rose (−) /
            transfer NETRAL violet tanpa tanda (M4: kedua kaki transfer bukan
            pemasukan/pengeluaran — menandainya +/- menyesatkan). */}
        <div className="shrink-0 text-right self-center">
          <span
            className={cn(
              'text-sm font-semibold tabular-nums',
              isTransfer
                ? 'text-violet-600 dark:text-violet-400'
                : isExpense
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-emerald-600 dark:text-emerald-400'
            )}
          >
            {isTransfer ? '' : isExpense ? '−' : '+'}{formatRupiah(tx.amount)}
          </span>
        </div>

        {/* SPACING-FIX (permintaan user: "jarak card terlalu jauh"):
            dulu 2 tombol aksi ditumpuk VERTIKAL — kolom 78px membengkakkan
            kartu jadi ±104px. Kini 1 tombol menu kebab — tinggi kartu
            kembali ±64px (avatar 40px + padding), lebar teks mobile tetap.
            Edit/hapus jadi 2 ketuk via menu. Aturan lama dipertahankan:
            edit disabled untuk transfer (pasangan ter-link, API menolak
            perubahan jumlah/kategori); delete tetap boleh untuk transfer
            (API atomik menghapus pasangan + memulihkan saldo). */}
        {!multiSelect && (
          <div className="shrink-0 ml-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={(e) => e.stopPropagation()}
                  title="Menu transaksi"
                  aria-label="Menu transaksi"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={tx.type === 'transfer'}
                  onClick={() => onEditTx(tx)}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDeleteTx(tx.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Hapus</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* SHADCN-PHASE-2: tap-to-expand panel (notes + tags).
            Renders only when this card is expanded AND has content.
            anim-tab-enter (defined in globals.css) provides a smooth
            fade + slide-in from the right, and respects
            prefers-reduced-motion (globals.css sets it to `none` under
            the reduced-motion media query).
            Virtualization note: the parent virtualizer uses
            measureElement (ResizeObserver) on each row, so when this
            panel mounts/unmounts and the row's height changes, the
            virtualizer auto-re-measures — no manual invalidate needed.
            This is why state lives in the parent: a row can unmount when
            scrolled out of view and remount when scrolled back, and its
            expand state survives because it's keyed by tx.id in the
            parent, not held in row-local state. */}
        {isExpanded && hasExpandContent && (
          <div className="mt-2 pt-2 w-full basis-full border-t border-border/50 text-xs text-muted-foreground anim-tab-enter">
            {tx.notes && (
              <p className="mb-1 break-words">{tx.notes}</p>
            )}
            {tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {tags.map((tag, i) => (
                  <span
                    key={`${tag}-${i}`}
                    className="px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground border border-border/60"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
