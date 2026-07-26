import { Avatar, AvatarFallback, AvatarImage } from "@lets_work/ui/components/avatar";
import { buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { cn } from "@lets_work/ui/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";

import { getCountryLabel } from "@/lib/profile-options";
import type { ProfileBundle } from "@/lib/profile-api";

type HirerSidebarProps = {
  profile: ProfileBundle | null;
};

function getVerificationLabel(profile: ProfileBundle | null) {
  const identity = profile?.verifications.find((item) => item.type === "identity");
  if (!identity) return "Not submitted";
  if (identity.status === "verified") return "Verified";
  if (identity.status === "pending") return "Pending review";
  if (identity.status === "rejected") return "Rejected";
  return "Not submitted";
}

export default function HirerSidebar({ profile }: HirerSidebarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const completion = profile?.profileCompletion ?? 0;
  const displayName =
    profile?.profile.hirerType === "company" && profile.profile.companyName
      ? profile.profile.companyName
      : (profile?.user.name ?? "Client");
  const subtitle =
    profile?.profile.hirerType === "company"
      ? (profile?.profile.headline ?? "Company account")
      : (profile?.profile.headline ?? "Individual client");
  const avatar = profile?.profile.avatarUrl ?? profile?.user.image ?? undefined;
  const countryLabel = getCountryLabel(profile?.profile.country);
  const verificationLabel = getVerificationLabel(profile);
  const isVerified = profile?.verifications.some(
    (item) => item.type === "identity" && item.status === "verified",
  );

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
            <p className="line-clamp-2 text-xs text-muted-foreground">{subtitle}</p>
            {countryLabel ? <p className="text-xs text-muted-foreground">{countryLabel}</p> : null}
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
            to="/dashboard/hirer/profile"
            className={cn(
              buttonVariants({
                variant: pathname === "/dashboard/hirer/profile" ? "default" : "outline",
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
          <CardTitle className="text-sm">Quick links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <Link
            to="/dashboard/hirer"
            className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            My jobs
          </Link>
          <Link
            to="/dashboard/hirer/contracts"
            className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Contracts
          </Link>
          <Link
            to="/freelancers"
            className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Find talent
          </Link>
          <Link
            to="/dashboard/hirer/profile"
            className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Profile
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{verificationLabel}</p>
          <Link
            to="/dashboard/hirer/profile"
            className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 h-auto p-0")}
          >
            {isVerified ? "View verification" : "Get verified"}
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Hire faster</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Browse the talent directory to find freelancers before your job post gets proposals.
        </CardContent>
      </Card>
    </aside>
  );
}
