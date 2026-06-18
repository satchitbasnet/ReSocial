import { getSession } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard";
import { PLANS } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null;

  const stats = await getDashboardStats(session.userId);
  const plan = PLANS[stats.user?.plan as keyof typeof PLANS] ?? PLANS.trial;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-600 mb-8">Manage your account and subscription.</p>

      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Account</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Name</dt>
              <dd className="text-sm font-medium text-gray-900">{session.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500">Email</dt>
              <dd className="text-sm font-medium text-gray-900">{session.email}</dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <h2 className="font-semibold text-gray-900 mb-4">Subscription</h2>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-medium text-gray-900 capitalize">
                {plan.name} Plan
              </p>
              <p className="text-sm text-gray-500">{plan.description}</p>
            </div>
            {stats.user?.plan === "trial" && (
              <span className="text-xs bg-brand-50 text-brand-700 px-3 py-1 rounded-full font-medium">
                Free Trial
              </span>
            )}
          </div>

          {stats.trialLimit && (
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-500">Videos published</span>
                <span className="font-medium">
                  {stats.videosPublished}/{stats.trialLimit}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full gradient-bg rounded-full transition-all"
                  style={{
                    width: `${Math.min((stats.videosPublished / stats.trialLimit) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          <Button href="/pricing" variant="outline">
            {stats.user?.plan === "trial" ? "Upgrade Plan" : "Change Plan"}
          </Button>
        </div>
      </div>
    </div>
  );
}
