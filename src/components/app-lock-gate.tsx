'use client';

// BUGHUNT-54 (3-d #2): Gerbang Kunci Aplikasi — komponen BARU.
// Sebelumnya app-lock-settings.tsx mengekspor isAppLockSet()/
// verifyAppLockPin() tapi TIDAK ADA konsumen → fitur PIN "aktif" palsu
// (localStorage rutina_app_lock terisi, reload → langsung masuk konten).
// Gate ini membungkus seluruh shell aplikasi (header, konten tab, dock,
// drawer) di page.tsx dan hanya aktif saat PIN tersimpan di perangkat.
//
// Kontrak API (dibaca dari app-lock-settings.tsx — file itu READ-ONLY):
//  - localStorage key 'rutina_app_lock' berisi hash SHA-256('rutina:'+pin).
//  - PIN 4-6 angka; PANJANG tersimpan tidak bisa diketahui (hash saja)
//    → tombol "Buka" aktif mulai 4 digit + auto-submit saat 6 digit.
//
// KETERBATASAN (dokumentasi jujur / follow-up):
//  - Kunci berlaku saat SESI BARU (app dibuka fresh / tab baru) — status
//    "sudah dibuka" disimpan di sessionStorage ('rutina_unlocked').
//  - TIDAK mengunci saat tab sekadar blur/visibilitychange (butuh re-lock
//    timer + kebijakan grace period — dicatat sebagai follow-up, agar
//    switch-app PWA singkat tidak mengganggu pengguna).

import { useCallback, useEffect, useRef, useState } from 'react';
import { Delete, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isAppLockSet, verifyAppLockPin } from '@/components/habit-tracker/app-lock-settings';

const UNLOCKED_KEY = 'rutina_unlocked';
const PIN_MAX = 6; // app-lock-settings: PIN_PATTERN /^\d{4,6}$/
const PIN_MIN = 4;

type Phase = 'checking' | 'locked' | 'open';

