"use client";

import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { getPlatformCalendarColor } from "@/lib/platform-colors";
import { Button } from "@/components/ui/button";
import { X, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toDatetimeLocalValue } from "@/lib/calendar";
import { useState } from "react";

export interface CalendarDistribution {
  id: string;
  platform: string;
  status: string;
  publishedAt: string | null;
  errorMessage: string | null;
  accountName: string | null;
}

export interface CalendarPost {
  id: string;
  title: string;
  caption: string | null;
  mediaUrl: string;
  mediaType: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  calendarDate: string;
  distributions: CalendarDistribution[];
}

const statusConfig: Record<
  string,
  { label: string; icon: typeof CheckCircle; className: string }
> = {
  scheduled: { label: "Scheduled", icon: Clock, className: "text-amber-600" },
  published: { label: "Published", icon: CheckCircle, className: "text-green-600" },
  failed: { label: "Failed", icon: XCircle, className: "text-red-600" },
  processing: { label: "Processing", icon: Loader2, className: "text-brand-600 animate-spin" },
  draft: { label: "Draft", icon: Clock, className: "text-gray-500" },
};

interface PostDetailModalProps {
  post: CalendarPost;
  onClose: () => void;
  onRescheduled: (postId: string, scheduledAt: string) => void;
}

export function PostDetailModal({
  post,
  onClose,
  onRescheduled,
}: PostDetailModalProps) {
  const canReschedule = ["scheduled", "draft"].includes(post.status);
  const initialDate = post.scheduledAt ?? post.calendarDate;
  const [rescheduleValue, setRescheduleValue] = useState(
    toDatetimeLocalValue(new Date(initialDate))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const status =
    statusConfig[post.status] ?? statusConfig.draft;
  const StatusIcon = status.icon;

  async function handleReschedule() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: new Date(rescheduleValue).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reschedule");
        return;
      }
      onRescheduled(post.id, new Date(rescheduleValue).toISOString());
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="p-6">
          <div className="flex gap-4 mb-5">
            {post.mediaType === "video" ? (
              <video
                src={post.mediaUrl}
                className="w-28 h-28 rounded-xl object-cover bg-gray-100 shrink-0"
                muted
              />
            ) : (
              <img
                src={post.mediaUrl}
                alt={post.title}
                className="w-28 h-28 rounded-xl object-cover bg-gray-100 shrink-0"
              />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-gray-900 pr-6">{post.title}</h2>
              {post.caption && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.caption}</p>
              )}
              <div className="flex items-center gap-1.5 mt-2 text-sm">
                <StatusIcon size={14} className={status.className} />
                <span className={cn("font-medium", status.className)}>
                  {status.label}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(post.calendarDate).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="mb-5">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Platforms
            </p>
            <div className="flex flex-wrap gap-2">
              {post.distributions.map((dist) => {
                const colors = getPlatformCalendarColor(dist.platform);
                const platform = PLATFORMS.find((p) => p.id === dist.platform);
                return (
                  <span
                    key={dist.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border",
                      colors.bg,
                      colors.border,
                      colors.text
                    )}
                  >
                    <PlatformIcon platform={dist.platform} size={14} />
                    {platform?.name}
                    {dist.accountName && (
                      <span className="opacity-70">@{dist.accountName}</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>

          {canReschedule && (
            <div className="border-t border-gray-100 pt-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reschedule
              </label>
              <input
                type="datetime-local"
                value={rescheduleValue}
                onChange={(e) => setRescheduleValue(e.target.value)}
                min={toDatetimeLocalValue(new Date())}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-3"
              />
              {error && (
                <p className="text-sm text-red-600 mb-3">{error}</p>
              )}
              <Button
                onClick={handleReschedule}
                disabled={saving}
                className="w-full"
              >
                {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
                Save new schedule
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
