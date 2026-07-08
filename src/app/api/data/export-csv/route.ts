import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const transactions = await db.transaction.findMany({
      orderBy: { date: 'desc' },
    });

    const headers = ['Tanggal', 'Tipe', 'Kategori', 'Deskripsi', 'Jumlah', 'Catatan'];

    const rows = transactions.map((t) => {
      const date = t.date.toISOString().slice(0, 10);
      const tipe = t.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
      const jumlah = String(t.amount);
      const description = t.description ?? '';
      const notes = t.notes ?? '';

      // Escape CSV fields that contain commas, quotes, or newlines
      const escape = (field: string) => {
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      };

      return [date, tipe, t.category, escape(description), jumlah, escape(notes)].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="transaksi-keuangan-${today}.csv"`,
      },
    });
  } catch (error) {
    console.error('CSV export failed:', error);
    return NextResponse.json(
      { error: 'Failed to export transactions as CSV' },
      { status: 500 }
    );
  }
}