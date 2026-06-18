"use client";

import { X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  limit: "videos" | "platforms";
  currentPlan: string;
}

export function UpgradeModal({
  open,
  onClose,
  limit,
  currentPlan,
}: UpgradeModalProps) {
  if (!open) return null;

  const limitMessage =
    limit === "videos"
      ? "You've used all 10 trial videos."
      : "You've reached your platform connection limit.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 mb-4">
          <Zap size={24} />
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Upgrade to keep growing
        </h2>
        <p className="text-gray-600 text-sm mb-1">
          Current plan: <span className="font-medium capitalize">{currentPlan}</span>
        </p>
        <p className="text-gray-600 text-sm mb-6">{limitMessage}</p>

        <ul className="space-y-2 mb-6 text-sm text-gray-700">
          <li>✓ Unlimited posts on Pro</li>
          <li>✓ All platforms + full analytics</li>
          <li>✓ Best-time-to-post insights</li>
          <li>✓ Follower growth tracking</li>
        </ul>

        <Button href="/pricing" className="w-full" onClick={onClose}>
          View plans — from $12/mo
        </Button>
      </div>
    </div>
  );
}
