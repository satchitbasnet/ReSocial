import { getSession } from "@/lib/auth";
import { getDashboardStats } from "@/lib/dashboard";
import { PLANS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { DriveBackupSettings } from "@/components/settings/drive-backup-settings";
import { SettingsAlerts } from "@/components/settings/settings-alerts";
import { getDb } from "@/lib/db";
import { driveConnections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Suspense } from "react";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null;

  const stats = await getDashboardStats(session.userId);
  const plan = PLANS[stats.user?.plan as keyof typeof PLANS] ?? PLANS.trial;

  const db = getDb();
  const [drive] = await db
    .select({
      accountEmail: driveConnections.accountEmail,
      isActive: driveConnections.isActive,
    })
    .from(driveConnections)
    .where(
      and(
        eq(driveConnections.userId, session.userId),
        eq(driveConnections.isActive, true)
      )
    )
    .limit(1);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
      <p className="text-gray-600 mb-8">Manage Your Account and Subscription.</p>

      <Suspense fallback={null}>
        <SettingsAlerts />
      </Suspense>

      <div className="space-y-6">
        <div className="glass-card p-6">
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

        <div className="glass-card p-6">
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
                <span className="text-gray-500">Videos Published</span>
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

        <DriveBackupSettings
          connected={Boolean(drive?.isActive)}
          accountEmail={drive?.accountEmail ?? null}
        />
      </div>
    </div>
  );
}
