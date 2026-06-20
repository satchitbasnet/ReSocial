"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { Hash, Loader2, Plus, RefreshCw, Trash2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface HashtagRow {
  id: string;
  hashtag: string;
  platform: string;
  createdAt: string;
  stats: {
    postCount: number;
    avgEngagement: number;
    trendScore: number;
  } | null;
}

export default function ListeningPage() {
  const [hashtags, setHashtags] = useState<HashtagRow[]>([]);
  const [limit, setLimit] = useState(10);
  const [plan, setPlan] = useState("trial");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [platform, setPlatform] = useState<"instagram" | "tiktok">("instagram");
  const [error, setError] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/listening/hashtags");
    const data = await res.json();
    if (data.hashtags) setHashtags(data.hashtags);
    if (data.limit) setLimit(data.limit);
    if (data.plan) setPlan(data.plan);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addHashtag() {
    if (!newTag.trim()) return;
    setError("");
    const res = await fetch("/api/listening/hashtags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hashtag: newTag, platform }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.upgradeRequired) setUpgradeOpen(true);
      setError(data.error || "Failed to add hashtag");
      return;
    }
    setNewTag("");
    load();
  }

  async function removeHashtag(id: string) {
    await fetch(`/api/listening/hashtags/${id}`, { method: "DELETE" });
    load();
  }

  async function sync() {
    setSyncing(true);
    await fetch("/api/listening/sync", { method: "POST" });
    await load();
    setSyncing(false);
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hashtag Tracking</h1>
          <p className="text-gray-600 text-sm mt-1">
            Monitor hashtags on Instagram and TikTok. {hashtags.length}/{limit} tracked.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
          {syncing ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <RefreshCw size={16} className="mr-1.5" />}
          Sync stats
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Add hashtag</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="contentcreator"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm"
              onKeyDown={(e) => e.key === "Enter" && addHashtag()}
            />
          </div>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as "instagram" | "tiktok")}
            className="text-sm rounded-xl border border-gray-200 px-3 py-2.5"
          >
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
          </select>
          <Button onClick={addHashtag} disabled={hashtags.length >= limit}>
            <Plus size={16} className="mr-1" /> Track
          </Button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-brand-500" size={32} />
        </div>
      ) : hashtags.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 text-gray-500 text-sm">
          No hashtags tracked yet. Add one above to start monitoring.
        </div>
      ) : (
        <div className="space-y-3">
          {hashtags.map((tag) => {
            const plat = PLATFORMS.find((p) => p.id === tag.platform);
            return (
              <div
                key={tag.id}
                className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <PlatformIcon platform={tag.platform} size={22} />
                  <div>
                    <p className="font-semibold text-gray-900">#{tag.hashtag}</p>
                    <p className="text-xs text-gray-500">{plat?.name}</p>
                  </div>
                </div>
                {tag.stats && (
                  <div className="flex gap-6 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Posts</p>
                      <p className="font-semibold">{tag.stats.postCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Avg engagement</p>
                      <p className="font-semibold">{tag.stats.avgEngagement.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs flex items-center gap-0.5">
                        <TrendingUp size={12} /> Trend
                      </p>
                      <p
                        className={cn(
                          "font-semibold",
                          tag.stats.trendScore >= 0 ? "text-green-600" : "text-red-600"
                        )}
                      >
                        {tag.stats.trendScore >= 0 ? "+" : ""}
                        {tag.stats.trendScore}%
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/dashboard/upload?hashtag=${encodeURIComponent(tag.hashtag)}`}
                    className="text-xs text-brand-600 font-medium hover:underline px-2 py-1"
                  >
                    Use in caption
                  </Link>
                  <button
                    onClick={() => removeHashtag(tag.id)}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} limit="platforms" currentPlan={plan} />
    </div>
  );
}
