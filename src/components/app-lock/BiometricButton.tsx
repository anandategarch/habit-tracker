'use client';

// BiometricButton — large fingerprint button shown on the lock screen.
//
// Triggers `onAuthenticate` on click. While authenticating, shows a spinner
// instead of the fingerprint icon and disables interaction. The parent owns
// all error handling — if biometric fails, the user simply falls through to
// the PIN pad (no error message shown, since cancelling biometric is normal).

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Fingerprint, Loader2 } from 'lucide-react';

export interface BiometricButtonProps {
  /** Called when the user taps the button. Returns true on success. */
  onAuthenticate: () => Promise<boolean>;
  /** Disable interaction (e.g. while PIN is being verified). */
  disabled?: boolean;
  /** Optional className for the root button. */
  className?: string;
}

export function BiometricButton({ onAuthenticate, disabled, className }: BiometricButtonProps) {
  const [authenticating, setAuthenticating] = useState(false);

  const handleClick = async () => {
    if (disabled || authenticating) return;
    setAuthenticating(true);
    try {
      await onAuthenticate();
    } finally {
      setAuthenticating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || authenticating}
      className={cn(
        'anim-press group flex flex-col items-center gap-2 rounded-2xl px-6 py-4',
        'transition-all focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      aria-label="Gunakan Sidik Jari"
    >
      <span
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full',
          'bg-primary/10 text-primary transition-colors',
          'group-hover:bg-primary/20 group-active:bg-primary/25',
        )}
      >
        {authenticating ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Fingerprint className="h-6 w-6" />
        )}
      </span>
      <span className="text-sm font-medium text-muted-foreground">
        {authenticating ? 'Memverifikasi...' : 'Gunakan Sidik Jari'}
      </span>
    </button>
  );
}
