'use client';

// app/error.tsx — TASK 60-a #1 (temuan 59-b1 MAJOR): error boundary ROOT.
// Sebelumnya: 8 tab dimuat via dynamic(..., { ssr:false }) di page.tsx TANPA
// error boundary apa pun (grep: 0 error.tsx/ErrorBoundary di seluruh src) →
// satu error render / ChunkLoadError (mis. pasca-redeploy: chunk lama tak
// ter-cache oleh SW, atau PWA offline memuat chunk yang belum diprecache)
// menjatuhkan SELURUH aplikasi ke error page default Next.js tanpa tombol
// retry — pengguna terpaksa reload manual.
//
// Boundary ini membungkus page.tsx DI DALAM layout root (layout tetap
// ter-render: tema/font/Toaster tetap hidup). next/navigation tidak
// dipakai — API App Router: props { error, reset }.
//   • "Coba Lagi"  → reset() — remount segmen page; dynamic() akan memuat
//     ulang chunk yang gagal (menutup kasus ChunkLoadError transient).
//   • "Muat Ulang Aplikasi" → location.reload() — untuk chunk STALE pasca
//     redeploy (hash chunk lama sudah tidak ada di server; reset() saja
//     akan meminta chunk yang sama dan gagal lagi).
// Catatan: global-error.tsx SENGAJA tidak dibuat — layout root tidak
// bermasalah, dan membuatnya akan mengganti <html>/<body> (butuh markup
// lengkap sendiri) tanpa manfaat tambahan untuk temuan ini.

import { useEffect } from 'react';
import { TreePine } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Konsol-log penuh untuk debugging (digest = id error server-side Next).
  useEffect(() => {
    console.error('[Rutina] Error render terperangkap error boundary root:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div
        role="alert"
        className="rounded-2xl border bg-card p-6 text-card-foreground shadow-sm max-w-sm text-center"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"
        >
          <TreePine className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold tracking-tight">Ada kendala memuat Rutina</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Sepertinya ada bagian aplikasi yang gagal dimuat. Coba lagi — pohonmu
          tetap menunggu disiram.
        </p>
        {error?.digest && (
          <p className="mt-2 text-[11px] text-muted-foreground/70">
            Kode kendala: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={() => reset()}>Coba Lagi</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Muat Ulang Aplikasi
          </Button>
        </div>
      </div>
    </div>
  );
}
