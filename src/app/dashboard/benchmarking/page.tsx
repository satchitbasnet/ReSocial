"use client";

import { useEffect, useState } from "react";
import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { BarChart2, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

interface Competitor {
  id: string;
  platform: string;
  handle: string;
  displayName: string | null;
  followerCount: number;
  avgViews: number;
  avgEngagement: number;
  postsPublished: number;
}

interface BenchmarkData {
  you: {
    avgViews: number;
    avgEngagement: number;
    followerCount: number;
    postsPerMonth: number;
  };
  competitors: Competitor[];
}

export default function BenchmarkingPage() {
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [handle, setHandle] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/benchmarking");
    const json = await res.json();
    if (res.status === 403) {
      setBlocked(true);
      setLoading(false);
      return;
    }
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addCompetitor() {
    const res = await fetch("/api/benchmarking/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, handle }),
    });
    if (!res.ok) {
      const d = await res.json();
      if (d.upgradeRequired) setUpgradeOpen(true);
      return;
    }
    setHandle("");
    load();
  }

  async function sync() {
    setSyncing(true);
    const res = await fetch("/api/benchmarking", { method: "POST" });
    const json = await res.json();
    if (json.you) setData(json);
    setSyncing(false);
  }

  async function remove(id: string) {
    await fetch(`/api/benchmarking/competitors?id=${id}`, { method: "DELETE" });
    load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-brand-500" size={32} />
      </div>
    );
  }

  if (blocked) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <BarChart2 size={48} className="mx-auto text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Competitor Benchmarking</h1>
        <p className="text-gray-600 mb-6">
          Compare your performance against competitors side-by-side. Available on Pro and Agency plans.
        </p>
        <Button href="/pricing">Upgrade plan</Button>
      </div>
    );
  }

  const you = data?.you;
  const competitors = data?.competitors ?? [];

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Competitor Benchmarking</h1>
          <p className="text-gray-600 text-sm mt-1">
            See how you stack up against competitors across platforms.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={sync} disabled={syncing}>
          {syncing ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <RefreshCw size={16} className="mr-1.5" />}
          Refresh data
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Your avg views", value: you?.avgViews ?? 0 },
          { label: "Your avg engagement", value: you?.avgEngagement ?? 0 },
          { label: "Your followers", value: you?.followerCount ?? 0 },
          { label: "Posts published", value: you?.postsPerMonth ?? 0 },
        ].map((s) => (
          <div key={s.label} className="bg-brand-50 rounded-2xl p-4 border border-brand-100">
            <p className="text-xs text-brand-600 font-medium">{s.label}</p>
            <p className="text-2xl font-bold text-brand-800 mt-1">
              {s.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Add competitor</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="@competitor"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm"
          />
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="text-sm rounded-xl border border-gray-200 px-3 py-2.5"
          >
            {PLATFORMS.slice(0, 5).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button onClick={addCompetitor}>
            <Plus size={16} className="mr-1" /> Add
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium text-right">Followers</th>
              <th className="px-4 py-3 font-medium text-right">Avg views</th>
              <th className="px-4 py-3 font-medium text-right">Avg engagement</th>
              <th className="px-4 py-3 font-medium text-right">Posts/mo</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <tr className="bg-brand-50/50">
              <td className="px-4 py-3 font-semibold text-brand-800">You</td>
              <td className="px-4 py-3 text-right">{(you?.followerCount ?? 0).toLocaleString()}</td>
              <td className="px-4 py-3 text-right">{(you?.avgViews ?? 0).toLocaleString()}</td>
              <td className="px-4 py-3 text-right">{(you?.avgEngagement ?? 0).toLocaleString()}</td>
              <td className="px-4 py-3 text-right">{you?.postsPerMonth ?? 0}</td>
              <td />
            </tr>
            {competitors.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={c.platform} size={16} />
                    <span className="font-medium">@{c.handle}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">{c.followerCount.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{c.avgViews.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{c.avgEngagement.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">{c.postsPublished}</td>
                <td className="px-4 py-3">
                  <button onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {competitors.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-8">Add competitors to compare.</p>
        )}
      </div>

      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} limit="platforms" currentPlan="starter" />
    </div>
  );
}
