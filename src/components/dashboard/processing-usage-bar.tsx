import { type UsageStatus } from "@/lib/usage/tracker";

const SHOW_THRESHOLD_PERCENT = 70;

interface ProcessingUsageBarProps {
  usage: UsageStatus;
}

export function ProcessingUsageBar({ usage }: ProcessingUsageBarProps) {
  if (usage.percentUsed < SHOW_THRESHOLD_PERCENT) {
    return null;
  }

  const barWidth = Math.min(usage.percentUsed, 100);

  return (
    <div className="mb-6 glass-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-900">
          Processing Usage This Month
        </p>
        <p className="text-sm text-gray-600">
          {usage.used} / {usage.cap}
        </p>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            usage.percentUsed >= 100
              ? "bg-amber-500"
              : usage.percentUsed >= 80
                ? "bg-amber-400"
                : "bg-brand-500"
          }`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Auto-Resize and Watermark Removal. Resets{" "}
        {usage.periodEnd.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })}
        . Posting Is Always Unlimited.
      </p>
    </div>
  );
}
