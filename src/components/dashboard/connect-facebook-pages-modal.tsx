"use client";

import { useEffect, useState } from "react";
import { X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { cn } from "@/lib/utils";

interface FacebookPageOption {
  pageId: string;
  displayName: string;
  followerCount: number;
}

interface ConnectFacebookPagesModalProps {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}

export function ConnectFacebookPagesModal({
  open,
  onClose,
  onConnected,
}: ConnectFacebookPagesModalProps) {
  const [pages, setPages] = useState<FacebookPageOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [connectionName, setConnectionName] = useState("Facebook");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError("");
    fetch("/api/connect/facebook/pages")
      .then((r) => r.json())
      .then((data) => {
        if (data.pages) {
          setPages(data.pages);
          setSelected(data.pages.map((p: FacebookPageOption) => p.pageId));
        } else {
          setError(data.error || "Failed to load Pages");
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load Pages");
        setLoading(false);
      });
  }, [open]);

  if (!open) return null;

  function togglePage(pageId: string) {
    setSelected((prev) =>
      prev.includes(pageId)
        ? prev.filter((id) => id !== pageId)
        : [...prev, pageId]
    );
  }

  async function handleConnect() {
    if (selected.length === 0) return;
    setConnecting(true);
    setError("");

    try {
      const res = await fetch("/api/connect/facebook/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageIds: selected,
          label: connectionName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to connect");
        return;
      }
      onConnected();
      onClose();
    } catch {
      setError("Failed to connect");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 glass-overlay" onClick={onClose} aria-hidden />
      <div className="relative glass-panel max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <PlatformIcon platform="facebook" size={32} />
          <h2 className="text-xl font-bold text-gray-900">Connect Facebook Pages</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Select the Facebook Pages you want to use as sources or destinations.
          Personal profiles and groups are not supported — only Pages where you
          are an admin.
        </p>

        <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-3 text-xs text-amber-900 mb-4 flex gap-2">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>
            Nothing will be posted unless you create a workflow or publish
            manually. Keep all permissions enabled on Meta&apos;s authorization
            screen for best results.
          </span>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-2">
          Name this Connection (optional)
        </label>
        <input
          type="text"
          value={connectionName}
          onChange={(e) => setConnectionName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-4"
        />

        {loading ? (
          <p className="text-sm text-gray-500 py-6 text-center">Loading Pages…</p>
        ) : error ? (
          <p className="text-sm text-red-600 py-4">{error}</p>
        ) : (
          <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
            {pages.map((page) => (
              <label
                key={page.pageId}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border cursor-pointer",
                  selected.includes(page.pageId)
                    ? "border-brand-500 bg-brand-50/50"
                    : "border-gray-200"
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(page.pageId)}
                  onChange={() => togglePage(page.pageId)}
                />
                <span className="text-sm">
                  <span className="font-medium text-gray-900">
                    {page.displayName}
                  </span>
                  <span className="text-gray-500 ml-2">
                    {page.followerCount.toLocaleString()} followers
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={connecting || selected.length === 0 || loading}
          >
            {connecting ? "Connecting…" : "Connect"}
          </Button>
        </div>
      </div>
    </div>
  );
}
