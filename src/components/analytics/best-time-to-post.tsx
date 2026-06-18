import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { formatDayOfWeek, formatHour } from "@/lib/analytics/metrics";
import type { PlatformId } from "@/lib/constants";
import { Clock } from "lucide-react";

interface BestTimeSlot {
  platform: string;
  dayOfWeek: number;
  hourOfDay: number;
  avgEngagementRate: number;
  sampleSize: number;
}

interface BestTimeToPostProps {
  slots: BestTimeSlot[];
  locked?: boolean;
}

export function BestTimeToPost({ slots, locked }: BestTimeToPostProps) {
  if (locked) {
    return (
      <div className="text-center py-10 px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-50 text-brand-600 mb-4">
          <Clock size={24} />
        </div>
        <p className="font-medium text-gray-900 mb-1">Best time to post</p>
        <p className="text-sm text-gray-500 mb-4 max-w-xs mx-auto">
          Upgrade to Creator ($12/mo) to unlock posting time insights based on
          your historical engagement.
        </p>
        <a
          href="/pricing"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          View plans →
        </a>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        Publish more content to calculate your best posting times.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {slots.map((slot) => {
        const platform = PLATFORMS.find((p) => p.id === slot.platform);
        return (
          <div
            key={slot.platform}
            className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100"
          >
            <PlatformIcon
              platform={slot.platform as PlatformId}
              size={22}
            />
            <div>
              <p className="font-medium text-gray-900 text-sm">
                {platform?.name ?? slot.platform}
              </p>
              <p className="text-brand-600 font-semibold mt-0.5">
                {formatDayOfWeek(slot.dayOfWeek)} · {formatHour(slot.hourOfDay)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {slot.avgEngagementRate.toFixed(1)}% avg engagement ·{" "}
                {slot.sampleSize} post{slot.sampleSize !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
