import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { reportSchedules } from "@/lib/db/schema";

const scheduleSchema = z.object({
  frequency: z.enum(["weekly", "monthly"]),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  email: z.string().email(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [schedule] = await db
    .select()
    .from(reportSchedules)
    .where(eq(reportSchedules.userId, session.userId))
    .limit(1);

  return NextResponse.json({
    schedule: schedule
      ? {
          ...schedule,
          lastSentAt: schedule.lastSentAt?.toISOString() ?? null,
          createdAt: schedule.createdAt.toISOString(),
        }
      : null,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: reportSchedules.id })
    .from(reportSchedules)
    .where(eq(reportSchedules.userId, session.userId))
    .limit(1);

  const values = {
    frequency: parsed.data.frequency,
    dayOfWeek: parsed.data.dayOfWeek ?? 1,
    dayOfMonth: parsed.data.dayOfMonth ?? 1,
    email: parsed.data.email,
    isActive: parsed.data.isActive ?? true,
  };

  let schedule;
  if (existing) {
    [schedule] = await db
      .update(reportSchedules)
      .set(values)
      .where(eq(reportSchedules.id, existing.id))
      .returning();
  } else {
    [schedule] = await db
      .insert(reportSchedules)
      .values({ userId: session.userId, ...values })
      .returning();
  }

  return NextResponse.json({ schedule });
}
