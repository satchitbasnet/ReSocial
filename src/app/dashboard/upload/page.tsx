"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PLATFORMS, PLATFORM_CAPTION_LIMITS, type PlatformId } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Upload, Check, Loader2, X } from "lucide-react";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { cn } from "@/lib/utils";

interface ConnectedAccount {
  id: string;
  platform: string;
  accountName: string;
  isActive: boolean;
}

export default function UploadPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [sameCaption, setSameCaption] = useState(true);
  const [platformCaptions, setPlatformCaptions] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [upgradeModal, setUpgradeModal] = useState<{
    open: boolean;
    limit: "videos" | "platforms";
  }>({ open: false, limit: "videos" });

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        if (data.accounts) {
          setAccounts(data.accounts);
          setSelectedPlatforms(
            data.accounts.map((a: ConnectedAccount) => a.platform)
          );
        }
      });

    const params = new URLSearchParams(window.location.search);
    const scheduled = params.get("scheduledAt");
    if (scheduled) {
      setPublishNow(false);
      setScheduleDate(scheduled.slice(0, 16));
    }
    const hashtag = params.get("hashtag");
    if (hashtag) {
      const tag = hashtag.startsWith("#") ? hashtag : `#${hashtag}`;
      setCaption((c) => (c ? `${c} ${tag}` : tag));
    }
  }, []);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setError("");
    if (f.type.startsWith("video/")) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(URL.createObjectURL(f));
    }
  }, []);

  function handleCaptionChange(value: string) {
    setCaption(value);
    if (sameCaption) {
      const next: Record<string, string> = {};
      selectedPlatforms.forEach((p) => {
        next[p] = value;
      });
      setPlatformCaptions(next);
    }
  }

  function handlePlatformCaptionChange(platformId: string, value: string) {
    setPlatformCaptions((prev) => ({ ...prev, [platformId]: value }));
  }

  function togglePlatform(platformId: string) {
    const hasAccount = accounts.some((a) => a.platform === platformId);
    if (!hasAccount) return;

    setSelectedPlatforms((prev) => {
      const next = prev.includes(platformId)
        ? prev.filter((p) => p !== platformId)
        : [...prev, platformId];
      if (sameCaption) {
        const caps: Record<string, string> = {};
        next.forEach((p) => {
          caps[p] = caption;
        });
        setPlatformCaptions(caps);
      } else if (!prev.includes(platformId)) {
        setPlatformCaptions((c) => ({
          ...c,
          [platformId]: c[platformId] ?? caption,
        }));
      }
      return next;
    });
  }

  async function handlePublish() {
    if (!file || !title || selectedPlatforms.length === 0) {
      setError("Please add a file, title, and select at least one platform.");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        setError("File too large. Maximum size is 500MB.");
        return;
      }

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          contentLength: file.size,
        }),
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        if (uploadData.upgradeRequired) {
          setUpgradeModal({ open: true, limit: uploadData.limit ?? "videos" });
        }
        setError(uploadData.error || "Upload failed");
        return;
      }

      const putRes = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": uploadData.contentType },
        body: file,
      });

      if (!putRes.ok) {
        setError("Failed to upload file to storage. Please try again.");
        return;
      }

      setUploading(false);
      setPublishing(true);

      const postRes = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          caption,
          captions: Object.fromEntries(
            selectedPlatforms.map((p) => [
              p,
              (sameCaption ? caption : platformCaptions[p]) || caption,
            ])
          ),
          mediaUrl: uploadData.mediaUrl,
          mediaType: uploadData.mediaType,
          platformIds: selectedPlatforms,
          scheduledAt: !publishNow && scheduleDate ? scheduleDate : undefined,
        }),
      });
      const postData = await postRes.json();

      if (!postRes.ok) {
        if (postData.upgradeRequired) {
          setUpgradeModal({ open: true, limit: postData.limit ?? "videos" });
        }
        setError(postData.error || "Publishing failed");
        return;
      }

      setSuccess(true);
      setTimeout(
        () =>
          router.push(
            !publishNow && scheduleDate ? "/dashboard/calendar" : "/dashboard/history"
          ),
        2000
      );
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setUploading(false);
      setPublishing(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mx-auto mb-4">
          <Check size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Published!</h2>
        <p className="text-gray-600">
          Your content is being distributed to {selectedPlatforms.length}{" "}
          platform{selectedPlatforms.length > 1 ? "s" : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Upload & Publish</h1>
      <p className="text-gray-600 mb-8">
        Upload your content once and distribute it to all connected platforms.
      </p>

      {error && (
        <div className="mb-6 bg-red-50 text-red-700 text-sm p-4 rounded-xl border border-red-100 flex items-center gap-2">
          <X size={16} />
          {error}
        </div>
      )}

      {accounts.length === 0 && (
        <div className="mb-6 bg-amber-50 text-amber-800 text-sm p-4 rounded-xl border border-amber-100">
          No accounts connected yet.{" "}
          <a href="/dashboard/accounts" className="font-medium underline">
            Connect your social accounts
          </a>{" "}
          before publishing.
        </div>
      )}

      <div
        className={cn(
          "border-2 border-dashed rounded-2xl p-12 text-center transition-colors mb-6",
          dragOver ? "border-brand-500 bg-brand-50" : "border-gray-200",
          file && "border-green-300 bg-green-50/50"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
      >
        {preview ? (
          <div className="space-y-4">
            {file?.type.startsWith("video/") ? (
              <video
                src={preview}
                controls
                className="max-h-64 mx-auto rounded-xl"
              />
            ) : (
              <img
                src={preview}
                alt="Preview"
                className="max-h-64 mx-auto rounded-xl"
              />
            )}
            <p className="text-sm text-gray-600">{file?.name}</p>
            <button
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
              className="text-sm text-red-600 hover:underline"
            >
              Remove file
            </button>
          </div>
        ) : (
          <>
            <Upload size={40} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-700 font-medium mb-1">
              Drag & drop your video or image
            </p>
            <p className="text-sm text-gray-500 mb-4">MP4, MOV, WebM, JPEG, PNG, GIF — up to 500MB</p>
            <label className="cursor-pointer">
              <span className="text-brand-600 font-medium hover:underline">
                Browse files
              </span>
              <input
                type="file"
                className="hidden"
                accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/gif"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
          </>
        )}
      </div>

      <div className="space-y-5 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="My awesome video"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Caption / Description
          </label>
          <textarea
            value={caption}
            onChange={(e) => handleCaptionChange(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            placeholder="Write a caption for your post..."
          />
          <p className="text-xs text-gray-400 mt-1">
            {caption.length} characters (default for all platforms)
          </p>
        </div>
      </div>

      {selectedPlatforms.length > 0 && (
        <div className="mb-8 bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <label className="text-sm font-medium text-gray-700">
              Per-platform captions
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={sameCaption}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSameCaption(checked);
                  if (checked) {
                    const caps: Record<string, string> = {};
                    selectedPlatforms.forEach((p) => {
                      caps[p] = caption;
                    });
                    setPlatformCaptions(caps);
                  }
                }}
              />
              Use same caption for all
            </label>
          </div>
          {!sameCaption && (
            <div className="space-y-4">
              {selectedPlatforms.map((platformId) => {
                const platform = PLATFORMS.find((p) => p.id === platformId);
                const limit =
                  PLATFORM_CAPTION_LIMITS[platformId as PlatformId] ?? 2200;
                const text = platformCaptions[platformId] ?? caption;
                return (
                  <div key={platformId}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <PlatformIcon platform={platformId} size={16} />
                      <span className="text-sm font-medium text-gray-700">
                        {platform?.name}
                      </span>
                      <span
                        className={cn(
                          "text-xs ml-auto",
                          text.length > limit ? "text-red-500" : "text-gray-400"
                        )}
                      >
                        {text.length}/{limit}
                      </span>
                    </div>
                    <textarea
                      value={text}
                      onChange={(e) =>
                        handlePlatformCaptionChange(platformId, e.target.value)
                      }
                      rows={2}
                      maxLength={limit}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                      placeholder={`Caption for ${platform?.name}...`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="mb-8 bg-white rounded-2xl p-5 border border-gray-100">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          When to publish
        </label>
        <div className="flex flex-col sm:flex-row gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              checked={publishNow}
              onChange={() => setPublishNow(true)}
            />
            Publish immediately
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              checked={!publishNow}
              onChange={() => setPublishNow(false)}
            />
            Schedule for later
          </label>
        </div>
        {!publishNow && (
          <input
            type="datetime-local"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="mt-3 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        )}
      </div>

      <div className="mb-8">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Distribute to platforms
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PLATFORMS.map((platform) => {
            const connected = accounts.some((a) => a.platform === platform.id);
            const selected = selectedPlatforms.includes(platform.id);
            return (
              <button
                key={platform.id}
                type="button"
                disabled={!connected}
                onClick={() => togglePlatform(platform.id)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                  !connected && "opacity-40 cursor-not-allowed",
                  selected
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <PlatformIcon platform={platform.id} size={26} />
                <span className="text-xs font-medium text-gray-700">
                  {platform.name}
                </span>
                {selected && (
                  <Check size={14} className="text-brand-600" />
                )}
                {!connected && (
                  <span className="text-[10px] text-gray-400">Not connected</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Button
        onClick={handlePublish}
        disabled={uploading || publishing || !file || !title}
        className="w-full md:w-auto"
        size="lg"
      >
        {(uploading || publishing) && (
          <Loader2 size={18} className="mr-2 animate-spin" />
        )}
        {uploading
          ? "Uploading..."
          : publishing
            ? "Publishing to platforms..."
            : `Publish to ${selectedPlatforms.length} platform${selectedPlatforms.length !== 1 ? "s" : ""}`}
      </Button>

      <UpgradeModal
        open={upgradeModal.open}
        onClose={() => setUpgradeModal({ open: false, limit: "videos" })}
        limit={upgradeModal.limit}
        currentPlan="trial"
      />
    </div>
  );
}
