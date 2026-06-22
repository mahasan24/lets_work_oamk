import { Avatar, AvatarFallback, AvatarImage } from "@lets_work/ui/components/avatar";
import { buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { cn } from "@lets_work/ui/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";

import { AVAILABILITY_OPTIONS, getCountryLabel } from "@/lib/profile-options";
import type { ProfileBundle } from "@/lib/profile-api";

type FreelancerSidebarProps = {
  profile: ProfileBundle | null;
};

export default function FreelancerSidebar({ profile }: FreelancerSidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const completion = profile?.profileCompletion ?? 0;
  const displayName = profile?.user.name ?? "Freelancer";
  const headline = profile?.profile.headline ?? "Add your professional title";
  const avatar = profile?.profile.avatarUrl ?? profile?.user.image ?? undefined;
  const countryLabel = getCountryLabel(profile?.profile.country);
  const availabilityLabel =
    AVAILABILITY_OPTIONS.find((option) => option.value === profile?.profile.availabilityStatus)
      ?.label ?? "Available";

  return (
    <aside className="flex w-full flex-col gap-4">
      <Card>
        <CardHeader className="items-start text-left">
          <Avatar className="size-16">
            <AvatarImage src={avatar} alt={displayName} />
            <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex w-full flex-col gap-1">
            <CardTitle className="text-base">{displayName}</CardTitle>
            <p className="line-clamp-2 text-xs text-muted-foreground">{headline}</p>
            {countryLabel ? (
              <p className="text-xs text-muted-foreground">{countryLabel}</p>
            ) : null}
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
            to="/dashboard/freelancer/profile"
            className={cn(
              buttonVariants({
                variant: pathname === "/dashboard/freelancer/profile" ? "default" : "outline",
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
          <p className="text-sm text-muted-foreground">
            {availabilityLabel}
            {profile?.profile.hoursPerWeek ? ` · ${profile.profile.hoursPerWeek} hrs/week` : ""}
          </p>
          <Link
            to="/dashboard/freelancer/profile"
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