export function AppLockGate({ children }: { children: React.ReactNode }) {
  // 'checking' = fase init: status kunci dihitung di useEffect (bukan saat
  // render) supaya aman SSR/hydration. Selama 'checking' gate merender null
  // — konten TIDAK boleh berflash dulu lalu terkunci (membocorkan isi app);
  // frame kosong ini tak terlihat karena tertutup splash screen (z-100 > z-90).
  const [phase, setPhase] = useState<Phase>('checking');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const locked = isAppLockSet() && sessionStorage.getItem(UNLOCKED_KEY) !== '1';
    setPhase(locked ? 'locked' : 'open');
  }, []);

  // a11y: fokuskan layar kunci saat tampil (keypad menerima keyboard fisik).
  useEffect(() => {
    if (phase === 'locked') screenRef.current?.focus();
  }, [phase]);

  const fail = useCallback(() => {
    setError(true);
    setShake((n) => n + 1);
    setPin('');
  }, []);

  const submit = useCallback(
    async (value: string) => {
      if (verifying || value.length < PIN_MIN) return;
      setVerifying(true);
      try {
        if (await verifyAppLockPin(value)) {
          sessionStorage.setItem(UNLOCKED_KEY, '1');
          setPhase('open');
        } else {
          fail();
        }
      } catch {
        fail();
      } finally {
        setVerifying(false);
      }
    },
    [verifying, fail]
  );

  const pressDigit = useCallback(
    (d: string) => {
      if (verifying) return;
      setError(false); // mulai percobaan baru — pesan salah disembunyikan
      setPin((prev) => (prev.length >= PIN_MAX ? prev : prev + d));
    },
    [verifying]
  );

  const pressBackspace = useCallback(() => {
    if (verifying) return;
    setError(false);
    setPin((prev) => prev.slice(0, -1));
  }, [verifying]);

  // Auto-verifikasi saat jumlah digit = panjang MAKSIMUM (6). Panjang PIN
  // tersimpan tak diketahui (hash) → PIN 4/5 digit dikonfirmasi via "Buka".
  useEffect(() => {
    if (phase === 'locked' && pin.length === PIN_MAX) void submit(pin);
  }, [pin, phase, submit]);

  // Keyboard fisik (desktop) — event bubbling dari anak-anak keypad.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (phase !== 'locked') return;
      if (e.key >= '0' && e.key <= '9') {
        pressDigit(e.key);
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        pressBackspace();
        e.preventDefault();
      } else if (e.key === 'Enter') {
        void submit(pin);
      }
    },
    [phase, pin, pressDigit, pressBackspace, submit]
  );

  if (phase === 'checking') return null;
  if (phase === 'open') return <>{children}</>;

  const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div
      ref={screenRef}
      role="dialog"
      aria-modal="true"
      aria-label="Kunci aplikasi Rutina"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn(
        'fixed inset-0 z-[90] flex flex-col items-center justify-center gap-7 px-6 select-none',
        'bg-gradient-to-b from-[#06302a] via-[#04231e] to-[#03150f]',
        'text-white outline-none'
      )}
    >
      {/* Ambience Aurora senyap — glow teal/emerald (tanpa indigo/biru). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:radial-gradient(52%_30%_at_50%_-6%,rgba(45,212,191,0.14),transparent_70%),radial-gradient(40%_24%_at_96%_100%,rgba(16,185,129,0.10),transparent_72%)]"
      />

      <div className="relative flex flex-col items-center gap-3 text-center">
        <span
          aria-hidden="true"
          className="grid h-16 w-16 place-items-center rounded-[22px] bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500 shadow-[0_10px_30px_-8px_rgba(16,185,129,0.55)]"
        >
          <Lock className="h-7 w-7 text-white" strokeWidth={2.2} />
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">Rutina terkunci</h1>
        <p className="text-sm text-teal-100/70">Masukkan PIN Anda</p>
        <p
          role="alert"
          aria-live="assertive"
          className={cn(
            'min-h-[1.25rem] text-sm font-medium text-rose-300 transition-opacity duration-200',
            error ? 'opacity-100' : 'opacity-0'
          )}
        >
          PIN salah
        </p>
      </div>

      {/* Titik PIN tersamar — key={shake} me-retrigger animasi tiap gagal. */}
      <div
        key={shake}
        aria-hidden="true"
        className={cn('flex items-center gap-3.5', error && 'anim-pin-shake')}
      >
        {Array.from({ length: PIN_MAX }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-3 w-3 rounded-full transition-all duration-150',
              i < pin.length
                ? 'scale-100 bg-white shadow-[0_0_10px_rgba(255,255,255,0.45)]'
                : 'scale-90 bg-white/15 ring-1 ring-inset ring-white/25'
            )}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {pin.length} angka dimasukkan
      </p>

      {/* Keypad 3×4 — tombol besar (56px ≥ 44px target sentuh). */}
      <div className="relative grid grid-cols-3 gap-3 sm:gap-4" role="group" aria-label="Papan angka PIN">
        {keypadKeys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => pressDigit(k)}
            disabled={verifying}
            aria-label={k}
            className={cn(
              'h-14 w-14 sm:h-16 sm:w-16 rounded-full text-xl font-semibold',
              'bg-white/[0.07] ring-1 ring-inset ring-white/15',
              'transition-transform duration-100 active:scale-90 motion-reduce:transition-none',
              'hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/80',
              'disabled:opacity-50'
            )}
          >
            {k}
          </button>
        ))}
        {/* Sel kosong (baris ke-4 kolom-1) — jeda ritme keypad standar. */}
        <span aria-hidden="true" className="h-14 w-14 sm:h-16 sm:w-16" />
        <button
          type="button"
          onClick={() => pressDigit('0')}
          disabled={verifying}
          aria-label="0"
          className={cn(
            'h-14 w-14 sm:h-16 sm:w-16 rounded-full text-xl font-semibold',
            'bg-white/[0.07] ring-1 ring-inset ring-white/15',
            'transition-transform duration-100 active:scale-90 motion-reduce:transition-none',
            'hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/80',
            'disabled:opacity-50'
          )}
        >
          0
        </button>
        <button
          type="button"
          onClick={pressBackspace}
          disabled={verifying || pin.length === 0}
          aria-label="Hapus satu angka"
          className={cn(
            'h-14 w-14 sm:h-16 sm:w-16 rounded-full',
            'bg-white/[0.07] ring-1 ring-inset ring-white/15',
            'transition-transform duration-100 active:scale-90 motion-reduce:transition-none',
            'hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/80',
            'disabled:opacity-50'
          )}
        >
          <Delete className="mx-auto h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => void submit(pin)}
        disabled={verifying || pin.length < PIN_MIN}
        className={cn(
          'h-12 min-w-[180px] rounded-2xl px-8 text-sm font-semibold text-white',
          'bg-gradient-to-br from-teal-400 via-teal-500 to-emerald-500',
          'shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)]',
          'transition-transform duration-100 active:scale-95 motion-reduce:transition-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#04231e]',
          'disabled:opacity-50'
        )}
      >
        Buka
      </button>
    </div>
  );
}
