import { Link } from "@tanstack/react-router";
import { cn } from "@lets_work/ui/lib/utils";

import AdminAccountMenu from "@/components/admin/admin-account-menu";
import Logo from "@/components/marketing/logo";

const linkClass = "text-sm text-muted-foreground hover:text-foreground";
const linkActiveClass = "text-sm font-medium text-foreground";
const mobileLinkClass =
  "shrink-0 rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground";
const mobileLinkActiveClass = "bg-muted font-medium text-foreground";

const navItems = [
  { to: "/admin", label: "Overview", exact: true as const },
  { to: "/admin/verifications", label: "Verifications" },
  { to: "/admin/disputes", label: "Disputes" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/account", label: "Account" },
] as const;

export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="hidden text-xs font-medium tracking-wide text-muted-foreground uppercase sm:inline">
                Admin
              </span>
            </div>
            <nav className="hidden items-center gap-6 md:flex">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeOptions={"exact" in item && item.exact ? { exact: true } : undefined}
                  className={linkClass}
                  activeProps={{ className: linkActiveClass }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <AdminAccountMenu />
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-2 py-1 md:hidden">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={"exact" in item && item.exact ? { exact: true } : undefined}
              className={mobileLinkClass}
              activeProps={{ className: cn(mobileLinkClass, mobileLinkActiveClass) }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6">
        <main className="flex min-w-0 flex-col gap-6">{children}</main>
      </div>
    </div>
  );
}
