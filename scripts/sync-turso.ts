/**
 * ───────────────────────────────────────────────────────────────────────
 * Turso Schema Sync Script
 * ───────────────────────────────────────────────────────────────────────
 *
 * Syncs prisma/schema.prisma to the Turso production database by adding
 * missing tables and columns. This is needed because Prisma's `sqlite`
 * provider cannot connect to Turso's libsql URL directly (db:push fails),
 * so we use @libsql/client to run the DDL ourselves.
 *
 * ── Usage ──────────────────────────────────────────────────────────────
 *
 *   # Set Turso credentials as env vars (or put in .env.local)
 *   export TURSO_DATABASE_URL="libsql://your-db.turso.io"
 *   export TURSO_AUTH_TOKEN="eyJhbGci..."
 *
 *   # Run the sync
 *   bun run scripts/sync-turso.ts
 *
 *   # Or with inline env vars
 *   TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." bun run scripts/sync-turso.ts
 *
 * ── Safety ────────────────────────────────────────────────────────────
 *
 * ✅ IDEMPOTENT — safe to run multiple times. Already-existing tables
 *    and columns are skipped.
 * ✅ ADDITIVE ONLY — never drops or renames columns. Only adds new tables
 *    and new columns (with defaults so existing rows stay valid).
 * ⚠️  Does NOT handle column type changes, renames, or drops. Those need
 *    a manual migration (create new column, backfill, drop old — not
 *    automatable safely).
 *
 * ── When to run ───────────────────────────────────────────────────────
 *
 * After editing prisma/schema.prisma (added a new model, or added new
 * columns to an existing model), run this script to sync Turso. Then
 * commit + push — Vercel will rebuild with the updated Prisma Client.
 *
 * ───────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Config ──────────────────────────────────────────────────────────────

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('❌ Missing Turso credentials.');
  console.error('');
  console.error('   Set these env vars before running:');
  console.error('     TURSO_DATABASE_URL="libsql://your-db.turso.io"');
  console.error('     TURSO_AUTH_TOKEN="eyJhbGci..."');
  console.error('');
  console.error('   Or put them in .env.local:');
  console.error('     TURSO_DATABASE_URL=libsql://your-db.turso.io');
  console.error('     TURSO_AUTH_TOKEN=eyJhbGci...');
  console.error('');
  process.exit(1);
}

// ── Prisma schema parser ────────────────────────────────────────────────
// Minimal parser: extracts `model Name { field type @default ... }` blocks.
// We only need: model name, field name, field type, and @default value.

interface PrismaField {
  name: string;
  type: string;        // "String", "Int", "DateTime", etc.
  isId: boolean;
  isUnique: boolean;
  isOptional: boolean; // type ends with "?"
  defaultExpr?: string; // raw default expression (e.g. "@default(cuid())")
}

interface PrismaModel {
  name: string;
  fields: PrismaField[];
  uniques: string[][]; // @@unique([a, b]) compound uniques
}

function parseSchema(schemaText: string): PrismaModel[] {
  const models: PrismaModel[] = [];

  // Match `model Name { ... }` blocks (non-greedy across newlines).
  const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = modelRegex.exec(schemaText)) !== null) {
    const modelName = match[1];
    const body = match[2];
    const fields: PrismaField[] = [];
    const uniques: string[][] = [];

    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;

      // @@unique([field1, field2])
      const uniqueMatch = trimmed.match(/^@@unique\(\[([^\]]+)\]/);
      if (uniqueMatch) {
        const fieldNames = uniqueMatch[1].split(',').map((s) => s.trim());
        uniques.push(fieldNames);
        continue;
      }

      // @@index, @@map, etc. — skip for now (indexes auto-created by Turso)
      if (trimmed.startsWith('@@')) continue;

      // field definition: fieldName Type? @attributes
      // e.g. "id String @id @default(cuid())"
      // e.g. "amount Int"
      // e.g. "description String?"
      const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)(\?)?\s*(.*)/);
      if (!fieldMatch) continue;

      const [, name, type, questionMark, attrs] = fieldMatch;
      const isId = attrs.includes('@id');
      const isUnique = attrs.includes('@unique');
      const defaultMatch = attrs.match(/@default\(([^)]+)\)/);
      const defaultExpr = defaultMatch ? defaultMatch[1] : undefined;

      fields.push({
        name,
        type,
        isId,
        isUnique,
        isOptional: !!questionMark,
        defaultExpr,
      });
    }

    models.push({ name: modelName, fields, uniques });
  }

  return models;
}

// ── Prisma type → SQLite DDL type ───────────────────────────────────────

function prismaTypeToSqlite(type: string): string {
  switch (type) {
    case 'String': return 'TEXT';
    case 'Int': return 'INTEGER';
    case 'BigInt': return 'INTEGER';
    case 'Boolean': return 'INTEGER'; // SQLite stores booleans as 0/1
    case 'DateTime': return 'DATETIME';
    case 'Float': return 'REAL';
    case 'Json': return 'TEXT';
    default: return 'TEXT'; // enums, relations, etc. — stored as TEXT
  }
}

// ── Prisma default → SQL default literal ────────────────────────────────

function defaultToSql(field: PrismaField): string | null {
  if (!field.defaultExpr) return null;
  const d = field.defaultExpr.trim();

  // String defaults: @default("hello") → '"hello"'
  const stringMatch = d.match(/^"([^"]*)"$/);
  if (stringMatch) return `'${stringMatch[1]}'`;

  // Boolean: @default(true) → "1", @default(false) → "0"
  if (d === 'true') return '0'; // SQLite boolean
  if (d === 'false') return '0';

  // Numeric: @default(0), @default(80), @default(3.14)
  if (/^-?\d+(\.\d+)?$/.test(d)) return d;

  // Function defaults (cuid(), uuid(), now(), autoincrement()) — return
  // NULL or let SQLite handle. These need special handling:
  //   - @default(cuid()) / @default(uuid()) → handled by Prisma Client at
  //     insert time, DB column just needs to be nullable OR we use TEXT
  //     default ''. Safest: leave no DB default (Prisma always sends value).
  //   - @default(now()) → could use CURRENT_TIMESTAMP, but Prisma also
  //     handles this. Leave no DB default.
  //   - @default(autoincrement()) → INTEGER PRIMARY KEY AUTOINCREMENT
  if (d.includes('autoincrement')) return null;
  if (d.includes('cuid()') || d.includes('uuid()')) return null;
  if (d.includes('now()')) return null;

  // Fallback: no default
  return null;
}

// ── Build CREATE TABLE statement for a model ────────────────────────────

function buildCreateTable(model: PrismaModel): string {
  const cols: string[] = [];
  for (const field of model.fields) {
    const parts: string[] = [field.name, prismaTypeToSqlite(field.type)];
    if (field.isId) {
      // Primary key. For autoincrement Int, use AUTOINCREMENT.
      if (field.type === 'Int' && field.defaultExpr?.includes('autoincrement')) {
        parts.push('PRIMARY KEY AUTOINCREMENT');
      } else {
        parts.push('PRIMARY KEY');
      }
    } else {
      if (!field.isOptional) parts.push('NOT NULL');
      const def = defaultToSql(field);
      if (def !== null) parts.push(`DEFAULT ${def}`);
      if (field.isUnique) parts.push('UNIQUE');
    }
    cols.push(parts.join(' '));
  }

  // Compound unique constraints
  for (const uniqueFields of model.uniques) {
    cols.push(`UNIQUE(${uniqueFields.join(', ')})`);
  }

  return `CREATE TABLE IF NOT EXISTS "${model.name}" (\n  ${cols.join(',\n  ')}\n)`;
}

// ── Build ALTER TABLE for a missing column ──────────────────────────────

function buildAddColumn(modelName: string, field: PrismaField): string {
  const parts: string[] = [
    'ALTER TABLE',
    `"${modelName}"`,
    'ADD COLUMN',
    `"${field.name}"`,
    prismaTypeToSqlite(field.type),
  ];
  // For ALTER TABLE ADD COLUMN, SQLite requires a default for NOT NULL
  // columns when the table already has rows. We always provide a default.
  if (!field.isOptional) {
    const def = defaultToSql(field);
    if (def !== null) {
      parts.push('NOT NULL', `DEFAULT ${def}`);
    } else {
      // No DB default (function like cuid()) — must allow NULL to avoid
      // breaking existing rows. Prisma Client will always send a value on
      // new inserts, so NULL only affects pre-existing rows (acceptable
      // for additive migrations).
      parts.push('DEFAULT NULL');
    }
  }
  return parts.join(' ');
}

// ── Main sync logic ─────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(70));
  console.log('  Turso Schema Sync');
  console.log('═'.repeat(70));
  console.log(`  Target: ${TURSO_URL}`);
  console.log('');

  // Load + parse schema.prisma
  const schemaPath = join(process.cwd(), 'prisma', 'schema.prisma');
  const schemaText = readFileSync(schemaPath, 'utf-8');
  const models = parseSchema(schemaText);
  console.log(`📦 Parsed ${models.length} models from schema.prisma:`);
  for (const m of models) {
    console.log(`   - ${m.name} (${m.fields.length} fields)`);
  }
  console.log('');

  // Connect to Turso
  const client = createClient({ url: TURSO_URL!, authToken: TURSO_TOKEN! });

  // Test connection
  try {
    await client.execute('SELECT 1');
    console.log('✅ Connected to Turso');
    console.log('');
  } catch (e) {
    console.error('❌ Failed to connect to Turso:', e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  // Get existing tables
  const tablesResult = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'"
  );
  const existingTables = new Set(tablesResult.rows.map((r) => (r as { name: string }).name));
  console.log(`📂 Found ${existingTables.size} existing tables in Turso`);
  console.log('');

  let createdTables = 0;
  let addedColumns = 0;
  const errors: string[] = [];

  for (const model of models) {
    if (!existingTables.has(model.name)) {
      // Table doesn't exist — CREATE it
      const ddl = buildCreateTable(model);
      console.log(`➕ Creating table: ${model.name}`);
      try {
        await client.execute(ddl);
        createdTables++;
        console.log(`   ✅ Created with ${model.fields.length} columns`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`   ❌ Failed: ${msg}`);
        errors.push(`${model.name}: ${msg}`);
      }
    } else {
      // Table exists — check for missing columns
      const colsResult = await client.execute(`PRAGMA table_info("${model.name}")`);
      const existingCols = new Set(colsResult.rows.map((r) => (r as { name: string }).name));

      for (const field of model.fields) {
        if (!existingCols.has(field.name)) {
          const ddl = buildAddColumn(model.name, field);
          console.log(`➕ Adding column: ${model.name}.${field.name} (${prismaTypeToSqlite(field.type)})`);
          try {
            await client.execute(ddl);
            addedColumns++;
            console.log(`   ✅ Added`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`   ❌ Failed: ${msg}`);
            errors.push(`${model.name}.${field.name}: ${msg}`);
          }
        }
      }
    }
  }

  // Summary
  console.log('');
  console.log('═'.repeat(70));
  console.log('  Sync Summary');
  console.log('═'.repeat(70));
  console.log(`  Tables created:  ${createdTables}`);
  console.log(`  Columns added:   ${addedColumns}`);
  console.log(`  Errors:          ${errors.length}`);
  if (errors.length > 0) {
    console.log('');
    console.log('  Errors:');
    for (const e of errors) {
      console.log(`    ❌ ${e}`);
    }
  }
  if (createdTables === 0 && addedColumns === 0 && errors.length === 0) {
    console.log('');
    console.log('  ✓ Schema already in sync — nothing to do.');
  }
  console.log('');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
