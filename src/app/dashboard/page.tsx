import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard";
import { Button } from "@/components/ui/button";
import { Upload, Link2, BarChart3, Zap, Workflow } from "lucide-react";
import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { ProcessingUsageBar } from "@/components/dashboard/processing-usage-bar";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const stats = await getDashboardStats(session.userId);

  const cards = [
    {
      label: "Videos Published",
      value: stats.videosPublished,
      sub: stats.trialLimit ? `of ${stats.trialLimit} trial limit` : "this period",
      icon: BarChart3,
      color: "text-brand-600 bg-brand-50",
    },
    {
      label: "Connected Accounts",
      value: stats.accountCount,
      sub: `across ${PLATFORMS.length} platforms`,
      icon: Link2,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Total Posts",
      value: stats.postCount,
      sub: "all time",
      icon: Upload,
      color: "text-purple-600 bg-purple-50",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {session.name.split(" ")[0]}!
        </h1>
        <p className="text-gray-600 mt-1">
          Upload once, distribute everywhere. Here&apos;s your overview.
        </p>
      </div>

      {stats.trialLimit && stats.videosPublished >= 7 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <Zap size={20} className="text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">
              {stats.videosPublished}/{stats.trialLimit} trial videos used
            </p>
            <p className="text-xs text-amber-700">
              Upgrade to keep publishing after your trial ends.
            </p>
          </div>
          <Button size="sm" href="/pricing">Upgrade</Button>
        </div>
      )}

      <ProcessingUsageBar usage={stats.usage} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-2xl p-6 border border-gray-100"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">{card.label}</span>
              <div className={`p-2 rounded-lg ${card.color}`}>
                <card.icon size={18} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              href="/dashboard/upload"
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50/50 transition-all"
            >
              <div className="p-2 rounded-lg bg-brand-50 text-brand-600">
                <Upload size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Upload & Publish</p>
                <p className="text-xs text-gray-500">
                  Upload a video and distribute to all platforms
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/analytics"
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50/50 transition-all"
            >
              <div className="p-2 rounded-lg bg-brand-50 text-brand-600">
                <BarChart3 size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">View Analytics</p>
                <p className="text-xs text-gray-500">
                  Track views, engagement, and best posting times
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/workflows"
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50/50 transition-all"
            >
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
                <Workflow size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Manage Workflows</p>
                <p className="text-xs text-gray-500">
                  Automate distribution rules across platforms
                </p>
              </div>
            </Link>
            <Link
              href="/dashboard/accounts"
              className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50/50 transition-all"
            >
              <div className="p-2 rounded-lg bg-green-50 text-green-600">
                <Link2 size={20} />
              </div>
              <div>
                <p className="font-medium text-gray-900">Connect Accounts</p>
                <p className="text-xs text-gray-500">
                  Link your TikTok, YouTube, Instagram, and more
                </p>
              </div>
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Supported Platforms</h2>
          <div className="grid grid-cols-4 gap-3">
            {PLATFORMS.map((p) => (
              <div
                key={p.id}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-gray-50"
              >
                <PlatformIcon platform={p.id} size={22} />
                <span className="text-xs text-gray-600 text-center">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
