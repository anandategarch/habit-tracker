'use client';

// AppLockSection — Settings → Umum → "Kunci Aplikasi" section card.
//
// Encapsulates all the UI + dialog logic for the app-lock feature so that
// settings.tsx just renders `<AppLockSection />` inside its "umum" tab.
//
// Functionality:
//  - When app lock is DISABLED: shows an "Aktifkan Kunci Aplikasi" button
//    that opens a 2-step PIN setup dialog (enter PIN → confirm PIN).
//  - When app lock is ENABLED: shows
//      * Status pill ("Aktif")
//      * Auto-lock timeout select (Langsung / 1m / 5m / 15m)
//      * Biometric enroll/unenroll button (if WebAuthn is available)
//      * "Ubah PIN" button → 3-step change PIN dialog
//      * "Matikan Kunci Aplikasi" button → 1-step disable dialog
//
// All crypto/storage operations are delegated to the lib helpers created by
// APPLOCK-LIB:
//   - hashPin, verifyPin  from @/lib/app-lock/pin-hash
//   - isBiometricAvailable, enrollBiometric from @/lib/app-lock/webauthn
//   - getAppLockConfig, setAppLockConfig, clearAppLockConfig
//                          from @/lib/app-lock/storage
//   - recordSuccessfulAttempt from @/lib/app-lock/rate-limit
//
// The hook `useAppLock` (also from APPLOCK-LIB) is used to (a) read the
// current enabled state and (b) push enable/disable/auto-lock changes back
// to the runtime lock state so AppLockGate reacts immediately.

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SectionCard } from '@/components/habit-tracker/settings-ui';
import { PinPad } from '@/components/app-lock/PinPad';
import { useAppLock } from '@/hooks/use-app-lock';
import {
  getAppLockConfig,
  setAppLockConfig,
  clearAppLockConfig,
} from '@/lib/app-lock/storage';
import { verifyPin, setupPin } from '@/lib/app-lock/pin-hash';
import {
  isBiometricAvailable,
  registerBiometric,
} from '@/lib/app-lock/webauthn';
import { recordSuccessfulAttempt } from '@/lib/app-lock/rate-limit';
import { toast } from 'sonner';
import {
  Lock,
  Fingerprint,
  ShieldCheck,
  ShieldOff,
  KeyRound,
  Loader2,
} from 'lucide-react';

const AUTO_LOCK_OPTIONS: { label: string; value: string; ms: number }[] = [
  { label: 'Langsung', value: '0', ms: 0 },
  { label: '1 menit', value: '60000', ms: 60_000 },
  { label: '5 menit', value: '300000', ms: 300_000 },
  { label: '15 menit', value: '900000', ms: 900_000 },
];

type SetupStep = 'create' | 'confirm';
type ChangeStep = 'verify-current' | 'enter-new' | 'confirm-new';

