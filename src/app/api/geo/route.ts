import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

function countryFromAcceptLanguage(header: string | null): string | null {
  if (!header) return null;
  const first = header.split(",")[0]?.trim();
  if (!first) return null;
  const locale = first.split(";")[0]?.trim();
  if (!locale) return null;
  const parts = locale.replace("_", "-").split("-");
  if (parts.length >= 2 && /^[A-Za-z]{2}$/.test(parts[1])) {
    return parts[1].toUpperCase();
  }
  return null;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fromIp = request.headers.get("x-vercel-ip-country")?.trim().toUpperCase();
  const fromLang = countryFromAcceptLanguage(
    request.headers.get("accept-language")
  );

  const countryCode =
    fromIp && /^[A-Z]{2}$/.test(fromIp) && fromIp !== "XX"
      ? fromIp
      : fromLang && /^[A-Z]{2}$/.test(fromLang)
        ? fromLang
        : "US";

  return NextResponse.json({
    countryCode,
    source: fromIp && fromIp !== "XX" ? "ip" : fromLang ? "locale" : "default",
  });
}
