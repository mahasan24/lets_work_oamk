import { Link } from "@tanstack/react-router";

import Logo from "@/components/marketing/logo";
import UserMenu from "@/components/user-menu";
import { Route } from "@/routes/dashboard/freelancer/route";

import FreelancerSidebar from "./freelancer-sidebar";

const NAV_ITEMS = ["Find work", "Deliver work", "Manage finances", "Messages"] as const;

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
                <span key={item} className="text-sm text-muted-foreground">
                  {item}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/freelancer"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Home
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-start gap-6 px-4 py-6 md:grid-cols-[280px_minmax(0,1fr)] md:px-6">
        <FreelancerSidebar profile={profile} />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
