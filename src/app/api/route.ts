// GET /api — status layanan (health check sederhana).
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: "ok", app: "Rutina API", versi: 1 });
}