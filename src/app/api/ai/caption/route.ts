import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { generateCaptions } from "@/lib/ai/captions";

const schema = z.object({
  title: z.string().min(1),
  platforms: z.array(z.string()).min(1),
  tone: z.enum(["professional", "casual", "playful"]).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const result = await generateCaptions(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("AI caption error:", error);
    return NextResponse.json(
      { error: "Failed to generate captions" },
      { status: 500 }
    );
  }
}