export function AppLockSection() {
  const { isEnabled, refreshConfig } = useAppLock();

  // Local UI state
  const [setupOpen, setSetupOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  const [setupStep, setSetupStep] = useState<SetupStep>('create');
  const [changeStep, setChangeStep] = useState<ChangeStep>('verify-current');
  const [setupError, setSetupError] = useState('');
  const [changeError, setChangeError] = useState('');
  const [disableError, setDisableError] = useState('');
  const [busy, setBusy] = useState(false);

  // Stash for multi-step flows
  const [pendingPin, setPendingPin] = useState('');

  // Biometric availability (only checked when app lock is enabled — there's
  // no point offering enrollment before the user has a PIN).
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnrolling, setBioEnrolling] = useState(false);

  // Re-read config + biometric availability whenever the section becomes
  // visible (isEnabled changes or a dialog closes).
  const config = getAppLockConfig();
  useEffect(() => {
    if (!isEnabled) {
      setBioAvailable(false);
      return;
    }
    let cancelled = false;
    isBiometricAvailable().then((avail) => {
      if (!cancelled) setBioAvailable(avail);
    });
    return () => {
      cancelled = true;
    };
  }, [isEnabled]);

  // ── Setup flow ──────────────────────────────────────────────────────────
  const openSetup = () => {
    setSetupStep('create');
    setSetupError('');
    setPendingPin('');
    setSetupOpen(true);
  };

  const handleSetupSubmit = useCallback(
    async (pin: string): Promise<boolean> => {
      setBusy(true);
      try {
        if (setupStep === 'create') {
          // Stash PIN, advance to confirm step.
          setPendingPin(pin);
          setSetupStep('confirm');
          setSetupError('');
          return true;
        }
        // confirm step
        if (pin !== pendingPin) {
          setSetupError('PIN tidak cocok. Coba lagi.');
          // Reset back to create step so the user starts over.
          setSetupStep('create');
          setPendingPin('');
          return false;
        }
        // PINs match — hash + persist + enable.
        const { hash, salt, iterations } = await setupPin(pin);
        setAppLockConfig({
          enabled: true,
          pinHash: hash,
          pinSalt: salt,
          pinIterations: iterations,
          // Preserve any prior auto-lock timeout (default 0 = immediate).
          autoLockTimeout: config.autoLockTimeout,
        });
        recordSuccessfulAttempt();
        refreshConfig();
        setSetupOpen(false);
        toast.success('Kunci Aplikasi diaktifkan');
        return true;
      } catch {
        setSetupError('Gagal menyimpan PIN. Coba lagi.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [setupStep, pendingPin, config.autoLockTimeout, refreshConfig],
  );

  // ── Change PIN flow ─────────────────────────────────────────────────────
  const openChange = () => {
    setChangeStep('verify-current');
    setChangeError('');
    setPendingPin('');
    setChangeOpen(true);
  };

  const handleChangeSubmit = useCallback(
    async (pin: string): Promise<boolean> => {
      setBusy(true);
      try {
        if (changeStep === 'verify-current') {
          const ok = await verifyPin(
            pin,
            config.pinHash!,
            config.pinSalt!,
            config.pinIterations,
          );
          if (!ok) {
            setChangeError('PIN salah');
            return false;
          }
          setChangeStep('enter-new');
          setChangeError('');
          return true;
        }
        if (changeStep === 'enter-new') {
          setPendingPin(pin);
          setChangeStep('confirm-new');
          setChangeError('');
          return true;
        }
        // confirm-new
        if (pin !== pendingPin) {
          setChangeError('PIN tidak cocok. Coba lagi.');
          setChangeStep('enter-new');
          setPendingPin('');
          return false;
        }
        const { hash, salt, iterations } = await setupPin(pin);
        setAppLockConfig({
          pinHash: hash,
          pinSalt: salt,
          pinIterations: iterations,
        });
        recordSuccessfulAttempt();
        refreshConfig();
        setChangeOpen(false);
        toast.success('PIN berhasil diubah');
        return true;
      } catch {
        setChangeError('Gagal mengubah PIN. Coba lagi.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [changeStep, pendingPin, config, refreshConfig],
  );

  // ── Disable flow ────────────────────────────────────────────────────────
  const openDisable = () => {
    setDisableError('');
    setDisableOpen(true);
  };

  const handleDisableSubmit = useCallback(
    async (pin: string): Promise<boolean> => {
      setBusy(true);
      try {
        const ok = await verifyPin(
          pin,
          config.pinHash!,
          config.pinSalt!,
          config.pinIterations,
        );
        if (!ok) {
          setDisableError('PIN salah');
          return false;
        }
        clearAppLockConfig();
        recordSuccessfulAttempt();
        refreshConfig();
        setDisableOpen(false);
        toast.success('Kunci Aplikasi dimatikan');
        return true;
      } catch {
        setDisableError('Gagal mematikan kunci. Coba lagi.');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [config, refreshConfig],
  );

  // ── Auto-lock timeout change ────────────────────────────────────────────
  const handleAutoLockChange = (value: string) => {
    const ms = Number(value);
    setAppLockConfig({ autoLockTimeout: ms });
    refreshConfig();
    toast.success('Waktu kunci otomatis diperbarui');
  };

  // ── Biometric enroll / unenroll ─────────────────────────────────────────
  const handleEnrollBiometric = async () => {
    setBioEnrolling(true);
    try {
      const credentialId = await registerBiometric();
      if (!credentialId) {
        // User cancelled or browser doesn't support it.
        return;
      }
      setAppLockConfig({ webauthnCredentialId: credentialId });
      refreshConfig();
      toast.success('Sidik jari diaktifkan');
    } catch {
      toast.error('Gagal mengaktifkan sidik jari');
    } finally {
      setBioEnrolling(false);
    }
  };

  const handleUnenrollBiometric = () => {
    setAppLockConfig({ webauthnCredentialId: null });
    refreshConfig();
    toast.success('Sidik jari dimatikan');
  };

  // ── Render ──────────────────────────────────────────────────────────────
  const setupTitle =
    setupStep === 'create' ? 'Buat PIN (6 digit)' : 'Konfirmasi PIN';
  const setupSubtitle =
    setupStep === 'create'
      ? 'Ingat baik-baik PIN ini'
      : 'Masukkan PIN yang sama';

  const changeTitleMap: Record<ChangeStep, string> = {
    'verify-current': 'PIN Saat Ini',
    'enter-new': 'PIN Baru (6 digit)',
    'confirm-new': 'Konfirmasi PIN Baru',
  };
  const changeSubtitleMap: Record<ChangeStep, string> = {
    'verify-current': 'Masukkan PIN aktif untuk verifikasi',
    'enter-new': 'Buat PIN baru',
    'confirm-new': 'Masukkan PIN baru yang sama',
  };

  return (
    <>
      <SectionCard icon={Lock} title="Kunci Aplikasi">
        {/* Status row */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Status</Label>
            <p className="text-xs text-muted-foreground">
              Lindungi aplikasi dengan PIN
            </p>
          </div>
          {isEnabled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Aktif
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
              Tidak Aktif
            </span>
          )}
        </div>

        {!isEnabled ? (
          <>
            <Separator className="my-2" />
            <Button
              onClick={openSetup}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              size="sm"
            >
              <ShieldCheck className="h-4 w-4" />
              Aktifkan Kunci Aplikasi
            </Button>
          </>
        ) : (
          <>
            {/* Auto-lock timeout */}
            <Separator className="my-2" />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Kunci Otomatis</Label>
                <p className="text-xs text-muted-foreground">
                  Kunci aplikasi saat tidak aktif
                </p>
              </div>
              <Select
                value={String(config.autoLockTimeout)}
                onValueChange={handleAutoLockChange}
              >
                <SelectTrigger className="h-9 sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AUTO_LOCK_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Biometric */}
            {bioAvailable ? (
              <>
                <Separator className="my-2" />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Sidik Jari</Label>
                    <p className="text-xs text-muted-foreground">
                      {config.webauthnCredentialId
                        ? 'Aktif — buka kunci dengan sidik jari'
                        : 'Buka kunci dengan sidik jari (WebAuthn)'}
                    </p>
                  </div>
                  {config.webauthnCredentialId ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUnenrollBiometric}
                      className="h-9"
                    >
                      <Fingerprint className="h-4 w-4" />
                      Matikan
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEnrollBiometric}
                      disabled={bioEnrolling}
                      className="h-9"
                    >
                      {bioEnrolling ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Fingerprint className="h-4 w-4" />
                      )}
                      Aktifkan
                    </Button>
                  )}
                </div>
              </>
            ) : null}

            {/* Actions */}
            <Separator className="my-2" />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={openChange} className="h-9">
                <KeyRound className="h-4 w-4" />
                Ubah PIN
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openDisable}
                className="h-9 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              >
                <ShieldOff className="h-4 w-4" />
                Matikan Kunci
              </Button>
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Setup PIN dialog ── */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              {setupStep === 'create' ? 'Buat PIN' : 'Konfirmasi PIN'}
            </DialogTitle>
            <DialogDescription>
              {setupStep === 'create'
                ? 'Buat PIN 6 digit untuk mengunci aplikasi.'
                : 'Masukkan PIN yang sama untuk konfirmasi.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <PinPad
              key={setupStep}
              onSubmit={handleSetupSubmit}
              title={setupTitle}
              subtitle={setupSubtitle}
              error={setupError}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Change PIN dialog ── */}
      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Ubah PIN
            </DialogTitle>
            <DialogDescription>
              {changeStep === 'verify-current'
                ? 'Masukkan PIN aktif untuk verifikasi.'
                : changeStep === 'enter-new'
                  ? 'Buat PIN baru 6 digit.'
                  : 'Masukkan PIN baru yang sama.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <PinPad
              key={changeStep}
              onSubmit={handleChangeSubmit}
              title={changeTitleMap[changeStep]}
              subtitle={changeSubtitleMap[changeStep]}
              error={changeError}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Disable dialog ── */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldOff className="h-4 w-4 text-destructive" />
              Matikan Kunci Aplikasi
            </DialogTitle>
            <DialogDescription>
              Masukkan PIN aktif untuk mematikan kunci. Semua data kunci akan
              dihapus dari perangkat ini.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <PinPad
              key="disable"
              onSubmit={handleDisableSubmit}
              title="Masukkan PIN"
              subtitle="Verifikasi sebelum mematikan"
              error={disableError}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
