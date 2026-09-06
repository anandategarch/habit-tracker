// ---------------------------------------------------------------------------
// Helpers for finance-rules.tsx
// Extracted from finance-rules.tsx during SPLIT-PHASE-B-3.
//
// Pure module: NO React, NO JSX, NO hooks. Contains the types, label
// constants, and form-state utilities used by both the FinanceRules parent
// component (list render + handlers) and the RuleFormDialog sibling.
//
// Concept from Firefly III: "if description contains X → set category to Y".
// Rules execute on POST /api/finance/transactions BEFORE the transaction is
// created — first-match-wins (priority asc, then createdAt asc). See
// lib/finance/rule-engine.ts for the matching logic.
// ---------------------------------------------------------------------------

// ── Types ─────────────────────────────────────────────────────────────────

export interface TransactionRule {
  id: string;
  name: string;
  isActive: boolean;
  priority: number;
  conditionField: string;
  conditionOp: string;
  conditionValue: string;
  actionField: string;
  actionValue: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryOption {
  value: string;
  emoji: string;
  color: string;
}

export interface SourceOption {
  id: string;
  name: string;
  emoji: string;
}

// ── Labels ───────────────────────────────────────────────────────────────

export const FIELD_LABELS: Record<string, string> = {
  description: 'Deskripsi',
  source: 'Sumber',
  amount: 'Jumlah',
};

export const OP_LABELS: Record<string, string> = {
  contains: 'mengandung',
  equals: 'sama dengan',
  startsWith: 'diawali',
  gt: 'lebih dari',
  lt: 'kurang dari',
};

export const ACTION_FIELD_LABELS: Record<string, string> = {
  category: 'Kategori',
  source: 'Sumber',
};

// ── Form state ───────────────────────────────────────────────────────────

export interface RuleFormState {
  name: string;
  isActive: boolean;
  priority: string;
  conditionField: 'description' | 'source' | 'amount';
  conditionOp: 'contains' | 'equals' | 'startsWith' | 'gt' | 'lt';
  conditionValue: string;
  actionField: 'category' | 'source';
  actionValue: string;
}

export function emptyForm(): RuleFormState {
  return {
    name: '',
    isActive: true,
    priority: '0',
    conditionField: 'description',
    conditionOp: 'contains',
    conditionValue: '',
    actionField: 'category',
    actionValue: '',
  };
}

export function formFromRule(r: TransactionRule): RuleFormState {
  return {
    name: r.name,
    isActive: r.isActive,
    priority: String(r.priority ?? 0),
    conditionField: r.conditionField as RuleFormState['conditionField'],
    conditionOp: r.conditionOp as RuleFormState['conditionOp'],
    conditionValue: r.conditionValue,
    actionField: r.actionField as RuleFormState['actionField'],
    actionValue: r.actionValue,
  };
}

export function formToPayload(form: RuleFormState) {
  return {
    name: form.name.trim(),
    isActive: form.isActive,
    priority: parseInt(form.priority || '0', 10) || 0,
    conditionField: form.conditionField,
    conditionOp: form.conditionOp,
    conditionValue: form.conditionValue.trim(),
    actionField: form.actionField,
    actionValue: form.actionValue,
  };
}

/** Compute the list of valid operators for a given condition field. */
export function opsForField(field: string): Array<{ value: string; label: string }> {
  if (field === 'amount') {
    return [
      { value: 'gt', label: 'lebih dari' },
      { value: 'lt', label: 'kurang dari' },
      { value: 'equals', label: 'sama dengan' },
    ];
  }
  return [
    { value: 'contains', label: 'mengandung' },
    { value: 'equals', label: 'sama dengan' },
    { value: 'startsWith', label: 'diawali' },
  ];
}
