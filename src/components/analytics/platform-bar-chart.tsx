import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import type { PlatformId } from "@/lib/constants";

interface PlatformBarChartProps {
  data: { platform: string; views: number; percentage: number }[];
}

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function PlatformBarChart({ data }: PlatformBarChartProps) {
  const maxViews = Math.max(...data.map((d) => d.views), 1);

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        No platform data yet. Publish content to see breakdowns.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const platform = PLATFORMS.find((p) => p.id === item.platform);
        const width = Math.max((item.views / maxViews) * 100, 4);

        return (
          <div key={item.platform}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <PlatformIcon
                  platform={item.platform as PlatformId}
                  size={18}
                />
                <span className="text-sm font-medium text-gray-700">
                  {platform?.name ?? item.platform}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">
                  {formatViews(item.views)}
                </span>
                <span className="text-gray-400 ml-2">{item.percentage}%</span>
              </div>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full gradient-bg rounded-full transition-all duration-500"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
