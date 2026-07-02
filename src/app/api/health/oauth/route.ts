import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOAuthDiagnostics } from "@/lib/oauth-config";

/**
 * OAuth configuration diagnostic — requires login.
 * Use from Dashboard → Accounts when a connect flow fails to verify env + redirect URIs.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(getOAuthDiagnostics());
}
