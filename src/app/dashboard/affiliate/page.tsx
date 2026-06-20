"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Gift,
  Copy,
  Check,
  Loader2,
  Users,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AffiliateData {
  enrolled: boolean;
  referralCode?: string;
  referralLink?: string;
  totalReferrals: number;
  convertedReferrals: number;
  pendingReferrals: number;
  conversionRate: number;
  totalEarnings: number;
  estimatedEarnings: number;
}

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function AffiliatePage() {
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/affiliate/dashboard");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load");
        return;
      }
      setData(json);
    } catch {
      setError("Failed to load affiliate dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function enroll() {
    setEnrolling(true);
    setError("");
    try {
      const res = await fetch("/api/affiliate/signup", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Enrollment failed");
        return;
      }
      setData(json);
    } catch {
      setError("Enrollment failed");
    } finally {
      setEnrolling(false);
    }
  }

  async function copyLink() {
    if (!data?.referralLink) return;
    await navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-brand-500" size={28} />
      </div>
    );
  }

  if (!data?.enrolled) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600 mx-auto mb-6">
          <Gift size={32} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Earn 30% Referring Creators
        </h1>
        <p className="text-gray-600 mb-8">
          Join the ReSocial affiliate program. Earn 30% commission on the first
          3 months of every subscription you refer.
        </p>
        {error && (
          <p className="text-red-600 text-sm mb-4">{error}</p>
        )}
        <Button onClick={enroll} disabled={enrolling} size="lg">
          {enrolling && <Loader2 size={18} className="mr-2 animate-spin" />}
          {enrolling ? "Joining..." : "Join Affiliate Program"}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
        <Gift size={24} className="text-brand-600" />
        Affiliate Program
      </h1>
      <p className="text-gray-600 mb-8">
        Share your link and earn 30% of the first 3 months when someone
        subscribes.
      </p>

      {error && (
        <p className="text-red-600 text-sm mb-4">{error}</p>
      )}

      <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Your Referral Link
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            readOnly
            value={data.referralLink ?? ""}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700"
          />
          <Button
            type="button"
            variant="outline"
            onClick={copyLink}
            className="shrink-0"
          >
            {copied ? (
              <>
                <Check size={16} className="mr-2 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <Copy size={16} className="mr-2" />
                Copy Link
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Referral code:{" "}
          <span className="font-mono font-medium">{data.referralCode}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total Referrals"
          value={String(data.totalReferrals)}
          sub={`${data.convertedReferrals} Converted`}
          icon={Users}
          color="text-blue-600 bg-blue-50"
        />
        <StatCard
          label="Conversion Rate"
          value={`${data.conversionRate.toFixed(1)}%`}
          sub={`${data.pendingReferrals} Pending`}
          icon={TrendingUp}
          color="text-green-600 bg-green-50"
        />
        <StatCard
          label="Total Earned"
          value={formatMoney(data.totalEarnings)}
          sub={`Est. ${formatMoney(data.estimatedEarnings)} Incl. Pending`}
          icon={DollarSign}
          color="text-brand-600 bg-brand-50"
        />
      </div>

      <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 text-sm text-gray-600">
        <h2 className="font-semibold text-gray-900 mb-3">How It Works</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Share your referral link with creators and agencies.</li>
          <li>They sign up for ReSocial using your link.</li>
          <li>
            When they subscribe, you earn <strong>30%</strong> of their payment
            for the <strong>first 3 months</strong>.
          </li>
          <li>Earnings are tracked here and paid out monthly.</li>
        </ol>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: typeof Users;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={cn("p-2 rounded-lg", color)}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}
