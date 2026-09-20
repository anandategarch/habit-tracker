'use client';

// components/tree/pohon-wisdom.tsx — ⑦ KEBIJAKSAANAN POHON tab Pohon.
//
// Diekstraksi dari pohon-screen.tsx saat SPLIT god-file (Task 71-g) —
// JSX identik. Kutipan pertumbuhan deterministik per hari (todayWisdom,
// dihitung di akar komposisi supaya memo-nya sekali per mount).

import { Quote } from 'lucide-react';

export interface PohonWisdomProps {
  wisdom: string;
}

export function PohonWisdom({ wisdom }: PohonWisdomProps) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-[#E7B64B]/25 p-4 sm:p-5"
      style={{ background: 'linear-gradient(135deg,#101408,#0D0F07)' }}
      aria-label="Kebijaksanaan pohon hari ini"
    >
      <Quote className="h-5 w-5 text-[#EDBC3F]/80" aria-hidden="true" />
      <p className="font-display mt-2 text-[15px] font-medium leading-relaxed text-[#F4E9C8]">
        “{wisdom}”
      </p>
      <p className="mt-2 text-[11px] font-medium text-[#EDBC3F]/70">
        Kebijaksanaan Pohon · berganti tiap hari
      </p>
    </section>
  );
}
