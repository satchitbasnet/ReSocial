"use client";

import { useCallback, useEffect, useState, Fragment } from "react";
import Link from "next/link";
import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
} from "lucide-react";
import type { PostPerformanceRow } from "@/lib/analytics/post-performance";

type Range = "7d" | "30d" | "90d";
type SortKey = "views" | "likes" | "comments" | "engagementRate" | "publishedAt";

function formatNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function exportCsv(posts: PostPerformanceRow[]) {
  const headers = [
    "Title",
    "Platforms",
    "Total Views",
    "Total Likes",
    "Total Comments",
    "Engagement Rate %",
    "Published",
  ];
  const rows = posts.map((p) => [
    `"${p.title.replace(/"/g, '""')}"`,
    p.platforms.join("; "),
    p.totalViews,
    p.totalLikes,
    p.totalComments,
    p.engagementRate.toFixed(2),
    p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : "",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `resocial-posts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PostPerformancePage() {
  const [posts, setPosts] = useState<PostPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("30d");
  const [platform, setPlatform] = useState("all");
  const [sort, setSort] = useState<SortKey>("views");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ range, sort, order });
    if (platform !== "all") params.set("platform", platform);
    const res = await fetch(`/api/analytics/posts?${params}`);
    const data = await res.json();
    if (data.posts) setPosts(data.posts);
    setLoading(false);
  }, [range, platform, sort, order]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSort(key);
      setOrder("desc");
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sort !== column) return null;
    return order === "desc" ? (
      <ChevronDown size={14} className="inline ml-0.5" />
    ) : (
      <ChevronUp size={14} className="inline ml-0.5" />
    );
  }

  return (
    <div className="max-w-6xl">
      <Link
        href="/dashboard/analytics"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-4"
      >
        <ArrowLeft size={16} /> Back to analytics
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Post Performance</h1>
          <p className="text-gray-600 text-sm mt-1">
            Compare post-level performance across all networks in one table.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => exportCsv(posts)}>
          <Download size={16} className="mr-1.5" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="inline-flex bg-gray-100 rounded-full p-1">
          {(["7d", "30d", "90d"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                range === r ? "bg-white shadow text-gray-900" : "text-gray-500"
              )}
            >
              {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
            </button>
          ))}
        </div>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="text-sm rounded-xl border border-gray-200 px-3 py-2"
        >
          <option value="all">All Platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-brand-500" size={32} />
          </div>
        ) : posts.length === 0 ? (
          <p className="text-center text-gray-500 py-16 text-sm">
            No published posts in this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50/50">
                  <th className="px-4 py-3 font-medium">Post</th>
                  <th className="px-4 py-3 font-medium">Platforms</th>
                  <th
                    className="px-4 py-3 font-medium text-right cursor-pointer hover:text-gray-900"
                    onClick={() => toggleSort("views")}
                  >
                    Views <SortIcon column="views" />
                  </th>
                  <th
                    className="px-4 py-3 font-medium text-right cursor-pointer hover:text-gray-900"
                    onClick={() => toggleSort("likes")}
                  >
                    Likes <SortIcon column="likes" />
                  </th>
                  <th
                    className="px-4 py-3 font-medium text-right cursor-pointer hover:text-gray-900 hidden md:table-cell"
                    onClick={() => toggleSort("comments")}
                  >
                    Comments <SortIcon column="comments" />
                  </th>
                  <th
                    className="px-4 py-3 font-medium text-right cursor-pointer hover:text-gray-900"
                    onClick={() => toggleSort("engagementRate")}
                  >
                    Eng. <SortIcon column="engagementRate" />
                  </th>
                  <th
                    className="px-4 py-3 font-medium text-right cursor-pointer hover:text-gray-900 hidden sm:table-cell"
                    onClick={() => toggleSort("publishedAt")}
                  >
                    Date <SortIcon column="publishedAt" />
                  </th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {posts.map((post) => (
                  <Fragment key={post.postId}>
                    <tr
                      className="hover:bg-gray-50/50 cursor-pointer"
                      onClick={() =>
                        setExpanded((e) =>
                          e === post.postId ? null : post.postId
                        )
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {post.mediaType === "video" ? (
                            <video
                              src={post.mediaUrl}
                              className="h-10 w-10 rounded-lg object-cover bg-gray-100 shrink-0"
                              muted
                            />
                          ) : (
                            <img
                              src={post.mediaUrl}
                              alt=""
                              className="h-10 w-10 rounded-lg object-cover bg-gray-100 shrink-0"
                            />
                          )}
                          <span className="font-medium text-gray-900 line-clamp-1 max-w-[180px]">
                            {post.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex -space-x-1">
                          {post.platforms.map((p) => (
                            <span
                              key={p}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-200"
                            >
                              <PlatformIcon platform={p} size={12} />
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatNum(post.totalViews)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatNum(post.totalLikes)}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        {formatNum(post.totalComments)}
                      </td>
                      <td className="px-4 py-3 text-right text-brand-600 font-medium">
                        {post.engagementRate.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 text-xs hidden sm:table-cell">
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-400">
                        {expanded === post.postId ? (
                          <ChevronUp size={16} />
                        ) : (
                          <ChevronDown size={16} />
                        )}
                      </td>
                    </tr>
                    {expanded === post.postId && (
                      <tr>
                        <td colSpan={8} className="px-4 py-3 bg-gray-50/80">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                            Per-platform breakdown
                          </p>
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {post.breakdown.map((b) => {
                              const plat = PLATFORMS.find(
                                (p) => p.id === b.platform
                              );
                              return (
                                <div
                                  key={b.distributionId}
                                  className="bg-white rounded-xl border border-gray-100 p-3 text-xs"
                                >
                                  <div className="flex items-center gap-1.5 font-medium text-gray-800 mb-2">
                                    <PlatformIcon platform={b.platform} size={14} />
                                    {plat?.name}
                                  </div>
                                  <div className="grid grid-cols-2 gap-1 text-gray-600">
                                    <span>Views: {formatNum(b.views)}</span>
                                    <span>Likes: {formatNum(b.likes)}</span>
                                    <span>Comments: {formatNum(b.comments)}</span>
                                    <span>Eng: {b.engagementRate.toFixed(1)}%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
