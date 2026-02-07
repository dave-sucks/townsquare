import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (key !== "migrate-dev-to-prod-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { statements } = await request.json();

    if (!Array.isArray(statements)) {
      return NextResponse.json({ error: "statements must be an array" }, { status: 400 });
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const sql of statements) {
      try {
        await prisma.$executeRawUnsafe(sql);
        success++;
      } catch (e: any) {
        if (e.message?.includes("duplicate key") || e.message?.includes("unique constraint")) {
          success++;
        } else {
          failed++;
          errors.push(`${e.message?.substring(0, 100)}: ${sql.substring(0, 80)}`);
        }
      }
    }

    return NextResponse.json({ success, failed, errors: errors.slice(0, 20) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
