import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { fetchPublicHolidays, normalizeCountryCode } from "@/lib/holidays";

const querySchema = z.object({
  year: z.coerce.number().int().min(1970).max(2100),
  country: z.string().min(2).max(2),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const country = normalizeCountryCode(parsed.data.country);
  if (!country) {
    return NextResponse.json({ error: "Invalid country" }, { status: 400 });
  }

  const holidays = await fetchPublicHolidays(parsed.data.year, country);
  return NextResponse.json({ country, year: parsed.data.year, holidays });
}
