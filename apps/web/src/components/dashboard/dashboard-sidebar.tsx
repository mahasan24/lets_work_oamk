import { Avatar, AvatarFallback, AvatarImage } from "@lets_work/ui/components/avatar";
import { Button, buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { cn } from "@lets_work/ui/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";

import Logo from "@/components/marketing/logo";
import UserMenu from "@/components/user-menu";
import type { ProfileBundle } from "@/lib/profile-api";

type DashboardSidebarProps = {
  profile: ProfileBundle | null;
};

export default function DashboardSidebar({ profile }: DashboardSidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const completion = profile?.profileCompletion ?? 0;
  const displayName = profile?.user.name ?? "Freelancer";
  const headline = profile?.profile.headline ?? "Add your professional title";
  const avatar = profile?.profile.avatarUrl ?? profile?.user.image ?? undefined;

  return (
    <aside className="flex flex-col gap-4">
      <Card>
        <CardHeader className="items-center text-center">
          <Avatar className="size-20">
            <AvatarImage src={avatar} alt={displayName} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">{displayName}</CardTitle>
            <p className="line-clamp-2 text-xs text-muted-foreground">{headline}</p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Profile completion</span>
              <span className="font-medium">{completion}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
          </div>
          <Link
            to="/dashboard/profile"
            className={cn(
              buttonVariants({
                variant: pathname === "/dashboard/profile" ? "default" : "outline",
                size: "sm",
              }),
              "w-full justify-center",
            )}
          >
            {completion >= 100 ? "View profile" : "Complete your profile"}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Availability badge</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm capitalize text-muted-foreground">
            {profile?.profile.availabilityStatus ?? "available"}
            {profile?.profile.hoursPerWeek ? ` · ${profile.profile.hoursPerWeek} hrs/week` : ""}
          </p>
          <Link
            to="/dashboard/profile"
            className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 h-auto p-0")}
          >
            Edit availability
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Reach more clients</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Boost your profile and availability settings to appear in more client searches.
        </CardContent>
      </Card>
    </aside>
  );
}
