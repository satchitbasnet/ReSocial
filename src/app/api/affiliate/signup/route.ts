import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createAffiliateForUser,
  getAffiliateDashboard,
  buildReferralLink,
} from "@/lib/affiliate";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { referralCode } = await createAffiliateForUser(session.userId);
    const dashboard = await getAffiliateDashboard(session.userId);

    return NextResponse.json({
      success: true,
      referralCode,
      referralLink: buildReferralLink(referralCode),
      ...dashboard,
    });
  } catch (error) {
    console.error("Affiliate signup error:", error);
    return NextResponse.json(
      { error: "Failed to enroll in affiliate program" },
      { status: 500 }
    );
  }
}
