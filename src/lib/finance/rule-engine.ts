/**
 * Transaction Rule Engine (PHASE2-FINANCE-1).
 *
 * Auto-categorization rules inspired by Firefly III. When a new transaction
 * is POSTed, `applyRules` walks active rules in priority order (asc), then
 * createdAt order (asc), and returns the FIRST matching rule's action as
 * overrides for `category` and/or `source`. First-match-wins semantics.
 *
 * Matching:
 *   - String fields (description, source): case-insensitive comparison.
 *     `contains` → substring match, `equals` → exact match,
 *     `startsWith` → prefix match.
 *   - Amount field: numeric comparison against `Number(conditionValue)`.
 *     `gt` → amount > value, `lt` → amount < value. Non-numeric
 *     conditionValue never matches (returns false).
 *
 * The caller (POST /api/finance/transactions) decides how to merge the
 * overrides with the user-supplied values. Convention: rule overrides win
 * over user-supplied category/source. (This matches Firefly III: rules
 * are auto-categorization, so they take precedence over the user's pick.)
 */

import { db } from '@/lib/db';
import type { TransactionRule } from '@prisma/client';

/** Inputs the rule engine evaluates against. */
export interface RuleTransactionInput {
  description: string | null | undefined;
  source: string | null | undefined;
  amount: number;
}

/** Overrides returned by the rule engine. Empty object = no rule matched. */
export interface RuleOverrides {
  category?: string;
  source?: string;
}

/**
 * Fetch active rules ordered by priority (asc) then createdAt (asc).
 * Cached for the lifetime of the request only — callers should NOT cache
 * across requests because rules can be edited at any time.
 */
export async function fetchActiveRules(): Promise<TransactionRule[]> {
  try {
    return await db.transactionRule.findMany({
      where: { isActive: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  } catch (e) {
    // If the rule table doesn't exist (e.g. during early deploy before
    // sync-turso runs), fail gracefully — rules are an enhancement, not
    // a hard requirement for transaction creation.
    console.error('fetchActiveRules failed (rules will be skipped):', e);
    return [];
  }
}

/**
 * Evaluate a single rule against a transaction. Returns true if the rule
 * matches (i.e. its action should be applied).
 */
export function matchesRule(
  rule: Pick<
    TransactionRule,
    'conditionField' | 'conditionOp' | 'conditionValue'
  >,
  tx: RuleTransactionInput
): boolean {
  const { conditionField, conditionOp, conditionValue } = rule;

  if (conditionField === 'amount') {
    const threshold = Number(conditionValue);
    if (!Number.isFinite(threshold)) return false;
    if (conditionOp === 'gt') return tx.amount > threshold;
    if (conditionOp === 'lt') return tx.amount < threshold;
    // 'contains'/'equals'/'startsWith' on amount = numeric equality after
    // parsing. 'equals' → strict equality. Others → no-op (return false).
    if (conditionOp === 'equals') return tx.amount === threshold;
    return false;
  }

  // String fields: description or source
  const raw =
    conditionField === 'source'
      ? (tx.source ?? '')
      : conditionField === 'description'
        ? (tx.description ?? '')
        : '';
  const haystack = String(raw).toLowerCase();
  const needle = String(conditionValue).toLowerCase();

  if (conditionOp === 'contains') return haystack.includes(needle);
  if (conditionOp === 'equals') return haystack === needle;
  if (conditionOp === 'startsWith') return haystack.startsWith(needle);
  // 'gt'/'lt' on a string field makes no sense — never match.
  return false;
}

/**
 * Walk active rules in priority order and return the FIRST match's action.
 * Returns an empty object if no rule matches.
 */
export function applyRulesFromList(
  rules: TransactionRule[],
  tx: RuleTransactionInput
): RuleOverrides {
  for (const rule of rules) {
    if (!rule.isActive) continue;
    if (!matchesRule(rule, tx)) continue;
    // First match wins.
    if (rule.actionField === 'category') return { category: rule.actionValue };
    if (rule.actionField === 'source') return { source: rule.actionValue };
    return {};
  }
  return {};
}

/**
 * Convenience: fetch rules + apply. Use this when you don't already have
 * the rules list cached.
 */
export async function applyRules(
  tx: RuleTransactionInput
): Promise<RuleOverrides> {
  const rules = await fetchActiveRules();
  return applyRulesFromList(rules, tx);
}
