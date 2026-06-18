import { eq, and } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { workflows, type Workflow } from "@/lib/db/schema";

export async function resolveWorkflowForPublish(
  db: Db,
  userId: string,
  platformIds: string[],
  workflowId?: string
): Promise<Workflow | null> {
  if (workflowId) {
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(
        and(eq(workflows.id, workflowId), eq(workflows.userId, userId))
      )
      .limit(1);
    return workflow ?? null;
  }

  const active = await db
    .select()
    .from(workflows)
    .where(
      and(eq(workflows.userId, userId), eq(workflows.isActive, true))
    );

  const covering = active.find((w) =>
    platformIds.every((p) => w.targetPlatforms.includes(p))
  );
  if (covering) return covering;

  const overlapping = active.find((w) =>
    platformIds.some((p) => w.targetPlatforms.includes(p))
  );
  return overlapping ?? null;
}
