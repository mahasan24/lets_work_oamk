import { Avatar, AvatarFallback, AvatarImage } from "@lets_work/ui/components/avatar";
import { Badge } from "@lets_work/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Separator } from "@lets_work/ui/components/separator";
import { ExternalLink, Star } from "lucide-react";

import { VerifiedBadge } from "@/components/public/verified-badge";
import { PublicReviewsList } from "@/components/public/public-reviews-list";
import { ReportButton } from "@/components/moderation/report-dialog";
import {
  formatDateRange,
  formatHourlyRate,
  formatLocation,
  formatMonthYear,
  formatRating,
  getAvailabilityLabel,
} from "@/lib/public-profile-utils";
import type { PublicFreelancerProfile } from "@/lib/public-profiles-api";

export function FreelancerPublicProfile({ profile }: { profile: PublicFreelancerProfile }) {
  const rate = formatHourlyRate(profile.hourlyRate, profile.currency);
  const rating = formatRating(profile.avgRating);
  const location = formatLocation(profile.country, profile.city);
  const memberSince = formatMonthYear(profile.memberSince);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
          <Avatar className="size-20">
            <AvatarImage src={profile.avatarUrl ?? undefined} alt="" />
            <AvatarFallback className="text-lg">
              {profile.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1>
              <VerifiedBadge verified={profile.identityVerified} />
            </div>

            {profile.headline ? <p className="text-muted-foreground">{profile.headline}</p> : null}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {location ? <span>{location}</span> : null}
              <span>{getAvailabilityLabel(profile.availabilityStatus)}</span>
              {profile.hoursPerWeek ? <span>{profile.hoursPerWeek} hrs/week</span> : null}
              {memberSince ? <span>Member since {memberSince}</span> : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            {rate ? <p className="text-xl font-semibold">{rate}</p> : null}
            {rating ? (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Star className="size-4 fill-current" aria-hidden />
                {rating}
                <span className="sr-only">average rating from</span>
                <span>
                  ({profile.reviewCount} review{profile.reviewCount === 1 ? "" : "s"})
                </span>
              </p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {profile.jobsCompleted} job{profile.jobsCompleted === 1 ? "" : "s"} completed
            </p>
            {typeof profile.reputationScore === "number" ? (
              <p className="text-sm text-muted-foreground">
                Reputation score {profile.reputationScore}/100
              </p>
            ) : null}
            <ReportButton
              target={{ reportedUserId: profile.userId }}
              title="Report this freelancer"
              variant="outline"
              className="mt-1 gap-1.5"
            />
          </div>
        </CardContent>
      </Card>

      {profile.bio ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {profile.bio}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {profile.skills.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skills</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <Badge key={skill} variant="outline">
                {skill}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {profile.portfolio.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portfolio</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {profile.portfolio.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 rounded-lg border p-4">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    loading="lazy"
                    className="aspect-video w-full rounded-md object-cover"
                  />
                ) : null}
                <p className="font-medium">{item.title}</p>
                {item.description ? (
                  <p className="line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
                ) : null}
                {item.projectUrl ? (
                  <a
                    href={item.projectUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    View project
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {profile.experience.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Work history</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {profile.experience.map((item, index) => (
              <div key={item.id} className="flex flex-col gap-1">
                {index > 0 ? <Separator className="mb-4" /> : null}
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">
                  {[item.company, formatDateRange(item.startDate, item.endDate, item.isCurrent)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {item.description ? (
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {profile.certifications.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Certifications</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {profile.certifications.map((item) => (
              <div key={item.id} className="flex flex-col gap-1 rounded-lg border p-4">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                  {[item.issuer, formatMonthYear(item.issueDate)].filter(Boolean).join(" · ")}
                </p>
                {item.credentialUrl ? (
                  <a
                    href={item.credentialUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    View credential
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <PublicReviewsList userId={profile.userId} />
    </div>
  );
}
