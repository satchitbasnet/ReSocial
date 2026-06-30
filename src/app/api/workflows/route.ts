import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import type { PlatformId } from "@/lib/constants";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const items = await db
      .select()
      .from(workflows)
      .where(eq(workflows.userId, session.userId))
      .orderBy(desc(workflows.createdAt));

    return NextResponse.json({ workflows: items });
  } catch (error) {
    console.error("Get workflows error:", error);
    return NextResponse.json({ error: "Failed to fetch workflows" }, { status: 500 });
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  workflowType: z.enum(["new_content", "existing_content"]).default("new_content"),
  contentType: z.enum(["video", "photos"]).default("video"),
  sourcePlatform: z.string().optional(),
  sourceAccountId: z.string().uuid().optional(),
  targetPlatforms: z.array(z.string()).min(1),
  autoResize: z.boolean().default(true),
  removeWatermark: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const db = getDb();
    const [workflow] = await db
      .insert(workflows)
      .values({
        userId: session.userId,
        name: parsed.data.name,
        workflowType: parsed.data.workflowType,
        contentType: parsed.data.contentType,
        sourcePlatform: parsed.data.sourcePlatform as PlatformId | undefined,
        sourceAccountId: parsed.data.sourceAccountId,
        targetPlatforms: parsed.data.targetPlatforms,
        autoResize: parsed.data.autoResize,
        removeWatermark: parsed.data.removeWatermark,
      })
      .returning();

    return NextResponse.json({ workflow });
  } catch (error) {
    console.error("Create workflow error:", error);
    return NextResponse.json({ error: "Failed to create workflow" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Workflow ID required" }, { status: 400 });
  }

  try {
    const db = getDb();
    await db
      .delete(workflows)
      .where(and(eq(workflows.id, id), eq(workflows.userId, session.userId)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete workflow error:", error);
    return NextResponse.json({ error: "Failed to delete workflow" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, isActive } = body as { id: string; isActive: boolean };
    if (!id || typeof isActive !== "boolean") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const db = getDb();
    const [updated] = await db
      .update(workflows)
      .set({ isActive })
      .where(and(eq(workflows.id, id), eq(workflows.userId, session.userId)))
      .returning();

    return NextResponse.json({ workflow: updated });
  } catch (error) {
    console.error("Update workflow error:", error);
    return NextResponse.json({ error: "Failed to update workflow" }, { status: 500 });
  }
}
