"use client";

import { useState, useEffect } from "react";
import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Distribution {
  id: string;
  platform: string;
  status: string;
  publishedAt: string | null;
  errorMessage: string | null;
  accountName: string | null;
}

interface Post {
  id: string;
  title: string;
  caption: string | null;
  mediaUrl: string;
  mediaType: string;
  status: string;
  createdAt: string;
  distributions: Distribution[];
}

const statusIcon = {
  published: { icon: CheckCircle, color: "text-green-500" },
  failed: { icon: XCircle, color: "text-red-500" },
  processing: { icon: Loader2, color: "text-brand-500 animate-spin" },
  pending: { icon: Clock, color: "text-gray-400" },
  scheduled: { icon: Clock, color: "text-amber-500" },
};

export default function HistoryPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/posts")
      .then((r) => r.json())
      .then((data) => {
        if (data.posts) setPosts(data.posts);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Post History</h1>
      <p className="text-gray-600 mb-8">
        Track your published content and distribution status across all platforms.
      </p>

      {posts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <p className="text-gray-500 mb-4">No Posts Yet.</p>
          <a
            href="/dashboard/upload"
            className="text-brand-600 font-medium hover:underline"
          >
            Upload your first video
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-2xl p-6 border border-gray-100"
            >
              <div className="flex gap-4">
                {post.mediaType === "video" ? (
                  <video
                    src={post.mediaUrl}
                    className="w-24 h-24 rounded-xl object-cover bg-gray-100 shrink-0"
                  />
                ) : (
                  <img
                    src={post.mediaUrl}
                    alt={post.title}
                    className="w-24 h-24 rounded-xl object-cover bg-gray-100 shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {post.title}
                  </h3>
                  {post.caption && (
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      {post.caption}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(post.createdAt).toLocaleString()}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-3">
                    {post.distributions.map((dist) => {
                      const platform = PLATFORMS.find(
                        (p) => p.id === dist.platform
                      );
                      const status =
                        statusIcon[dist.status as keyof typeof statusIcon] ||
                        statusIcon.pending;
                      const StatusIcon = status.icon;

                      return (
                        <div
                          key={dist.id}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-gray-50 border border-gray-100"
                          )}
                          title={dist.errorMessage || undefined}
                        >
                          <PlatformIcon platform={dist.platform} size={14} />
                          <span className="text-gray-600">
                            {platform?.name}
                          </span>
                          <StatusIcon size={12} className={status.color} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
