'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calculator as CalcIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────

interface HistoryEntry {
  expression: string;
  result: string;
  // Raw numeric string of the result (e.g. "33.33", "1500000").
  // BUG-2 fix: used by loadHistoryEntry to restore the expression without
  // relying on locale-formatted `result` (which uses comma decimals in id-ID
  // and breaks evaluate()).
  resultValue: string;
  timestamp: number;
}

// ── Calculator Logic ────────────────────────────────────────────────────

/**
 * Evaluate a math expression string safely.
 * Only allows: digits, +, -, *, /, ., (, ), and % (converted to /100).
 * Uses Function constructor (not eval) for slightly better isolation.
 * Returns null on any error (invalid expression).
 */
function evaluate(expr: string): number | null {
  try {
    // Replace − (minus sign) with - for JS
    let sanitized = expr.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/');

    // BUG-4 fix: handle "A + B%" and "A - B%" per calculator convention —
    // B% means "B percent of A", so "100 + 10%" = 110, "100 - 10%" = 90.
    // Must run BEFORE the standalone N% replacement below so that the
    // A±B% pattern is matched as a unit (the standalone regex would
    // otherwise turn "10%" into "(10/100)" and yield 100.1 / 99.9).
    // Multiplication ("150000 * 11%") is intentionally NOT matched here —
    // it falls through to the standalone N% rule below, giving 16500.
    sanitized = sanitized.replace(/(\d+(?:\.\d+)?)\s*([+\-])\s*(\d+(?:\.\d+)?)\s*%/g, '$1 $2 ($1 * $3 / 100)');

    // Handle standalone N% (and N% in multiplication): convert "N%" to "(N/100)"
    sanitized = sanitized.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)');

    // Validate: only allow digits, operators, parentheses, decimals, spaces
    if (!/^[\d+\-*/.()\s]+$/.test(sanitized)) return null;
    if (!sanitized.trim()) return null;

    const result = Function(`"use strict"; return (${sanitized});`)();

    if (typeof result !== 'number' || !isFinite(result)) return null;

    return result;
  } catch {
    return null;
  }
}

/** Format number for display: whole numbers without decimals, else 2 decimal places */
function formatResult(n: number): string {
  if (Number.isInteger(n)) {
    return n.toLocaleString('id-ID');
  }
  return n.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ── History (localStorage) ──────────────────────────────────────────────

const HISTORY_KEY = 'calc-history';
const MAX_HISTORY = 5;

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    // localStorage might be full or disabled — silently ignore
  }
}

// ── Component ───────────────────────────────────────────────────────────

interface CalculatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // BUG-3 fix: optional callback invoked when the user clicks "Apply ke Jumlah".
  // Receives the raw numeric result string (e.g. "33.33", "1500000").
  // When omitted, the Apply button is hidden (calculator used standalone).
  onApply?: (value: string) => void;
}

