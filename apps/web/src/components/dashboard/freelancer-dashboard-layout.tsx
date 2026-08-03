import { Link } from "@tanstack/react-router";
import { cn } from "@lets_work/ui/lib/utils";

import { EmailVerificationBanner } from "@/components/dashboard/email-verification-banner";
import { MessagesNavLink } from "@/components/chat/messages-nav-link";
import Logo from "@/components/marketing/logo";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { OnboardingBanner } from "@/components/dashboard/onboarding-banner";
import UserMenu from "@/components/user-menu";
import { shouldShowOnboardingBanner } from "@/lib/dashboard-paths";
import { Route } from "@/routes/dashboard/freelancer/route";

import FreelancerSidebar from "./freelancer-sidebar";

const linkClass = "text-sm text-muted-foreground hover:text-foreground";
const linkActiveClass = "text-sm font-medium text-foreground";
const mobileLinkClass =
  "shrink-0 rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground";
const mobileLinkActiveClass = "bg-muted font-medium text-foreground";

export default function FreelancerDashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = Route.useRouteContext();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden items-center gap-6 md:flex">
              <Link
                to="/dashboard/freelancer"
                activeOptions={{ exact: true }}
                className={linkClass}
                activeProps={{ className: linkActiveClass }}
              >
                Find work
              </Link>
              <Link
                to="/dashboard/freelancer/proposals"
                className={linkClass}
                activeProps={{ className: linkActiveClass }}
              >
                My proposals
              </Link>
              <MessagesNavLink
                to="/dashboard/freelancer/messages"
                className={linkClass}
                activeClassName={linkActiveClass}
              />
              <Link
                to="/dashboard/freelancer/contracts"
                className={linkClass}
                activeProps={{ className: linkActiveClass }}
              >
                Contracts
              </Link>
              <Link
                to="/dashboard/freelancer/payments"
                className={linkClass}
                activeProps={{ className: linkActiveClass }}
              >
                Payments
              </Link>
              <Link
                to="/dashboard/freelancer/profile"
                className={linkClass}
                activeProps={{ className: linkActiveClass }}
              >
                Profile
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <UserMenu />
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-2 py-1 md:hidden">
          <Link
            to="/dashboard/freelancer"
            activeOptions={{ exact: true }}
            className={mobileLinkClass}
            activeProps={{ className: cn(mobileLinkClass, mobileLinkActiveClass) }}
          >
            Find work
          </Link>
          <Link
            to="/dashboard/freelancer/proposals"
            className={mobileLinkClass}
            activeProps={{ className: cn(mobileLinkClass, mobileLinkActiveClass) }}
          >
            My proposals
          </Link>
          <MessagesNavLink
            to="/dashboard/freelancer/messages"
            className={mobileLinkClass}
            activeClassName={cn(mobileLinkClass, mobileLinkActiveClass)}
          />
          <Link
            to="/dashboard/freelancer/contracts"
            className={mobileLinkClass}
            activeProps={{ className: cn(mobileLinkClass, mobileLinkActiveClass) }}
          >
            Contracts
          </Link>
          <Link
            to="/dashboard/freelancer/payments"
            className={mobileLinkClass}
            activeProps={{ className: cn(mobileLinkClass, mobileLinkActiveClass) }}
          >
            Payments
          </Link>
          <Link
            to="/dashboard/freelancer/profile"
            className={mobileLinkClass}
            activeProps={{ className: cn(mobileLinkClass, mobileLinkActiveClass) }}
          >
            Profile
          </Link>
        </nav>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-start gap-6 px-4 py-6 md:grid-cols-[280px_minmax(0,1fr)] md:px-6">
        <FreelancerSidebar profile={profile} />
        <main className="flex min-w-0 flex-col gap-4">
          <EmailVerificationBanner />
          {profile && shouldShowOnboardingBanner(profile) ? (
            <OnboardingBanner profile={profile} role="freelancer" />
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
