"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, ClipboardCheck } from "lucide-react";
import { PlatformIcon } from "@/components/ui/platform-icon";

interface ApprovalRow {
  approvalId: string;
  postId: string;
  title: string;
  caption: string | null;
  mediaType: string;
  scheduledAt: string | null;
  createdAt: string;
  distributions: { platform: string; accountName: string | null }[];
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  function load() {
    fetch("/api/approvals")
      .then((r) => r.json())
      .then((d) => {
        setApprovals(d.approvals ?? []);
        setCanReview(d.canReview ?? false);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function review(postId: string, action: "approve" | "reject") {
    setActing(postId);
    await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, action }),
    });
    setActing(null);
    load();
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Content Approvals</h1>
      <p className="text-gray-600 mb-8">
        Hootsuite-style approval queue. Editors submit posts; admins approve before
        they publish or go live on the calendar.
      </p>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : !canReview ? (
        <div className="glass-card p-8 text-center text-gray-600">
          <ClipboardCheck className="mx-auto mb-3 text-gray-300" size={40} />
          <p>Only workspace admins see the approval queue.</p>
          <p className="text-sm mt-2">
            Editors: your posts are sent for review automatically.
          </p>
        </div>
      ) : approvals.length === 0 ? (
        <div className="glass-card p-8 text-center text-gray-500">
          No posts waiting for approval.
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((row) => (
            <div key={row.approvalId} className="glass-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{row.title}</h3>
                  {row.caption && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {row.caption}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {row.distributions.map((d) => (
                      <span
                        key={d.platform}
                        className="inline-flex items-center gap-1 text-xs bg-gray-50 border px-2 py-1 rounded-lg"
                      >
                        <PlatformIcon platform={d.platform} size={14} />
                        {d.accountName ?? d.platform}
                      </span>
                    ))}
                  </div>
                  {row.scheduledAt && (
                    <p className="text-xs text-amber-700 mt-2">
                      Scheduled: {new Date(row.scheduledAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={acting === row.postId}
                    onClick={() => review(row.postId, "reject")}
                  >
                    {acting === row.postId ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <XCircle size={14} className="mr-1 text-red-500" />
                    )}
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={acting === row.postId}
                    onClick={() => review(row.postId, "approve")}
                  >
                    {acting === row.postId ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={14} className="mr-1" />
                    )}
                    Approve
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
