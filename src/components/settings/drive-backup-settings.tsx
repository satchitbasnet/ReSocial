"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HardDrive, Loader2 } from "lucide-react";

interface DriveBackupSettingsProps {
  connected: boolean;
  accountEmail: string | null;
}

export function DriveBackupSettings({
  connected: initialConnected,
  accountEmail: initialEmail,
}: DriveBackupSettingsProps) {
  const [connected, setConnected] = useState(initialConnected);
  const [accountEmail, setAccountEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);

  function connect() {
    window.location.href = "/api/connect/google-drive";
  }

  async function disconnect() {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/google-drive", {
        method: "DELETE",
      });
      if (res.ok) {
        setConnected(false);
        setAccountEmail(null);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <HardDrive size={20} />
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">Google Drive Backup</h2>
          <p className="text-sm text-gray-500 mt-1">
            Automatically save a copy of every published video to a{" "}
            <span className="font-medium">ReSocial Backups</span> folder in your
            Google Drive.
          </p>
        </div>
      </div>

      {connected && accountEmail ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm text-gray-700">
            Connected as{" "}
            <span className="font-medium text-gray-900">{accountEmail}</span>
          </p>
          <Button
            variant="outline"
            onClick={disconnect}
            disabled={loading}
            className="shrink-0"
          >
            {loading && <Loader2 size={16} className="mr-2 animate-spin" />}
            Disconnect
          </Button>
        </div>
      ) : (
        <Button onClick={connect} variant="outline">
          Connect Google Drive
        </Button>
      )}
    </div>
  );
}
