import type { PlatformId } from "@/lib/constants";

export const PLATFORM_CALENDAR_COLORS: Record<
  PlatformId,
  { bg: string; border: string; text: string; dot: string }
> = {
  tiktok: {
    bg: "bg-pink-50",
    border: "border-pink-400",
    text: "text-pink-700",
    dot: "bg-pink-500",
  },
  youtube: {
    bg: "bg-red-50",
    border: "border-red-500",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  instagram: {
    bg: "bg-purple-50",
    border: "border-purple-500",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  facebook: {
    bg: "bg-blue-50",
    border: "border-blue-600",
    text: "text-blue-700",
    dot: "bg-blue-600",
  },
  linkedin: {
    bg: "bg-sky-50",
    border: "border-sky-600",
    text: "text-sky-800",
    dot: "bg-sky-600",
  },
  twitter: {
    bg: "bg-gray-50",
    border: "border-gray-800",
    text: "text-gray-800",
    dot: "bg-gray-800",
  },
  pinterest: {
    bg: "bg-rose-50",
    border: "border-rose-600",
    text: "text-rose-700",
    dot: "bg-rose-600",
  },
  snapchat: {
    bg: "bg-yellow-50",
    border: "border-yellow-400",
    text: "text-yellow-800",
    dot: "bg-yellow-400",
  },
};

export function getPlatformCalendarColor(platform: string) {
  return (
    PLATFORM_CALENDAR_COLORS[platform as PlatformId] ??
    PLATFORM_CALENDAR_COLORS.twitter
  );
}
