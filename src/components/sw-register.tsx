'use client';

import { useEffect, useRef } from 'react';

/**
 * Registrasi Service Worker + mekanisme auto-reload saat versi SW berubah.
 *
 * Gelombang-1 fix: versi cache kini single-source dari public/sw.js —
 * di-fetch (no-store) lalu diparse, BUKAN hardcode 'v12' yang bisa basi.
 * Pola anti-loop: flag `refreshing` + listener 'controllerchange' sekali
 * di module scope; bfcache (pageshow persisted) juga men-trigger reload
 * bila controller masih beda versi.
 */

const FALLBACK_VERSION = 'habit-tracker-v15';

async function readSwCacheVersion(): Promise<string> {
  try {
    const res = await fetch('/sw.js', { cache: 'no-store' });
    if (!res.ok) return FALLBACK_VERSION;
    const text = await res.text();
    const m = /CACHE_(?:NAME|VERSION)\s*=\s*['"]([^'"]+)['"]/.exec(text);
    return m ? m[1] : FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}

let refreshing = false;
if (typeof window !== 'undefined') {
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

export function SWRegister() {
  const onceRef = useRef(false);

  useEffect(() => {
    if (onceRef.current) return;
    onceRef.current = true;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let currentVersion: string | null = null;
    try {
      currentVersion = window.localStorage.getItem('sw-version');
    } catch {
      /* private mode — abaikan */
    }

    (async () => {
      const version = await readSwCacheVersion();
      const reg = await navigator.serviceWorker.register('/sw.js');

      // Cek versi berbasis file sw.js yang baru saja diparse —
      // lebih andal daripada scriptURL (yang tidak berubah antar versi).
      if (currentVersion && currentVersion !== `${reg.active?.scriptURL ?? ''}|${version}`) {
        window.localStorage.setItem('sw-version', `${reg.active?.scriptURL ?? ''}|${version}`);
        window.location.reload();
        return;
      }
      if (!currentVersion) {
        window.localStorage.setItem('sw-version', `${reg.active?.scriptURL ?? ''}|${version}`);
      }

      reg.addEventListener('updatefound', () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener('statechange', () => {
          if (next.state === 'installed' && navigator.serviceWorker.controller) {
            next.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // bfcache: cek ulang saat halaman dikembalikan dari back/forward cache.
      const onPageShow = (e: PageTransitionEvent) => {
        if (!e.persisted) return;
        navigator.serviceWorker.getRegistration?.().then((r) => {
          if (r) r.update().catch(() => {});
        });
      };
      window.addEventListener('pageshow', onPageShow);
    })().catch(() => {
      /* SW gagal — aplikasi tetap jalan normal */
    });
  }, []);

  return null;
}
