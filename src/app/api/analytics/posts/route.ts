import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getPostPerformanceComparison } from "@/lib/analytics/post-performance";

const querySchema = z.object({
  range: z.enum(["7d", "30d", "90d"]).default("30d"),
  platform: z.string().optional(),
  sort: z
    .enum(["views", "likes", "comments", "engagementRate", "publishedAt"])
    .default("views"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const posts = await getPostPerformanceComparison(
      session.userId,
      parsed.data.range,
      parsed.data.platform
    );

    const { sort, order } = parsed.data;
    posts.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sort === "publishedAt") {
        av = a.publishedAt ?? "";
        bv = b.publishedAt ?? "";
        return order === "desc"
          ? String(bv).localeCompare(String(av))
          : String(av).localeCompare(String(bv));
      }
      av = a[
        sort === "views"
          ? "totalViews"
          : sort === "likes"
            ? "totalLikes"
            : sort === "comments"
              ? "totalComments"
              : "engagementRate"
      ];
      bv = b[
        sort === "views"
          ? "totalViews"
          : sort === "likes"
            ? "totalLikes"
            : sort === "comments"
              ? "totalComments"
              : "engagementRate"
      ];
      return order === "desc"
        ? (bv as number) - (av as number)
        : (av as number) - (bv as number);
    });

    return NextResponse.json({ posts });
  } catch (error) {
    console.error("Post performance error:", error);
    return NextResponse.json({ error: "Failed to load posts" }, { status: 500 });
  }
}
