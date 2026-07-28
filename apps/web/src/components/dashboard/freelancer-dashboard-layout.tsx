import { Link } from "@tanstack/react-router";
import { cn } from "@lets_work/ui/lib/utils";

import Logo from "@/components/marketing/logo";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { OnboardingBanner } from "@/components/dashboard/onboarding-banner";
import UserMenu from "@/components/user-menu";
import { shouldShowOnboardingBanner } from "@/lib/dashboard-paths";
import { Route } from "@/routes/dashboard/freelancer/route";

import FreelancerSidebar from "./freelancer-sidebar";

const NAV_ITEMS = [
  { label: "Find work", to: "/dashboard/freelancer" as const, exact: true },
  { label: "My proposals", to: "/dashboard/freelancer/proposals" as const, exact: false },
  { label: "Messages", to: "/dashboard/freelancer/messages" as const, exact: false },
  { label: "Contracts", to: "/dashboard/freelancer/contracts" as const, exact: false },
  { label: "Profile", to: "/dashboard/freelancer/profile" as const, exact: false },
] as const;

export default function FreelancerDashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = Route.useRouteContext();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-6 md:flex">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  className={cn("text-sm text-muted-foreground hover:text-foreground")}
                  activeProps={{ className: "text-sm font-medium text-foreground" }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <UserMenu />
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-2 py-1 md:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground",
              )}
              activeProps={{
                className: "bg-muted font-medium text-foreground",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-start gap-6 px-4 py-6 md:grid-cols-[280px_minmax(0,1fr)] md:px-6">
        <FreelancerSidebar profile={profile} />
        <main className="flex min-w-0 flex-col gap-4">
          {profile && shouldShowOnboardingBanner(profile) ? (
            <OnboardingBanner profile={profile} role="freelancer" />
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
