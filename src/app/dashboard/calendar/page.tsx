"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Filter,
} from "lucide-react";
import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Button } from "@/components/ui/button";
import { getPlatformCalendarColor } from "@/lib/platform-colors";
import {
  type CalendarView,
  addDays,
  endOfMonth,
  formatMonthYear,
  formatWeekRange,
  fromDateKey,
  getMonthGridDays,
  getWeekDays,
  isSameDay,
  mergeDateWithTime,
  startOfMonth,
  startOfWeek,
  toDateKey,
  toDatetimeLocalValue,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";
import {
  PostDetailModal,
  type CalendarPost,
} from "@/components/calendar/post-detail-modal";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function postCardStatus(post: CalendarPost) {
  if (post.status === "scheduled") return "scheduled";
  if (post.distributions.some((d) => d.status === "failed")) return "failed";
  if (post.status === "published" || post.distributions.every((d) => d.status === "published")) {
    return "published";
  }
  return post.status;
}

function statusDotClass(status: string) {
  switch (status) {
    case "scheduled":
      return "bg-amber-400";
    case "published":
      return "bg-green-500";
    case "failed":
      return "bg-red-500";
    case "processing":
      return "bg-brand-500";
    default:
      return "bg-gray-400";
  }
}

export default function CalendarPage() {
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [posts, setPosts] = useState<CalendarPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(anchor);
      return { start, end: addDays(start, 6) };
    }
    const start = startOfWeek(startOfMonth(anchor));
    const end = addDays(start, 41);
    return { start, end: endOfMonth(anchor) > end ? endOfMonth(anchor) : end };
  }, [anchor, view]);

  const days = useMemo(
    () => (view === "week" ? getWeekDays(anchor) : getMonthGridDays(anchor)),
    [anchor, view]
  );

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: range.start.toISOString().split("T")[0],
        end: range.end.toISOString().split("T")[0],
      });
      if (platformFilter !== "all") {
        params.set("platform", platformFilter);
      }
      const res = await fetch(`/api/calendar?${params}`);
      const data = await res.json();
      if (data.posts) setPosts(data.posts);
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end, platformFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, CalendarPost[]>();
    for (const post of posts) {
      const key = toDateKey(new Date(post.calendarDate));
      const existing = map.get(key) ?? [];
      existing.push(post);
      map.set(key, existing);
    }
    return map;
  }, [posts]);

  function navigatePrev() {
    setAnchor((d) =>
      view === "week" ? addDays(d, -7) : new Date(d.getFullYear(), d.getMonth() - 1, 1)
    );
  }

  function navigateNext() {
    setAnchor((d) =>
      view === "week" ? addDays(d, 7) : new Date(d.getFullYear(), d.getMonth() + 1, 1)
    );
  }

  async function reschedulePost(post: CalendarPost, targetDay: Date) {
    const sourceDate = new Date(post.scheduledAt ?? post.calendarDate);
    const newDate = mergeDateWithTime(targetDay, sourceDate);

    if (newDate.getTime() <= Date.now()) {
      newDate.setHours(9, 0, 0, 0);
      if (newDate.getTime() <= Date.now()) {
        newDate.setDate(newDate.getDate() + 1);
      }
    }

    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: newDate.toISOString() }),
    });

    if (!res.ok) return;

    const iso = newDate.toISOString();
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, scheduledAt: iso, calendarDate: iso, status: "scheduled" }
          : p
      )
    );
  }

  function handleDrop(dayKey: string) {
    if (!draggingId) return;
    const post = posts.find((p) => p.id === draggingId);
    if (!post || !["scheduled", "draft"].includes(post.status)) return;

    reschedulePost(post, fromDateKey(dayKey));
    setDraggingId(null);
    setDropTarget(null);
  }

  function handleRescheduled(postId: string, scheduledAt: string) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              scheduledAt,
              calendarDate: scheduledAt,
              status: "scheduled",
            }
          : p
      )
    );
  }

  function newPostHref(day?: Date) {
    const base = "/dashboard/upload";
    if (!day) return base;
    const scheduled = new Date(day);
    scheduled.setHours(9, 0, 0, 0);
    return `${base}?scheduledAt=${encodeURIComponent(toDatetimeLocalValue(scheduled))}`;
  }

  const today = new Date();

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
          <p className="text-gray-600 text-sm mt-1">
            Plan, schedule, and track posts across all platforms.
          </p>
        </div>
        <Button href={newPostHref()} size="sm">
          <Plus size={16} className="mr-1.5" />
          New Post
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button
              onClick={navigatePrev}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              aria-label="Previous"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setAnchor(new Date())}
              className="px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-gray-100 text-gray-700"
            >
              Today
            </button>
            <button
              onClick={navigateNext}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              aria-label="Next"
            >
              <ChevronRight size={20} />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 ml-2">
              {view === "week" ? formatWeekRange(anchor) : formatMonthYear(anchor)}
            </h2>
            {loading && <Loader2 size={16} className="animate-spin text-brand-500 ml-2" />}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex bg-gray-100 rounded-full p-1">
              <button
                onClick={() => setView("month")}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                  view === "month" ? "bg-white shadow text-gray-900" : "text-gray-500"
                )}
              >
                Month
              </button>
              <button
                onClick={() => setView("week")}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                  view === "week" ? "bg-white shadow text-gray-900" : "text-gray-500"
                )}
              >
                Week
              </button>
            </div>

            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="pl-8 pr-8 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none"
              >
                <option value="all">All platforms</option>
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-gray-100">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-semibold text-gray-500 uppercase"
            >
              {day}
            </div>
          ))}
        </div>

        <div
          className={cn(
            "grid grid-cols-7",
            view === "month" ? "auto-rows-[minmax(110px,1fr)]" : "min-h-[420px]"
          )}
        >
          {days.map((day) => {
            const dayKey = toDateKey(day);
            const dayPosts = postsByDay.get(dayKey) ?? [];
            const inCurrentMonth = day.getMonth() === anchor.getMonth();
            const isToday = isSameDay(day, today);
            const isDropTarget = dropTarget === dayKey;

            return (
              <div
                key={dayKey}
                className={cn(
                  "border-r border-b border-gray-100 p-1.5 sm:p-2 transition-colors",
                  view === "month" && !inCurrentMonth && "bg-gray-50/60",
                  isDropTarget && "bg-brand-50 ring-2 ring-inset ring-brand-300"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropTarget(dayKey);
                }}
                onDragLeave={() => setDropTarget(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(dayKey);
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={cn(
                      "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                      isToday && "bg-brand-600 text-white",
                      !isToday && inCurrentMonth && "text-gray-900",
                      !isToday && !inCurrentMonth && "text-gray-400"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <Link
                    href={newPostHref(day)}
                    className="opacity-0 hover:opacity-100 focus:opacity-100 p-0.5 rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-opacity"
                    title="Schedule post"
                  >
                    <Plus size={14} />
                  </Link>
                </div>

                <div className="space-y-1">
                  {dayPosts.map((post) => {
                    const primaryPlatform = post.distributions[0]?.platform ?? "tiktok";
                    const colors = getPlatformCalendarColor(primaryPlatform);
                    const status = postCardStatus(post);
                    const draggable = ["scheduled", "draft"].includes(post.status);

                    return (
                      <button
                        key={post.id}
                        type="button"
                        draggable={draggable}
                        onDragStart={() => setDraggingId(post.id)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDropTarget(null);
                        }}
                        onClick={() => setSelectedPost(post)}
                        className={cn(
                          "w-full text-left rounded-lg border p-1.5 transition-shadow hover:shadow-md",
                          colors.bg,
                          colors.border,
                          draggingId === post.id && "opacity-50"
                        )}
                      >
                        <div className="flex gap-1.5">
                          {post.mediaType === "video" ? (
                            <video
                              src={post.mediaUrl}
                              className="w-8 h-8 rounded object-cover shrink-0 bg-gray-200"
                              muted
                            />
                          ) : (
                            <img
                              src={post.mediaUrl}
                              alt=""
                              className="w-8 h-8 rounded object-cover shrink-0 bg-gray-200"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-[11px] font-semibold truncate", colors.text)}>
                              {post.title}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span
                                className={cn("h-1.5 w-1.5 rounded-full", statusDotClass(status))}
                              />
                              <div className="flex -space-x-1">
                                {post.distributions.slice(0, 3).map((d) => (
                                  <span
                                    key={d.id}
                                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white border border-gray-200"
                                  >
                                    <PlatformIcon platform={d.platform} size={10} />
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Scheduled
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" /> Published
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" /> Failed
        </span>
        <span className="text-gray-400">Drag scheduled posts to reschedule</span>
      </div>

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onRescheduled={handleRescheduled}
        />
      )}
    </div>
  );
}
