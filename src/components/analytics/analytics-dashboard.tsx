"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Eye,
  Heart,
  UserPlus,
  FileVideo,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import { StatCard } from "@/components/analytics/stat-card";
import { PlatformBarChart } from "@/components/analytics/platform-bar-chart";
import { TopPostsTable } from "@/components/analytics/top-posts-table";
import { BestTimeToPost } from "@/components/analytics/best-time-to-post";
import { cn } from "@/lib/utils";

type Range = "7d" | "30d" | "90d";

interface AnalyticsData {
  summary: {
    totalViews: number;
    engagementRate: number;
    newFollowers: number;
    postsPublished: number;
  };
  viewsByPlatform: {
    platform: string;
    views: number;
    percentage: number;
  }[];
  topPosts: {
    postId: string;
    title: string;
    platform: string;
    views: number;
    engagementRate: number;
    likes: number;
  }[];
  bestTimeToPost: {
    platform: string;
    dayOfWeek: number;
    hourOfDay: number;
    avgEngagementRate: number;
    sampleSize: number;
  }[];
  lastSyncedAt: string | null;
  features: {
    bestTimeToPost: boolean;
    plan: string;
  };
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const ranges: { value: Range; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export function AnalyticsDashboard() {
  const [range, setRange] = useState<Range>("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/analytics?range=${r}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load analytics");
        return;
      }
      setData(json);
    } catch {
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/analytics", { method: "POST" });
      const json = await res.json();
      if (res.ok) setData(json);
    } finally {
      setSyncing(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw size={28} className="animate-spin text-brand-500" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="text-center py-24">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => load(range)}
          className="text-brand-600 font-medium hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  const summary = data?.summary ?? {
    totalViews: 0,
    engagementRate: 0,
    newFollowers: 0,
    postsPublished: 0,
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 size={24} className="text-brand-600" />
            Analytics
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Performance across all connected platforms
            {data?.lastSyncedAt && (
              <span className="text-gray-400">
                {" "}
                · Last synced{" "}
                {new Date(data.lastSyncedAt).toLocaleString()}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex bg-gray-100 rounded-full p-1">
            {ranges.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                  range === r.value
                    ? "bg-white shadow text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={cn(syncing && "animate-spin")}
            />
            Sync
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Views"
          value={formatViews(summary.totalViews)}
          sub={`Last ${range.replace("d", " days")}`}
          icon={Eye}
          color="text-brand-600 bg-brand-50"
        />
        <StatCard
          label="Engagement Rate"
          value={`${summary.engagementRate.toFixed(1)}%`}
          sub="Likes, comments, shares & saves"
          icon={Heart}
          color="text-pink-600 bg-pink-50"
        />
        <StatCard
          label="New Followers"
          value={formatViews(summary.newFollowers)}
          sub="Across all platforms"
          icon={UserPlus}
          color="text-green-600 bg-green-50"
        />
        <StatCard
          label="Posts Published"
          value={summary.postsPublished.toString()}
          sub="In selected period"
          icon={FileVideo}
          color="text-purple-600 bg-purple-50"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-6">Views by Platform</h2>
          <PlatformBarChart data={data?.viewsByPlatform ?? []} />
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-6">Best Time to Post</h2>
          <BestTimeToPost
            slots={data?.bestTimeToPost ?? []}
            locked={!data?.features.bestTimeToPost}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-6">Top Performing Posts</h2>
        <TopPostsTable posts={data?.topPosts ?? []} />
      </div>
    </div>
  );
}
