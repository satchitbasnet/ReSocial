import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOAuthDiagnostics } from "@/lib/oauth-status";

/** Returns OAuth configuration status and redirect URIs for the logged-in user. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(getOAuthDiagnostics());
}
