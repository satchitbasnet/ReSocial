import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildReportData, renderReportHtml } from "@/lib/reports/builder";

/** Downloadable client report (HTML — print to PDF in browser). Agency / stakeholder sharing. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const days = 30;
  const data = await buildReportData(session.userId, days);
  const html = renderReportHtml(data, "Monthly Client Report");

  const branded = html.replace(
    "<body>",
    `<body><div style="text-align:center;padding:16px;border-bottom:2px solid #e11d48"><strong style="font-size:20px">ReSocial</strong><br/><span style="color:#666">Prepared for ${session.name}</span></div>`
  );

  return new NextResponse(branded, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="resocial-report-${new Date().toISOString().slice(0, 10)}.html"`,
    },
  });
}
