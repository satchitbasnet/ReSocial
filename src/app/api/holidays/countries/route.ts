import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { fetchHolidayCountries } from "@/lib/holidays";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const countries = await fetchHolidayCountries();
  return NextResponse.json({ countries });
}
