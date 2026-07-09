"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface OAuthPlatformStatus {
  id: string;
  name: string;
  configured: boolean;
  missingEnv: string[];
  redirectUri: string;
  notes: string[];
}

interface OAuthDiagnostics {
  appUrl: string;
  urlEnv: {
    NEXT_PUBLIC_URL: string | null;
    NEXT_PUBLIC_APP_URL: string | null;
    resolvedFrom: string;
  };
  platforms: OAuthPlatformStatus[];
  configuredCount: number;
  totalCount: number;
  checklist: string[];
}

export function OAuthSetupHelp() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<OAuthDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || data) return;
    setLoading(true);
    fetch("/api/oauth/status")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load OAuth status");
        return res.json() as Promise<OAuthDiagnostics>;
      })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, data]);

  return (
    <div className="mb-8 rounded-xl border border-amber-100 bg-amber-50/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-amber-950"
      >
        OAuth not working? Open setup checklist
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <div className="border-t border-amber-100 px-4 py-4 text-sm text-amber-950">
          {loading && <p>Loading configuration status...</p>}
          {error && <p className="text-red-700">{error}</p>}
          {data && (
            <div className="space-y-4">
              <p>
                App URL: <code className="text-xs">{data.appUrl}</code>{" "}
                <span className="text-amber-800">
                  (from {data.urlEnv.resolvedFrom})
                </span>
              </p>
              <p>
                {data.configuredCount} of {data.totalCount} OAuth providers
                have credentials set on this server.
              </p>

              <ul className="list-disc space-y-1 pl-5 text-amber-900">
                {data.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <div className="space-y-3">
                {data.platforms.map((platform) => (
                  <div
                    key={platform.id}
                    className="rounded-lg border border-amber-100 bg-white/70 p-3"
                  >
                    <p className="font-medium">
                      {platform.name}{" "}
                      <span
                        className={
                          platform.configured
                            ? "text-green-700"
                            : "text-red-700"
                        }
                      >
                        {platform.configured ? "configured" : "missing env vars"}
                      </span>
                    </p>
                    {!platform.configured && (
                      <p className="mt-1 text-xs text-red-700">
                        Set: {platform.missingEnv.join(", ")}
                      </p>
                    )}
                    <p className="mt-2 break-all text-xs text-gray-700">
                      Redirect URI: <code>{platform.redirectUri}</code>
                    </p>
                    <ul className="mt-2 list-disc pl-4 text-xs text-gray-600">
                      {platform.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
