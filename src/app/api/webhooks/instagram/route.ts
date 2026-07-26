import { NextRequest, NextResponse } from "next/server";

/**
 * Meta / Instagram webhook verification and event receiver.
 * Configure in Meta → Instagram → Webhooks (not OAuth redirect settings).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    token &&
    challenge &&
    expected &&
    token === expected
  ) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (body) {
    console.log("Meta webhook event:", JSON.stringify(body).slice(0, 500));
  }
  return NextResponse.json({ received: true });
}
