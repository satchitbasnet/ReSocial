"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PLATFORMS } from "@/lib/constants";
import { PlatformIcon } from "@/components/ui/platform-icon";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConnectedAccount {
  id: string;
  platform: string;
  accountName: string;
  isActive: boolean;
  connectedAt: string;
}

const OAUTH_PLATFORMS = new Set([
  "tiktok",
  "youtube",
  "instagram",
  "facebook",
]);

function AccountsContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function loadAccounts() {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        if (data.accounts) setAccounts(data.accounts);
        setLoading(false);
      });
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected === "tiktok") {
      setBanner({
        type: "success",
        message: "TikTok account connected successfully.",
      });
    } else if (connected) {
      const name =
        PLATFORMS.find((p) => p.id === connected)?.name ?? connected;
      setBanner({
        type: "success",
        message: `${name} account connected successfully.`,
      });
    } else if (error) {
      const errorDetail = searchParams.get("error_detail");
      const messages: Record<string, string> = {
        tiktok_config:
          "TikTok is not configured. Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET.",
        youtube_config:
          "YouTube is not configured. Add YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET.",
        instagram_config:
          "Instagram is not configured. Add INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET.",
        facebook_config:
          "Facebook is not configured. Add FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET.",
        tiktok_oauth_failed: "TikTok authorization failed. Please try again.",
        youtube_oauth_failed: "YouTube authorization failed. Please try again.",
        instagram_oauth_failed:
          errorDetail ?? "Instagram authorization failed. Please try again.",
        instagram_no_business:
          "No Instagram Business or Creator account is linked to your Facebook Page. Switch to a Professional account in Instagram, then connect it to your Page in Meta Business Suite.",
        facebook_oauth_failed: "Facebook authorization failed. Please try again.",
        facebook_no_pages:
          "No Facebook Pages found. Create a Page and try again.",
        invalid_state: "Invalid OAuth state. Please try connecting again.",
        plan_limit_platforms:
          "Platform limit reached for your plan. Upgrade to connect more.",
      };
      setBanner({
        type: "error",
        message: messages[error] ?? `Connection error: ${error}`,
      });
    }
  }, [searchParams]);

  function startConnect(platformId: string) {
    if (OAUTH_PLATFORMS.has(platformId)) {
      window.location.href = `/api/connect/${platformId}`;
      return;
    }
    setConnecting(platformId);
  }

  async function connectPlatform(platformId: string) {
    if (!accountName.trim()) return;

    setConnecting(platformId);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platformId,
          accountName: accountName.trim(),
        }),
      });
      if (res.ok) {
        setAccountName("");
        setConnecting(null);
        loadAccounts();
      }
    } catch {
      setConnecting(null);
    }
  }

  async function disconnectAccount(id: string) {
    await fetch(`/api/accounts?id=${id}`, { method: "DELETE" });
    loadAccounts();
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Connected Accounts
      </h1>
      <p className="text-gray-600 mb-8">
        Connect your social media accounts to enable cross-platform distribution.
      </p>

      {banner && (
        <div
          className={cn(
            "mb-6 p-4 rounded-xl text-sm border",
            banner.type === "success"
              ? "bg-green-50 text-green-800 border-green-100"
              : "bg-red-50 text-red-800 border-red-100"
          )}
        >
          {banner.message}
        </div>
      )}

      {connecting && !OAUTH_PLATFORMS.has(connecting) && (
        <div className="mb-6 glass-card p-6">
          <h3 className="font-medium text-gray-900 mb-3">
            Connect {PLATFORMS.find((p) => p.id === connecting)?.name}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Enter your account username (demo mode for this platform).
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="@yourusername"
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <Button onClick={() => connectPlatform(connecting)}>Connect</Button>
            <Button
              variant="ghost"
              onClick={() => {
                setConnecting(null);
                setAccountName("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {PLATFORMS.map((platform) => {
          const connected = accounts.filter((a) => a.platform === platform.id);
          const isConnected = connected.length > 0;
          const usesOAuth = OAUTH_PLATFORMS.has(platform.id);

          return (
            <div
              key={platform.id}
              className={cn(
                "glass-card p-5 transition-all",
                isConnected ? "border-green-200" : "border-gray-100"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={platform.id} size={26} />
                  <div>
                    <p className="font-medium text-gray-900">{platform.name}</p>
                    {isConnected && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <Check size={12} /> {connected.length} Connected
                      </p>
                    )}
                    {usesOAuth && !isConnected && (
                      <p className="text-xs text-gray-400">OAuth</p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startConnect(platform.id)}
                >
                  <Plus size={14} className="mr-1" />
                  Connect
                </Button>
              </div>

              {connected.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg mt-2"
                >
                  <span className="text-sm text-gray-700">
                    @{account.accountName}
                  </span>
                  <button
                    onClick={() => disconnectAccount(account.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {!loading && accounts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>
            No Accounts Connected Yet. Click &quot;Connect&quot; on Any Platform
            above.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<div className="text-gray-500">Loading...</div>}>
      <AccountsContent />
    </Suspense>
  );
}
