"use client";

import { useState } from "react";
import { X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { cn } from "@/lib/utils";
import {
  YOUTUBE_PERMISSION_OPTIONS,
  type YouTubePermissionTier,
} from "@/lib/platforms/youtube-permissions";

interface ConnectYouTubeModalProps {
  open: boolean;
  onClose: () => void;
}

export function ConnectYouTubeModal({ open, onClose }: ConnectYouTubeModalProps) {
  const [connectionName, setConnectionName] = useState("YouTube");
  const [permission, setPermission] =
    useState<YouTubePermissionTier>("basic");
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);

  if (!open) return null;

  function handleConnect() {
    const params = new URLSearchParams({
      permission,
      label: connectionName.trim() || "YouTube",
    });
    window.location.href = `/api/connect/youtube?${params.toString()}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 glass-overlay"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative glass-panel max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <PlatformIcon platform="youtube" size={32} />
          <h2 className="text-xl font-bold text-gray-900">YouTube</h2>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-2">
          Name this Connection
        </label>
        <input
          type="text"
          value={connectionName}
          onChange={(e) => setConnectionName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 mb-6"
        />

        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-medium text-gray-700">Permissions</span>
          <button
            type="button"
            onClick={() => setShowPermissionHelp((v) => !v)}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Permission details"
          >
            <Info size={16} />
          </button>
        </div>

        {showPermissionHelp && (
          <div className="mb-4 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 space-y-2">
            {YOUTUBE_PERMISSION_OPTIONS.map((option) => (
              <p key={option.id}>
                <span className="font-medium text-gray-900">{option.label}:</span>{" "}
                {option.description}
              </p>
            ))}
          </div>
        )}

        <div className="space-y-2 mb-6">
          {YOUTUBE_PERMISSION_OPTIONS.map((option) => (
            <label
              key={option.id}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors",
                permission === option.id
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <input
                type="radio"
                name="youtube-permission"
                value={option.id}
                checked={permission === option.id}
                onChange={() => setPermission(option.id)}
                className="mt-1"
              />
              <span className="text-sm">
                <span className="font-medium text-gray-900">
                  {option.label}
                  {option.recommended && (
                    <span className="text-gray-500 font-normal">
                      {" "}
                      (recommended)
                    </span>
                  )}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="space-y-3 mb-6 text-xs text-gray-600">
          <p className="flex gap-2">
            <Info size={14} className="shrink-0 mt-0.5 text-gray-400" />
            <span>
              Your YouTube account must be verified before you can upload videos
              longer than 15 mins.{" "}
              <a
                href="https://www.youtube.com/verify"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:underline font-medium"
              >
                Verify your YouTube account
              </a>
              .
            </span>
          </p>
          <p>
            By adding a YouTube connection, you agree to be bound to{" "}
            <a
              href="https://www.youtube.com/t/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline font-medium"
            >
              YouTube&apos;s Terms of Service
            </a>
            .
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConnect}>Connect</Button>
        </div>
      </div>
    </div>
  );
}
