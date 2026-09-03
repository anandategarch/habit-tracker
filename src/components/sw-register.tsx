'use client';
import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // Register SW on page load
    const register = () =>
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('SW:', reg.scope))
        .catch((e) => console.warn('SW:', e));

    window.addEventListener('load', register);

    // Auto-reload when a new SW takes control (after cache purge).
    // Without this, user sees stale cached JS chunks until manual reload.
    // The `refreshing` flag prevents infinite reload loop.
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      window.removeEventListener('load', register);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);
  return null;
}
