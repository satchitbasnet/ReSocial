"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export function SettingsAlerts() {
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected === "google_drive") {
      setBanner({
        type: "success",
        message: "Google Drive backup connected successfully.",
      });
    } else if (error) {
      const messages: Record<string, string> = {
        google_drive_config:
          "Google Drive is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
        google_drive_oauth_failed:
          "Google Drive authorization failed. Please try again.",
        google_drive_no_refresh:
          "Google did not return a refresh token. Revoke app access in your Google account and reconnect.",
        invalid_state: "Invalid OAuth state. Please try again.",
        session_expired: "Session expired. Log in and try again.",
      };
      setBanner({
        type: "error",
        message: messages[error] ?? `Connection error: ${error}`,
      });
    }
  }, [searchParams]);

  if (!banner) return null;

  return (
    <div
      className={`mb-6 text-sm p-4 rounded-xl border ${
        banner.type === "success"
          ? "bg-green-50 text-green-800 border-green-100"
          : "bg-red-50 text-red-700 border-red-100"
      }`}
    >
      {banner.message}
    </div>
  );
}
