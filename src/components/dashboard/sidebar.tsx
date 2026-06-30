"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Link2,
  History,
  Workflow,
  BarChart3,
  Settings,
  Gift,
  LogOut,
  Menu,
  X,
  CalendarDays,
  Inbox,
  ClipboardCheck,
  Hash,
  Users,
  BarChart2,
  Mail,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/inbox", label: "Inbox", icon: Inbox, badge: true },
  { href: "/dashboard/approvals", label: "Approvals", icon: ClipboardCheck },
  { href: "/dashboard/upload", label: "Upload & Publish", icon: Upload },
  { href: "/dashboard/accounts", label: "Connected Accounts", icon: Link2 },
  { href: "/dashboard/workflows", label: "Workflows", icon: Workflow },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/listening", label: "Listening", icon: Hash },
  { href: "/dashboard/benchmarking", label: "Benchmarking", icon: BarChart2 },
  { href: "/dashboard/reports", label: "Reports", icon: Mail },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/affiliate", label: "Affiliate", icon: Gift },
  { href: "/dashboard/history", label: "Post History", icon: History },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar({
  userName,
  userPlan,
}: {
  userName: string;
  userPlan: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadInbox, setUnreadInbox] = useState(0);

  useEffect(() => {
    fetch("/api/inbox/unread-count")
      .then((r) => r.json())
      .then((d) => setUnreadInbox(d.unread ?? 0))
      .catch(() => {});
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b glass-divider">
        <Logo size="sm" />
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "glass-nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
                isActive
                  ? "glass-nav-item-active text-brand-700"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              <item.icon size={18} />
              {item.label}
              {"badge" in item && item.badge && unreadInbox > 0 && (
                <span className="ml-auto bg-brand-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unreadInbox > 99 ? "99+" : unreadInbox}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t glass-divider">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
          <p className="text-xs text-gray-500 capitalize">{userPlan} Plan</p>
        </div>
        <button
          onClick={handleLogout}
          className="glass-nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 w-full"
        >
          <LogOut size={18} />
          Log Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 glass rounded-lg shadow-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-40 w-64 glass-sidebar transform transition-transform lg:transform-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {sidebar}
      </aside>
    </>
  );
}
