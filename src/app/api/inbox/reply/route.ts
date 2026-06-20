import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { sendInboxReply } from "@/lib/inbox/reply";

const replySchema = z.object({
  messageId: z.string().uuid(),
  text: z.string().min(1).max(10000),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    await sendInboxReply(session.userId, parsed.data.messageId, parsed.data.text);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reply failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
