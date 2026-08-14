import { Avatar, AvatarFallback, AvatarImage } from "@lets_work/ui/components/avatar";
import { Badge } from "@lets_work/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { ExternalLink } from "lucide-react";

import { VerifiedBadge } from "@/components/public/verified-badge";
import { ReportButton } from "@/components/moderation/report-dialog";
import { formatLocation, formatMonthYear } from "@/lib/public-profile-utils";
import type { PublicClientProfile } from "@/lib/public-profiles-api";

export function ClientPublicProfile({ profile }: { profile: PublicClientProfile }) {
  const displayName = profile.companyName ?? profile.name;
  const location = formatLocation(profile.country, profile.city);
  const memberSince = formatMonthYear(profile.memberSince);
  const about = profile.companyDescription ?? profile.bio;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
          <Avatar className="size-20">
            <AvatarImage src={profile.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="text-lg">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
              <VerifiedBadge verified={profile.identityVerified} />
              {profile.hirerType === "company" ? <Badge variant="outline">Company</Badge> : null}
            </div>

            {profile.headline ? <p className="text-muted-foreground">{profile.headline}</p> : null}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {location ? <span>{location}</span> : null}
              {profile.companySize ? <span>{profile.companySize} employees</span> : null}
              {memberSince ? <span>Member since {memberSince}</span> : null}
            </div>

            {profile.companyWebsite ? (
              <a
                href={profile.companyWebsite}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {profile.companyWebsite}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:items-end sm:text-right">
            <p className="text-xl font-semibold">{profile.openJobsCount}</p>
            <p className="text-sm text-muted-foreground">
              open job{profile.openJobsCount === 1 ? "" : "s"}
            </p>
            <ReportButton
              target={{ reportedUserId: profile.userId }}
              title="Report this client"
              variant="outline"
              className="mt-1 gap-1.5"
            />
          </div>
        </CardContent>
      </Card>

      {about ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {about}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {profile.jobCategories.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hires for</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {profile.jobCategories.map((category) => (
              <Badge key={category} variant="outline">
                {category}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