export function CalculatorDialog({ open, onOpenChange, onApply }: CalculatorDialogProps) {
  const [expression, setExpression] = useState('');
  const [justCalculated, setJustCalculated] = useState(false);
  // Lazy-init from localStorage (avoids set-state-in-effect on mount)
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());

  // No reset-on-open useEffect needed — DialogContent uses key={open}
  // to remount fresh each time the dialog opens, resetting all state.

  // Compute result preview from expression (derived state, not effect)
  const result = useMemo(() => {
    if (!expression) return '0';
    const evaluated = evaluate(expression);
    if (evaluated !== null) return formatResult(evaluated);
    return '0';
  }, [expression]);

  // BUG-3: raw numeric result string for the Apply button. Empty when the
  // expression is empty or invalid (so the Apply button can be disabled).
  const resultValue = useMemo(() => {
    if (!expression) return '';
    const evaluated = evaluate(expression);
    return evaluated !== null ? String(evaluated) : '';
  }, [expression]);

  const appendToExpression = useCallback((char: string) => {
    setJustCalculated(false);
    setExpression((prev) => {
      // If just calculated and user types a digit, start fresh
      if (justCalculated) {
        // BUG-13 fix: "00" after "=" would start the expression with "00"
        // (invalid leading zeros). Normalize to "0".
        if (char === '00') return '0';
        // BUG-14 fix: leading "." after "=" creates an un-evaluable
        // expression like ".5". Normalize to "0.".
        if (char === '.') return '0.';
        if (/[\d]/.test(char)) return char;
        // For operators after "=", continue calculating with the result
        // (fall through to the default append logic below).
      }
      // Prevent leading operator (except minus)
      if (prev === '' && ['+', '×', '÷'].includes(char)) return prev;
      // BUG-14 fix: leading "." when the expression is empty creates an
      // un-evaluable expression. Normalize to "0.".
      if (prev === '' && char === '.') return '0.';
      // Prevent double operators — replace last operator
      const lastChar = prev.slice(-1);
      if (['+', '−', '×', '÷'].includes(lastChar) && ['+', '−', '×', '÷'].includes(char)) {
        return prev.slice(0, -1) + char;
      }
      return prev + char;
    });
  }, [justCalculated]);

  const handleEquals = useCallback(() => {
    if (!expression) return;
    const evaluated = evaluate(expression);
    if (evaluated === null) return;

    const formattedResult = formatResult(evaluated);

    // Save to history
    const entry: HistoryEntry = {
      expression,
      result: formattedResult,
      // BUG-2 fix: store the raw numeric string so loadHistoryEntry can
      // restore the expression without locale-format parsing issues.
      resultValue: String(evaluated),
      timestamp: Date.now(),
    };
    const newHistory = [entry, ...history].slice(0, MAX_HISTORY);
    setHistory(newHistory);
    saveHistory(newHistory);

    // Set result as new expression (so user can continue calculating)
    setExpression(String(evaluated));
    setJustCalculated(true);
  }, [expression, history]);

  const handleClear = useCallback(() => {
    setExpression('');
    setJustCalculated(false);
  }, []);

  const handleBackspace = useCallback(() => {
    setJustCalculated(false);
    setExpression((prev) => prev.slice(0, -1));
  }, []);

  const handlePercent = useCallback(() => {
    setJustCalculated(false);
    setExpression((prev) => prev + '%');
  }, []);

  const loadHistoryEntry = useCallback((entry: HistoryEntry) => {
    // BUG-2 fix: use the raw resultValue (e.g. "33.33") instead of stripping
    // dots from the locale-formatted result. The old approach broke on
    // decimal results because id-ID uses comma decimals ("33,33") and
    // evaluate() cannot parse commas. Fall back to the old dot-strip for
    // history entries persisted before this fix (which lack resultValue).
    const cleanResult = entry.resultValue || entry.result.replace(/\./g, '');
    setExpression(cleanResult);
    setJustCalculated(true);
  }, []);

  // BUG-10: keyboard input support. Only active while the dialog is open.
  // Lets users type expressions directly with the physical keyboard.
  // Declared after the callbacks it depends on to avoid the temporal dead
  // zone (const declarations are not hoisted).
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key combos with modifier keys (Ctrl+C copy, Cmd+R reload, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key;
      if (key >= '0' && key <= '9') {
        e.preventDefault();
        appendToExpression(key);
      } else if (key === '+') {
        e.preventDefault();
        appendToExpression('+');
      } else if (key === '-') {
        e.preventDefault();
        appendToExpression('−');
      } else if (key === '*') {
        e.preventDefault();
        appendToExpression('×');
      } else if (key === '/') {
        e.preventDefault();
        appendToExpression('÷');
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (key === '%') {
        e.preventDefault();
        handlePercent();
      } else if (key === '.') {
        e.preventDefault();
        appendToExpression('.');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, appendToExpression, handleEquals, handleBackspace, handlePercent, onOpenChange]);

  // ── Button layout ────────────────────────────────────────────────────

  const buttons = [
    { label: 'C', onClick: handleClear, className: 'bg-red-500/10 text-red-500 hover:bg-red-500/20' },
    { label: '⌫', onClick: handleBackspace, className: 'bg-muted/50 hover:bg-muted' },
    { label: '%', onClick: handlePercent, className: 'bg-muted/50 hover:bg-muted' },
    { label: '÷', onClick: () => appendToExpression('÷'), className: 'bg-primary/10 text-primary hover:bg-primary/20' },
    { label: '7', onClick: () => appendToExpression('7'), className: 'bg-card hover:bg-muted/50' },
    { label: '8', onClick: () => appendToExpression('8'), className: 'bg-card hover:bg-muted/50' },
    { label: '9', onClick: () => appendToExpression('9'), className: 'bg-card hover:bg-muted/50' },
    { label: '×', onClick: () => appendToExpression('×'), className: 'bg-primary/10 text-primary hover:bg-primary/20' },
    { label: '4', onClick: () => appendToExpression('4'), className: 'bg-card hover:bg-muted/50' },
    { label: '5', onClick: () => appendToExpression('5'), className: 'bg-card hover:bg-muted/50' },
    { label: '6', onClick: () => appendToExpression('6'), className: 'bg-card hover:bg-muted/50' },
    { label: '−', onClick: () => appendToExpression('−'), className: 'bg-primary/10 text-primary hover:bg-primary/20' },
    { label: '1', onClick: () => appendToExpression('1'), className: 'bg-card hover:bg-muted/50' },
    { label: '2', onClick: () => appendToExpression('2'), className: 'bg-card hover:bg-muted/50' },
    { label: '3', onClick: () => appendToExpression('3'), className: 'bg-card hover:bg-muted/50' },
    { label: '+', onClick: () => appendToExpression('+'), className: 'bg-primary/10 text-primary hover:bg-primary/20' },
    { label: '00', onClick: () => appendToExpression('00'), className: 'bg-card hover:bg-muted/50' },
    { label: '0', onClick: () => appendToExpression('0'), className: 'bg-card hover:bg-muted/50' },
    { label: '.', onClick: () => appendToExpression('.'), className: 'bg-card hover:bg-muted/50' },
    { label: '=', onClick: handleEquals, className: 'bg-primary text-primary-foreground hover:bg-primary/90 font-bold' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={open ? 'open' : 'closed'} className="max-w-xs p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <CalcIcon className="h-4 w-4" />
            Kalkulator
          </DialogTitle>
        </DialogHeader>

        {/* Display */}
        <div className="px-4 py-3 bg-muted/20 text-right">
          {/* Expression (small, muted) */}
          <p className="text-xs text-muted-foreground truncate min-h-[16px]">
            {expression || '\u00A0'}
          </p>
          {/* Result (large, bold) */}
          <p className="text-2xl font-bold tabular-nums truncate">
            {result}
          </p>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="px-4 py-1.5 border-b border-border max-h-24 overflow-y-auto custom-scrollbar">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">History</p>
            {history.map((entry) => (
              <button
                key={entry.timestamp}
                type="button"
                onClick={() => loadHistoryEntry(entry)}
                className="block w-full text-right text-[11px] py-0.5 hover:bg-muted/40 rounded px-1 -mx-1 transition-colors"
              >
                <span className="text-muted-foreground">{entry.expression} = </span>
                <span className="font-semibold text-foreground">{entry.result}</span>
              </button>
            ))}
          </div>
        )}

        {/* Numpad */}
        <div className="p-3 grid grid-cols-4 gap-1.5">
          {buttons.map((btn, i) => (
            <button
              key={i}
              type="button"
              onClick={btn.onClick}
              className={cn(
                'h-11 rounded-lg text-base font-medium transition-colors active:scale-95',
                btn.className
              )}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* BUG-3: Apply button — wires the calculator result to the amount
            field in the transaction form. Only rendered when onApply is
            provided (i.e. when the calculator is opened from finance.tsx). */}
        {onApply && (
          <div className="px-3 pb-3">
            <button
              type="button"
              disabled={!resultValue}
              onClick={() => {
                if (resultValue) {
                  onApply(resultValue);
                  onOpenChange(false);
                }
              }}
              className="w-full h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-sm transition-colors active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              Apply ke Jumlah
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── FAB Trigger Button ──────────────────────────────────────────────────

/**
 * Small calculator button to be placed next to the Amount field
 * in the transaction form. Opens the CalculatorDialog.
 */
export function CalculatorButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
      aria-label="Buka kalkulator"
      title="Kalkulator"
    >
      <CalcIcon className="h-4 w-4" />
    </button>
  );
}
