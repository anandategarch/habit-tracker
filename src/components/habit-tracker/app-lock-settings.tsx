'use client';

// components/habit-tracker/app-lock-settings.tsx — kunci aplikasi berbasis PIN
// di PERANGKAT ini (hash SHA-256 disimpan di localStorage — tidak dikirim ke
// server; kontrak /api/settings tidak menerima appLockHash).
//
// Helper isAppLockSet/verifyAppLockPin diekspor supaya gerbang layar (shell)
// dapat mengonsumsinya tanpa duplikasi logika.

import { useCallback, useState } from 'react';
import { Lock, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const LOCK_STORAGE_KEY = 'rutina_app_lock';

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`rutina:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Apakah kunci aktif di perangkat ini? */
export function isAppLockSet(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.localStorage.getItem(LOCK_STORAGE_KEY);
}

/** Verifikasi PIN terhadap hash tersimpan. */
export async function verifyAppLockPin(pin: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(LOCK_STORAGE_KEY);
  if (!stored) return true;
  return (await hashPin(pin)) === stored;
}

async function saveLock(pin: string): Promise<void> {
  window.localStorage.setItem(LOCK_STORAGE_KEY, await hashPin(pin));
}

async function clearLock(): Promise<void> {
  window.localStorage.removeItem(LOCK_STORAGE_KEY);
}

const PIN_PATTERN = /^\d{4,6}$/;

export function AppLockSection() {
  const [hasLock, setHasLock] = useState<boolean>(() => isAppLockSet());
  const [dialogOpen, setDialogOpen] = useState(false);
  // 'set' = aktifkan, 'change' = ganti PIN, 'off' = matikan.
  const [mode, setMode] = useState<'set' | 'change' | 'off'>('set');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);

  const openDialog = useCallback((next: 'set' | 'change' | 'off') => {
    setMode(next);
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setDialogOpen(true);
  }, []);

  const handleClose = useCallback((open: boolean) => {
    if (busy) return;
    setDialogOpen(open);
  }, [busy]);

  async function handleSubmit() {
    if (busy) return;
    if (mode !== 'set' && !PIN_PATTERN.test(currentPin)) {
      toast.error('Masukkan PIN saat ini (4-6 angka)');
      return;
    }
    if (mode === 'off') {
      setBusy(true);
      try {
        if (!(await verifyAppLockPin(currentPin))) {
          toast.error('PIN saat ini salah');
          return;
        }
        await clearLock();
        setHasLock(false);
        setDialogOpen(false);
        toast.success('Kunci aplikasi dimatikan');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (!PIN_PATTERN.test(newPin)) {
      toast.error('PIN baru harus 4-6 angka');
      return;
    }
    if (newPin !== confirmPin) {
      toast.error('Konfirmasi PIN tidak sama');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'change' && !(await verifyAppLockPin(currentPin))) {
        toast.error('PIN saat ini salah');
        return;
      }
      await saveLock(newPin);
      setHasLock(true);
      setDialogOpen(false);
      toast.success(mode === 'change' ? 'PIN berhasil diganti' : 'Kunci aplikasi diaktifkan');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="premium-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span
          className={cn('chip-soft h-9 w-9 shrink-0', hasLock ? 'chip-soft-teal' : 'chip-soft-rose')}
          aria-hidden="true"
        >
          {hasLock ? <ShieldCheck className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold leading-tight">Kunci Aplikasi</h2>
            {hasLock && (
              <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                <ShieldCheck className="h-2.5 w-2.5" aria-hidden="true" />
                Aktif
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            PIN 4-6 angka, tersimpan ter-hash di perangkat ini (bukan di server).
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {hasLock ? (
            <>
              <Button variant="outline" size="sm" onClick={() => openDialog('change')} className="h-8">
                Ganti PIN
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openDialog('off')}
                className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              >
                Matikan
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => openDialog('set')} className="h-8 btn-primary-gradient">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Aktifkan
            </Button>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle asChild>
              <div className="flex items-center gap-3 pr-8">
                <span className="chip-soft chip-soft-teal h-9 w-9 shrink-0" aria-hidden="true">
                  <Lock className="h-4 w-4" />
                </span>
                <span className="text-lg font-semibold leading-tight">
                  {mode === 'set' ? 'Aktifkan Kunci' : mode === 'change' ? 'Ganti PIN' : 'Matikan Kunci'}
                </span>
              </div>
            </DialogTitle>
            <DialogDescription>
              {mode === 'set'
                ? 'Buat PIN untuk mengunci aplikasi di perangkat ini.'
                : mode === 'change'
                  ? 'Masukkan PIN saat ini lalu PIN baru.'
                  : 'Masukkan PIN saat ini untuk mematikan kunci.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3.5 py-1">
            {mode !== 'set' && (
              <div className="space-y-1.5">
                <Label htmlFor="lock-current">PIN Saat Ini</Label>
                <Input
                  id="lock-current"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  placeholder="••••"
                  value={currentPin}
                  maxLength={6}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  className="rounded-xl tracking-[0.3em]"
                />
              </div>
            )}
            {mode !== 'off' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="lock-new">PIN Baru</Label>
                  <Input
                    id="lock-new"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    placeholder="4-6 angka"
                    value={newPin}
                    maxLength={6}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    className="rounded-xl tracking-[0.3em]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lock-confirm">Konfirmasi PIN Baru</Label>
                  <Input
                    id="lock-confirm"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    placeholder="ulangi PIN"
                    value={confirmPin}
                    maxLength={6}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className="rounded-xl tracking-[0.3em]"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Batal
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={busy} className="btn-primary-gradient">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {mode === 'off' ? 'Matikan Kunci' : 'Simpan PIN'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
