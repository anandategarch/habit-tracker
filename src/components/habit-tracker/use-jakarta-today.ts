// components/habit-tracker/use-jakarta-today.ts — "hari ini" yang HIDUP.
//
// Task 60-e (audit 59-b2 LOW): komponen (tracker, Beranda, Progres) menghitung
// todayStr SEKALI per render — tab PWA yang dibiarkan terbuka melewati
// tengah malam Jakarta memakai "hari ini" basi: guard tanggal future salah
// memblokir hari baru, label "Hari Ini" meleset, query ['work', todayStr]
// tidak pernah berganti. Hook ini men-tick tiap 30 detik dan hanya memicu
// re-render saat YMD Jakarta benar-benar berubah (string sama → setState
// dibungkam; tanpa re-render berlebihan).
'use client';

import { useEffect, useState } from 'react';
import { jakartaDateString } from '@/lib/timezone';

export function useJakartaToday(): string {
  const [today, setToday] = useState(() => jakartaDateString());

  useEffect(() => {
    const id = setInterval(() => {
      const now = jakartaDateString();
      setToday((prev) => (prev === now ? prev : now));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return today;
}
