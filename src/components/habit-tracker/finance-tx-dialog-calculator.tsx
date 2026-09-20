'use client';

// components/habit-tracker/finance-tx-dialog-calculator.tsx — kalkulator
// nominal kecil (diekstrak verbatim dari finance-tx-dialog.tsx, Task 71-i).
//
// - Prefill saat dialog DIBUKA lewat pola "adjust state during render"
//   (pola prevOpen — React docs: You Might Not Need an Effect), BUKAN
//   useEffect supaya lolos react-hooks/set-state-in-effect.
// - Task 31: dukung × dan ÷ dengan urutan operasi benar; operator
//   berturut-turut menggantikan yang lama; ÷0 = invalid.
// - Tombol kurang memakai ASCII '-' agar token regex evaluate cocok.

import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function CalculatorDialog({
  open,
  onOpenChange,
  initialValue,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: number;
  onApply: (result: number) => void;
}) {
  const [display, setDisplay] = useState('');

  // Task 31 (bug temuan uji): prefill saat dialog DIBUKA. Dulu lewat
  // handleOpenChange(next=true) — hanya jalan saat Radix yang membuka; tombol
  // "Kalkulator" memanggil setCalcOpen(true) langsung → display lama menumpuk
  // dengan ketikan baru saat dibuka ulang. Pola "adjust state during render"
  // (React docs: You Might Not Need an Effect) — BUKAN useEffect supaya lolos
  // react-hooks/set-state-in-effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDisplay(initialValue > 0 ? String(initialValue) : '');
  }

  const press = (key: string) => {
    if (key === 'C') {
      setDisplay('');
      return;
    }
    if (key === '⌫') {
      setDisplay(prev => prev.slice(0, -1));
      return;
    }
    setDisplay(prev => {
      // Task 31: operator berturut-turut → operator baru MENGGANTI yang lama
      // (mis. "5+" lalu tekan × → "5×"), bukan menumpuk jadi ekspresi rusak.
      const isOp = (ch: string) => ['+', '-', '×', '÷'].includes(ch);
      if (isOp(key)) {
        if (prev.length === 0) return prev; // tidak boleh diawali operator
        if (isOp(prev[prev.length - 1])) return (prev.slice(0, -1) + key).slice(0, 24);
      }
      return (prev + key).slice(0, 24);
    });
  };

  // Task 31 (permintaan user): dukung × dan ÷ dengan URUTAN OPERASI benar
  // (× ÷ dikerjakan sebelum + −, seperti kalkulator pada umumnya).
  const evaluate = (): number | null => {
    const tokens = display.match(/(\d+(\.\d+)?|[+\-×÷])/g);
    if (!tokens || tokens.length === 0) return null;
    const first = Number(tokens[0]);
    if (!Number.isFinite(first)) return null;

    // Pass 1: lipat × dan ÷ ke angka di kirinya (precedence tinggi).
    const folded: Array<number | string> = [first];
    for (let i = 1; i + 1 < tokens.length + 1; i += 2) {
      const op = tokens[i];
      const num = Number(tokens[i + 1]);
      if (op === undefined || num === undefined || !Number.isFinite(num)) return null;
      if (op === '×') {
        const prevNum = folded[folded.length - 1];
        if (typeof prevNum !== 'number') return null;
        folded[folded.length - 1] = prevNum * num;
      } else if (op === '÷') {
        const prevNum = folded[folded.length - 1];
        if (typeof prevNum !== 'number' || num === 0) return null; // ÷0 = invalid
        folded[folded.length - 1] = prevNum / num;
      } else if (op === '+' || op === '-') {
        folded.push(op, num);
      } else {
        return null;
      }
    }

    // Pass 2: lipat + dan −.
    let acc = folded[0];
    if (typeof acc !== 'number') return null;
    for (let j = 1; j < folded.length; j += 2) {
      const op = folded[j];
      const num = folded[j + 1];
      if (typeof op !== 'string' || typeof num !== 'number') return null;
      if (op === '+') acc += num;
      else if (op === '-') acc -= num;
      else return null;
    }
    if (!Number.isFinite(acc)) return null;
    return Math.max(0, Math.round(acc));
  };

  const apply = () => {
    const result = evaluate();
    if (result === null) return;
    onApply(result);
    onOpenChange(false);
  };

  // Task 31: layout kalkulator standar 4 kolom — kini ada × dan ÷.
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '⌫', 'C', '+'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <span className="chip-icon chip-teal h-6 w-6" aria-hidden="true">
              <Calculator className="h-3 w-3" />
            </span>
            Kalkulator Nominal
          </DialogTitle>
          <DialogDescription>Hitung (tambah, kurang, kali, bagi), lalu terapkan ke kolom jumlah.</DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-right text-lg font-bold tabular-nums truncate">
          {display || '0'}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {keys.map(k => (
            <Button
              key={k}
              variant="outline"
              className={cn('h-10', ['÷', '×', '+', '-'].includes(k) && 'text-primary font-bold')}
              onClick={() => press(k)}
              aria-label={
                k === '⌫' ? 'Hapus satu digit'
                  : k === 'C' ? 'Bersihkan'
                    : k === '÷' ? 'Bagi'
                      : k === '×' ? 'Kali'
                        : k === '+' ? 'Tambah'
                          : k === '-' ? 'Kurang'
                            : k
              }
            >
              {k}
            </Button>
          ))}
          <Button className="h-10 btn-primary-gradient col-span-4" onClick={apply} disabled={!display} aria-label="Terapkan hasil">
            =
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
