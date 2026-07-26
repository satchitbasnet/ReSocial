"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { Check, ArrowLeft, User, Building2, Users } from "lucide-react";
import { ACCOUNT_TYPES, type AccountType, accountTypePricingHint, parseAccountTypeParam } from "@/lib/account-types";

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

    const typeFromUrl = parseAccountTypeParam(searchParams.get("type"));
    if (typeFromUrl) {
      setAccountType(typeFromUrl);
      setStep(2);
    }
  }, [searchParams]);

  function resetProfileFields() {
    setFirstName("");
    setLastName("");
    setOrganizationName("");
  }

  function selectType(type: AccountType) {
    resetProfileFields();
    setAccountType(type);
    setError("");
    setStep(2);
  }

  function goBack() {
    resetProfileFields();
    setAccountType(null);
    setStep(1);
    setError("");

    const ref = searchParams.get("ref");
    const nextUrl = ref
      ? `/signup?ref=${encodeURIComponent(ref.trim().toUpperCase())}`
      : "/signup";
    router.replace(nextUrl, { scroll: false });
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

  const inputClass =
    "w-full px-4 py-2.5 rounded-md border border-ink/15 bg-paper text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink/30";

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-ink text-paper items-center justify-center p-12 relative overflow-hidden">
        <span className="pointer-events-none absolute top-6 left-6 hud-label text-[10px] text-paper/40 flex items-center gap-1.5">
          <span className="tally-dot" style={{ width: 6, height: 6 }} />
          Call Sheet
        </span>
        <div className="max-w-md relative">
          <Logo size="lg" variant="dark" href={null} className="mb-8" />
          <p className="hud-label text-xs text-tally mb-3">Free Trial</p>
          <h2 className="font-display text-3xl font-semibold mb-4 leading-tight">
            Start your free trial
          </h2>
          <p className="text-paper/65 text-lg mb-8 leading-relaxed">
            Distribute to TikTok, YouTube, Instagram, Facebook, and X from one
            dashboard.
          </p>
          <ul className="space-y-3">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-paper/85">
                <Check size={18} className="text-tally shrink-0" />
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-lg border border-ink/10 bg-paper rounded-md p-8">
          <div className="lg:hidden mb-8">
            <Logo />
          </div>

          {step === 1 ? (
            <>
              <h1 className="font-display text-2xl font-semibold text-ink mb-2">
                How Will You Use ReSocial?
              </h1>
              <p className="text-ink/60 mb-8">
                We&apos;ll tailor your experience and pricing recommendations.
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-tally font-medium hover:underline"
                >
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
                      className="w-full text-left border border-ink/10 bg-paper rounded-md p-5 flex gap-4 items-start transition-colors hover:border-ink/25"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-ink/15 text-tally">
                        <Icon size={22} strokeWidth={1.75} />
                      </div>
                      <div>
                        <p className="font-semibold text-ink">{type.label}</p>
                        <p className="text-sm text-ink/60 mt-1">
                          {type.description}
                        </p>
                        <p className="text-xs text-tally mt-2 font-medium">
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
                className="inline-flex items-center gap-1.5 text-sm text-ink/50 hover:text-ink mb-4"
              >
                <ArrowLeft size={16} />
                Change Account Type
              </button>

              <h1 className="font-display text-2xl font-semibold text-ink mb-1">
                Create Your {selectedType?.label} Account
              </h1>
              <p className="text-sm text-tally font-medium mb-6">
                {selectedType && accountTypePricingHint(selectedType.id)}
              </p>

              {referralCode && (
                <div className="mb-6 bg-ink/[0.04] text-ink text-sm p-3 rounded-md border border-ink/10">
                  Referred by code{" "}
                  <span className="font-mono font-medium">{referralCode}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-tally/10 text-tally text-sm p-3 rounded-md border border-tally/25">
                    {error}
                  </div>
                )}

                {isCreator && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">
                        First Name <span className="text-tally">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={inputClass}
                        placeholder="Jane"
                        autoComplete="given-name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">
                        Last Name <span className="text-tally">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={inputClass}
                        placeholder="Doe"
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                )}

                {isBusiness && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-ink mb-1.5">
                        {orgLabel} <span className="text-tally">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        className={inputClass}
                        placeholder={
                          accountType === "agency"
                            ? "Bright Social Agency"
                            : "Acme Coffee Co."
                        }
                        autoComplete="organization"
                      />
                      <p className="text-xs text-ink/45 mt-1.5">
                        This name appears on your dashboard and billing.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-ink mb-1.5">
                          First Name{" "}
                          <span className="text-ink/40">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className={inputClass}
                          placeholder="Jane"
                          autoComplete="given-name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink mb-1.5">
                          Last Name{" "}
                          <span className="text-ink/40">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className={inputClass}
                          placeholder="Doe"
                          autoComplete="family-name"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Email <span className="text-tally">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">
                    Password <span className="text-tally">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                  />
                </div>

                <Button type="submit" variant="accent" className="w-full" disabled={loading}>
                  {loading ? "Creating Account..." : "Start 14-Day Free Trial"}
                </Button>

                <p className="text-xs text-ink/45 text-center">
                  By signing up, you agree to our Terms of Service and Privacy
                  Policy.
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
