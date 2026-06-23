"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { Check, ArrowLeft, User, Building2, Users } from "lucide-react";
import { ACCOUNT_TYPES, type AccountType, accountTypePricingHint } from "@/lib/account-types";

const REFERRAL_STORAGE_KEY = "resocial_referral_code";

const TYPE_ICONS = {
  creator: User,
  small_business: Building2,
  agency: Users,
} as const;

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<1 | 2>(1);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isCreator = accountType === "creator";
  const isBusiness = accountType === "small_business" || accountType === "agency";
  const orgLabel =
    accountType === "agency" ? "Agency Name" : "Business Name";

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      const code = ref.trim().toUpperCase();
      setReferralCode(code);
      sessionStorage.setItem(REFERRAL_STORAGE_KEY, code);
    } else {
      const stored = sessionStorage.getItem(REFERRAL_STORAGE_KEY);
      if (stored) setReferralCode(stored);
    }
  }, [searchParams]);

  function selectType(type: AccountType) {
    setAccountType(type);
    setError("");
    setStep(2);
  }

  function goBack() {
    setStep(1);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountType) return;

    setError("");
    setLoading(true);

    try {
      const payload =
        accountType === "creator"
          ? {
              accountType,
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email,
              password,
              ...(referralCode ? { referralCode } : {}),
            }
          : {
              accountType,
              organizationName: organizationName.trim(),
              ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
              ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
              email,
              password,
              ...(referralCode ? { referralCode } : {}),
            };

      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }
      sessionStorage.removeItem(REFERRAL_STORAGE_KEY);
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const perks = [
    "14-Day Free Trial",
    "10 Videos Free, No Credit Card",
    "All Platform Integrations",
    "Auto-Resize & Scheduling",
  ];

  const selectedType = ACCOUNT_TYPES.find((t) => t.id === accountType);

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 gradient-bg items-center justify-center p-12">
        <div className="text-white max-w-md">
          <Logo size="lg" variant="light" href={null} className="mb-8" />
          <h2 className="font-display text-3xl font-bold mb-4">Start Your Free Trial</h2>
          <p className="text-white/80 text-lg mb-8">
            Join thousands distributing content across every major social platform.
          </p>
          <ul className="space-y-3">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-white/90">
                <Check size={18} className="text-green-300" />
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="glass-panel w-full max-w-lg p-8">
          <div className="lg:hidden mb-8">
            <Logo />
          </div>

          {step === 1 ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                How Will You Use ReSocial?
              </h1>
              <p className="text-gray-600 mb-8">
                We&apos;ll tailor your experience and pricing recommendations.
                Already have an account?{" "}
                <Link href="/login" className="text-brand-600 font-medium hover:underline">
                  Log In
                </Link>
              </p>

              <div className="space-y-3">
                {ACCOUNT_TYPES.map((type) => {
                  const Icon = TYPE_ICONS[type.id];
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => selectType(type.id)}
                      className="w-full text-left glass-card glass-card-interactive p-5 flex gap-4 items-start"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <Icon size={22} />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{type.label}</p>
                        <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                        <p className="text-xs text-brand-600 mt-2 font-medium">
                          {accountTypePricingHint(type.id)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4"
              >
                <ArrowLeft size={16} />
                Change Account Type
              </button>

              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                Create Your {selectedType?.label} Account
              </h1>
              <p className="text-sm text-brand-600 font-medium mb-6">
                {selectedType && accountTypePricingHint(selectedType.id)}
              </p>

              {referralCode && (
                <div className="mb-6 bg-brand-50 text-brand-800 text-sm p-3 rounded-xl border border-brand-100">
                  Referred by code{" "}
                  <span className="font-mono font-medium">{referralCode}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-100">
                    {error}
                  </div>
                )}

                {isCreator && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="glass-input"
                        placeholder="Jane"
                        autoComplete="given-name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="glass-input"
                        placeholder="Doe"
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                )}

                {isBusiness && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {orgLabel} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        className="glass-input"
                        placeholder={
                          accountType === "agency"
                            ? "Bright Social Agency"
                            : "Acme Coffee Co."
                        }
                        autoComplete="organization"
                      />
                      <p className="text-xs text-gray-500 mt-1.5">
                        This name appears on your dashboard and billing.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          First Name <span className="text-gray-400">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="glass-input"
                          placeholder="Jane"
                          autoComplete="given-name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Last Name <span className="text-gray-400">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="glass-input"
                          placeholder="Doe"
                          autoComplete="family-name"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="glass-input"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="glass-input"
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating Account..." : "Start 14-Day Free Trial"}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  By signing up, you agree to our Terms of Service and Privacy Policy.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SignupForm />
    </Suspense>
  );
}
