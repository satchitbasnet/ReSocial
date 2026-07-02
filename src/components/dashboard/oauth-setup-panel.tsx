"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OAuthProviderStatus {
  id: string;
  name: string;
  configured: boolean;
  missingEnv: string[];
  redirectUri: string;
  developerPortal?: string;
}

interface OAuthDiagnostics {
  appUrl: string;
  authSecretSet: boolean;
  urlEnv: {
    NEXT_PUBLIC_URL: string | null;
    NEXT_PUBLIC_APP_URL: string | null;
    mismatch: boolean;
    hint: string | null;
  };
  providers: OAuthProviderStatus[];
  summary: { configured: number; total: number; ready: boolean };
}

export function OAuthSetupPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OAuthDiagnostics | null>(null);
  const [error, setError] = useState("");

  async function runCheck() {
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/health/oauth");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load OAuth diagnostics");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Failed to load OAuth diagnostics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-8 rounded-xl border border-gray-200 bg-white/60">
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium text-gray-900">OAuth setup check</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Verify env vars and redirect URIs when a connect flow fails.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={runCheck} disabled={loading}>
            {loading ? "Checking…" : "Run check"}
          </Button>
          {data && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label={open ? "Collapse" : "Expand"}
            >
              {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          )}
        </div>
      </div>

      {open && data && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4 text-sm">
          {data.urlEnv.mismatch && data.urlEnv.hint && (
            <p className="rounded-lg bg-amber-50 border border-amber-100 text-amber-900 px-3 py-2 text-xs">
              {data.urlEnv.hint}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
            <p>
              <span className="font-medium text-gray-800">App URL:</span>{" "}
              <code className="text-xs">{data.appUrl}</code>
            </p>
            <p>
              <span className="font-medium text-gray-800">AUTH_SECRET:</span>{" "}
              {data.authSecretSet ? "set" : "missing"}
            </p>
          </div>

          <div className="space-y-3">
            {data.providers.map((provider) => (
              <div
                key={provider.id}
                className="rounded-lg border border-gray-100 bg-gray-50/80 p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-gray-900">{provider.name}</span>
                  <span
                    className={
                      provider.configured
                        ? "text-xs text-green-700"
                        : "text-xs text-red-600"
                    }
                  >
                    {provider.configured ? "Configured" : "Not configured"}
                  </span>
                </div>
                {!provider.configured && provider.missingEnv.length > 0 && (
                  <p className="text-xs text-gray-500 mb-1">
                    Missing: {provider.missingEnv.join(", ")}
                  </p>
                )}
                <p className="text-xs text-gray-600 break-all">
                  Redirect URI:{" "}
                  <code className="select-all">{provider.redirectUri}</code>
                </p>
                {provider.developerPortal && (
                  <a
                    href={provider.developerPortal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline mt-1"
                  >
                    Developer portal <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      {open && !data && error && (
        <p className="border-t border-gray-100 px-4 pb-4 pt-3 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
