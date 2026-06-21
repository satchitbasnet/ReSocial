"use client";

import { useCallback, useEffect, useState } from "react";
import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Button } from "@/components/ui/button";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { cn } from "@/lib/utils";
import {
  Inbox,
  RefreshCw,
  Send,
  Loader2,
  CheckCircle2,
  MessageSquare,
  Bookmark,
  Trash2,
} from "lucide-react";

interface InboxMessage {
  id: string;
  platform: string;
  type: string;
  authorName: string;
  authorAvatar: string | null;
  content: string;
  postId: string | null;
  postTitle: string | null;
  platformPostId: string | null;
  isRead: boolean;
  isReplied: boolean;
  repliedAt: string | null;
  assignedToUserId: string | null;
  receivedAt: string;
}

interface SavedReply {
  id: string;
  title: string;
  content: string;
}

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [selected, setSelected] = useState<InboxMessage | null>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [userPlan] = useState("trial");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const [platformFilter, setPlatformFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [newReplyTitle, setNewReplyTitle] = useState("");
  const [newReplyContent, setNewReplyContent] = useState("");

  const loadMessages = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (platformFilter !== "all") params.set("platform", platformFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);

    const res = await fetch(`/api/inbox?${params}`);
    const data = await res.json();
    if (data.messages) setMessages(data.messages);
    setLoading(false);
  }, [platformFilter, typeFilter, statusFilter]);

  useEffect(() => {
    loadMessages();
    fetch("/api/inbox/saved-replies")
      .then((r) => r.json())
      .then((d) => d.replies && setSavedReplies(d.replies));
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(() => {
        /* plan from session would need dedicated endpoint; infer from accounts response if added */
      });
  }, [loadMessages]);

  async function handleSync() {
    setSyncing(true);
    setError("");
    try {
      const res = await fetch("/api/inbox/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sync failed");
        return;
      }
      await loadMessages();
    } finally {
      setSyncing(false);
    }
  }

  async function selectMessage(msg: InboxMessage) {
    setSelected(msg);
    setReplyText("");
    if (!msg.isRead) {
      await fetch(`/api/inbox/${msg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m))
      );
    }
  }

  async function handleReply() {
    if (!selected || !replyText.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: selected.id, text: replyText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Reply failed");
        return;
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === selected.id
            ? { ...m, isReplied: true, isRead: true, repliedAt: new Date().toISOString() }
            : m
        )
      );
      setSelected((s) =>
        s ? { ...s, isReplied: true, isRead: true, repliedAt: new Date().toISOString() } : s
      );
      setReplyText("");
    } finally {
      setSending(false);
    }
  }

  async function saveTemplate() {
    if (!newReplyTitle.trim() || !newReplyContent.trim()) return;
    const res = await fetch("/api/inbox/saved-replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newReplyTitle, content: newReplyContent }),
    });
    const data = await res.json();
    if (data.reply) {
      setSavedReplies((prev) => [data.reply, ...prev]);
      setNewReplyTitle("");
      setNewReplyContent("");
    }
  }

  async function deleteTemplate(id: string) {
    await fetch(`/api/inbox/saved-replies?id=${id}`, { method: "DELETE" });
    setSavedReplies((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unified Inbox</h1>
          <p className="text-gray-600 text-sm mt-1">
            Comments and mentions from all connected platforms in one place.
          </p>
        </div>
        <Button onClick={handleSync} disabled={syncing} size="sm" variant="outline">
          {syncing ? (
            <Loader2 size={16} className="mr-1.5 animate-spin" />
          ) : (
            <RefreshCw size={16} className="mr-1.5" />
          )}
          Sync inbox
        </Button>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase">Filters</p>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2"
            >
              <option value="all">All Platforms</option>
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2"
            >
              <option value="all">All Types</option>
              <option value="comment">Comments</option>
              <option value="dm">DMs</option>
              <option value="mention">Mentions</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2"
            >
              <option value="all">All Status</option>
              <option value="unread">Unread</option>
              <option value="replied">Replied</option>
            </select>
          </div>

          <div className="glass-card p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center gap-1.5">
              <Bookmark size={14} /> Saved replies
            </p>
            <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
              {savedReplies.length === 0 && (
                <p className="text-xs text-gray-400">No Templates Yet</p>
              )}
              {savedReplies.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start justify-between gap-2 text-sm bg-gray-50 rounded-lg p-2"
                >
                  <button
                    type="button"
                    onClick={() => setReplyText(r.content)}
                    className="text-left flex-1 hover:text-brand-600"
                  >
                    <span className="font-medium text-gray-800">{r.title}</span>
                    <p className="text-xs text-gray-500 truncate">{r.content}</p>
                  </button>
                  <button
                    onClick={() => deleteTemplate(r.id)}
                    className="text-gray-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <input
              value={newReplyTitle}
              onChange={(e) => setNewReplyTitle(e.target.value)}
              placeholder="Template name"
              className="w-full text-sm rounded-lg border border-gray-200 px-3 py-1.5 mb-2"
            />
            <textarea
              value={newReplyContent}
              onChange={(e) => setNewReplyContent(e.target.value)}
              placeholder="Thanks for watching! 🙏"
              rows={2}
              className="w-full text-sm rounded-lg border border-gray-200 px-3 py-1.5 mb-2 resize-none"
            />
            <Button size="sm" variant="outline" className="w-full" onClick={saveTemplate}>
              Save template
            </Button>
          </div>
        </div>

        <div className="lg:col-span-2 grid md:grid-cols-2 gap-4 min-h-[480px]">
          <div className="glass-card overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <Inbox size={18} className="text-brand-600" />
              <span className="font-semibold text-gray-900">Messages</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="animate-spin text-brand-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <MessageSquare size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">No Messages Yet.</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Publish content, then sync to pull comments from Instagram, Facebook, and YouTube.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <button
                    key={msg.id}
                    type="button"
                    onClick={() => selectMessage(msg)}
                    className={cn(
                      "w-full text-left p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors",
                      selected?.id === msg.id && "bg-brand-50",
                      !msg.isRead && "bg-brand-50/40"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {msg.authorAvatar ? (
                        <img
                          src={msg.authorAvatar}
                          alt=""
                          className="w-9 h-9 rounded-full shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {msg.authorName}
                          </span>
                          <PlatformIcon platform={msg.platform} size={14} />
                          {msg.isReplied && (
                            <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate mt-0.5">{msg.content}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(msg.receivedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="glass-card flex flex-col">
            {selected ? (
              <>
                <div className="p-4 border-b border-gray-100 flex-1 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-3">
                    <PlatformIcon platform={selected.platform} size={18} />
                    <span className="font-semibold text-gray-900">{selected.authorName}</span>
                    <span className="text-xs text-gray-400 capitalize">{selected.type}</span>
                  </div>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{selected.content}</p>
                  {selected.postTitle && (
                    <p className="text-xs text-gray-400 mt-3">
                      On post: <span className="font-medium">{selected.postTitle}</span>
                    </p>
                  )}
                  {selected.isReplied && (
                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Replied
                    </p>
                  )}
                </div>
                {!selected.isReplied && (
                  <div className="p-4 border-t border-gray-100">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      placeholder="Write your reply..."
                      className="w-full text-sm rounded-xl border border-gray-200 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500 mb-3"
                    />
                    <Button
                      onClick={handleReply}
                      disabled={sending || !replyText.trim()}
                      className="w-full"
                      size="sm"
                    >
                      {sending ? (
                        <Loader2 size={16} className="mr-1.5 animate-spin" />
                      ) : (
                        <Send size={16} className="mr-1.5" />
                      )}
                      Send reply
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-8 text-center">
                Select a message to view and reply
              </div>
            )}
          </div>
        </div>
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        limit="platforms"
        currentPlan={userPlan}
      />
    </div>
  );
}
