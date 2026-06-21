import { redirect } from "next/navigation";
import { getSession, userExistsInDb } from "@/lib/auth";
import { DashboardSidebar } from "@/components/dashboard/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  if (!(await userExistsInDb(session.userId))) {
    redirect("/api/auth/logout");
  }

  return (
    <div className="flex min-h-screen font-sans">
      <DashboardSidebar userName={session.name} userPlan={session.plan} />
      <main className="flex-1 lg:ml-0 overflow-auto">
        <div className="p-6 lg:p-8 pt-16 lg:pt-8">{children}</div>
      </main>
    </div>
  );
}
