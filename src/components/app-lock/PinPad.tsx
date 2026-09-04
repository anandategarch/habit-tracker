'use client';

// PinPad — reusable 6-digit numeric PIN entry pad.
//
// Design goals:
//  - Self-contained: renders lock icon + title + dots + error + numeric keypad.
//  - Container-agnostic: parent decides whether to wrap in a full-screen
//    overlay (AppLockGate) or a shadcn Dialog (settings PIN setup).
//  - Touch-friendly: every keypad button is min-h-[56px] per the spec.
//  - Auto-submits when `pin.length === length` — parent receives the PIN via
//    `onSubmit` and returns `true` (accepted) or `false` (rejected).
//  - On rejection, the dots shake (CSS keyframe `anim-shake` in globals.css)
//    and the entered PIN is cleared so the user can retry.
//  - Optional `lockedUntil` timestamp shows a mm:ss countdown and disables
//    input until the lockout window passes.
//
// The component is uncontrolled (owns its own `pin` string state) so the
// parent only needs to listen for `onSubmit`. To reset the pad externally
// (e.g. when switching dialog steps), the parent can remount it via `key`.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Delete, Lock, Loader2 } from 'lucide-react';

export interface PinPadProps {
  /** Called when the entered PIN reaches `length`. Returns true if accepted. */
  onSubmit: (pin: string) => Promise<boolean>;
  /** PIN length, default 6. */
  length?: number;
  /** Optional title above the dots (e.g. "Masukkan PIN"). */
  title?: string;
  /** Optional subtitle below the title. */
  subtitle?: string;
  /** Error message to display. Hidden while the user is typing. */
  error?: string;
  /** Epoch ms timestamp — if in the future, shows countdown + disables input. */
  lockedUntil?: number;
  /** Optional className for the root container. */
  className?: string;
}

export function PinPad({
  onSubmit,
  length = 6,
  title,
  subtitle,
  error,
  lockedUntil,
  className,
}: PinPadProps) {
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [shake, setShake] = useState(false);
  const [now, setNow] = useState(Date.now());
  // Guards against re-triggering onSubmit for the same completed PIN while
  // the parent's promise is still pending (React 18 StrictMode double-invokes
  // effects in dev, and we don't want to verify the same PIN twice).
  const submittingRef = useRef(false);

  // ── Countdown tick ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!lockedUntil) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  // ── Auto-submit when PIN reaches length ─────────────────────────────────
  useEffect(() => {
    if (pin.length !== length) return;
    if (verifying || submittingRef.current) return;
    submittingRef.current = true;
    setVerifying(true);
    onSubmit(pin)
      .then((ok) => {
        if (!ok) {
          setShake(true);
          window.setTimeout(() => setShake(false), 500);
        }
      })
      .finally(() => {
        setVerifying(false);
        setPin('');
        submittingRef.current = false;
      });
  }, [pin, length, verifying, onSubmit]);

  const isLocked = lockedUntil ? now < lockedUntil : false;

  const handleDigit = useCallback(
    (d: string) => {
      if (verifying || isLocked) return;
      setPin((prev) => (prev.length < length ? prev + d : prev));
    },
    [verifying, isLocked, length],
  );

  const handleDelete = useCallback(() => {
    if (verifying) return;
    setPin((prev) => prev.slice(0, -1));
  }, [verifying]);

  // Hide the error message as soon as the user starts typing again.
  const showError = pin.length === 0 && !verifying && !!error;

  // Countdown formatting (mm:ss)
  const remainingMs = lockedUntil ? Math.max(0, lockedUntil - now) : 0;
  const mins = Math.floor(remainingMs / 60_000);
  const secs = Math.floor((remainingMs % 60_000) / 1000);
  const countdown = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className={cn('flex w-full max-w-[300px] flex-col items-center', className)}>
      {/* Lock icon + title */}
      <div className="mb-4 flex flex-col items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          {verifying ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <Lock className="h-5 w-5 text-primary" />
          )}
        </div>
        {title && <h2 className="text-lg font-semibold leading-tight">{title}</h2>}
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      {/* PIN dots */}
      <div className={cn('mb-4 flex gap-3', shake && 'anim-shake')} aria-live="polite">
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-3 w-3 rounded-full border-2 transition-all duration-150',
              i < pin.length
                ? 'scale-110 border-primary bg-primary'
                : 'border-muted-foreground/30 bg-transparent',
            )}
          />
        ))}
      </div>

      {/* Error / countdown / spacer (fixed height to prevent layout shift) */}
      <div className="mb-3 flex h-6 items-center justify-center">
        {isLocked ? (
          <p className="text-sm font-semibold tabular-nums text-destructive">{countdown}</p>
        ) : showError ? (
          <p className="text-sm font-medium text-destructive">{error}</p>
        ) : null}
      </div>

      {/* Keypad */}
      <div className="grid w-full grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <KeypadButton
            key={d}
            onClick={() => handleDigit(d)}
            disabled={verifying || isLocked}
            aria-label={`Digit ${d}`}
          >
            <span className="text-2xl font-medium">{d}</span>
          </KeypadButton>
        ))}
        {/* Bottom row: empty | 0 | delete */}
        <div aria-hidden />
        <KeypadButton
          onClick={() => handleDigit('0')}
          disabled={verifying || isLocked}
          aria-label="Digit 0"
        >
          <span className="text-2xl font-medium">0</span>
        </KeypadButton>
        <KeypadButton
          onClick={handleDelete}
          disabled={verifying || pin.length === 0}
          variant="ghost"
          aria-label="Hapus digit"
        >
          <Delete className="h-5 w-5" />
        </KeypadButton>
      </div>
    </div>
  );
}

// ── Internal keypad button ──────────────────────────────────────────────
interface KeypadButtonProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'ghost';
  'aria-label'?: string;
}

function KeypadButton({ children, onClick, disabled, variant = 'default', ...rest }: KeypadButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'anim-press flex min-h-[56px] items-center justify-center rounded-2xl border text-foreground transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'default'
          ? 'border-border bg-muted/40 hover:bg-muted active:bg-muted/80'
          : 'border-transparent bg-transparent hover:bg-muted/60',
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
