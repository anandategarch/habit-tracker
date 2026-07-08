'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">Something went wrong</h2>
          <p className="text-muted-foreground text-sm">
            An unexpected error occurred. Please try again.
          </p>
          {error.message && (
            <p className="text-xs text-muted-foreground/70 font-mono bg-muted/50 rounded-md p-3 text-left break-all">
              {error.message}
            </p>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} variant="default" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
          <Button onClick={() => window.location.href = '/'} variant="outline">
            Reload Page
          </Button>
        </div>
      </div>
    </div>
  );
}