import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getAppUrl } from "@/lib/config";
import { getStripe, getPriceId, type BillingInterval } from "@/lib/stripe";

const checkoutSchema = z.object({
  plan: z.enum(["starter", "pro", "agency"]),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { plan, interval } = parsed.data;
    const priceId = getPriceId(plan, interval as BillingInterval);
    const stripe = getStripe();
    const appUrl = getAppUrl();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/settings?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      customer_email: session.email,
      metadata: {
        userId: session.userId,
        plan,
      },
      subscription_data: {
        metadata: {
          userId: session.userId,
          plan,
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create checkout session";
    const isConfig =
      message.includes("must be set") || message.includes("STRIPE_");
    return NextResponse.json(
      {
        error: isConfig
          ? "Stripe is not configured. Add STRIPE_SECRET_KEY and plan price IDs to your environment."
          : "Failed to create checkout session",
      },
      { status: 500 }
    );
  }
}
