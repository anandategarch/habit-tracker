'use client';
import { useEffect } from 'react';
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const r = () => navigator.serviceWorker.register('/sw.js').then(r => console.log('SW:', r.scope)).catch(e => console.warn('SW:', e));
    window.addEventListener('load', r);
    return () => window.removeEventListener('load', r);
  }, []);
  return null;
}
