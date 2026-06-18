"use client";

import { useState, useEffect } from "react";
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

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [loading, setLoading] = useState(true);

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

      {connecting && (
        <div className="mb-6 bg-white rounded-2xl p-6 border border-gray-100">
          <h3 className="font-medium text-gray-900 mb-3">
            Connect{" "}
            {PLATFORMS.find((p) => p.id === connecting)?.name}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Enter your account username. In production, this would use OAuth to
            securely connect your account.
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="@yourusername"
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <Button onClick={() => connectPlatform(connecting)}>
              Connect
            </Button>
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

          return (
            <div
              key={platform.id}
              className={cn(
                "bg-white rounded-2xl p-5 border transition-all",
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
                        <Check size={12} /> {connected.length} connected
                      </p>
                    )}
                  </div>
                </div>
                {!isConnected && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConnecting(platform.id)}
                  >
                    <Plus size={14} className="mr-1" />
                    Connect
                  </Button>
                )}
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

              {isConnected && (
                <button
                  onClick={() => setConnecting(platform.id)}
                  className="text-xs text-brand-600 hover:underline mt-2"
                >
                  + Add another account
                </button>
              )}
            </div>
          );
        })}
      </div>

      {!loading && accounts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No accounts connected yet. Click &quot;Connect&quot; on any platform above.</p>
        </div>
      )}
    </div>
  );
}
