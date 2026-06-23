import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createSession, hashPassword } from "@/lib/auth";
import { recordReferralOnSignup } from "@/lib/affiliate";

const sharedFields = {
  email: z.string().email(),
  password: z.string().min(8),
  referralCode: z.string().min(4).max(32).optional(),
};

const signupSchema = z.discriminatedUnion("accountType", [
  z.object({
    accountType: z.literal("creator"),
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    ...sharedFields,
  }),
  z.object({
    accountType: z.literal("small_business"),
    organizationName: z.string().trim().min(2, "Business name is required"),
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    ...sharedFields,
  }),
  z.object({
    accountType: z.literal("agency"),
    organizationName: z.string().trim().min(2, "Agency name is required"),
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    ...sharedFields,
  }),
]);

function displayName(data: z.infer<typeof signupSchema>): string {
  if (data.accountType === "creator") {
    return `${data.firstName} ${data.lastName}`.trim();
  }
  return data.organizationName;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const data = parsed.data;
    const { email, password, referralCode } = data;
    const db = getDb();

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    const name = displayName(data);
    const firstName =
      data.accountType === "creator" ? data.firstName : data.firstName?.trim() || null;
    const lastName =
      data.accountType === "creator" ? data.lastName : data.lastName?.trim() || null;
    const organizationName =
      data.accountType === "creator" ? null : data.organizationName;

    const [user] = await db
      .insert(users)
      .values({
        name,
        firstName,
        lastName,
        organizationName,
        accountType: data.accountType,
        email: email.toLowerCase(),
        passwordHash,
        plan: "trial",
        trialEndsAt,
      })
      .returning();

    if (referralCode) {
      await recordReferralOnSignup(referralCode, user.id);
    }

    await createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Server error. Is DATABASE_URL configured?" },
      { status: 500 }
    );
  }
}
