import { Avatar, AvatarFallback, AvatarImage } from "@lets_work/ui/components/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Separator } from "@lets_work/ui/components/separator";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";

import { formatRelativeJobDate } from "@/lib/job-utils";
import { reviewsApi, type Review } from "@/lib/reviews-api";

type JobHistoryReviewsProps = {
  userId: string;
  /** Optional heading override (default: Reviews from Lets Work jobs) */
  title?: string;
  emptyMessage?: string;
  className?: string;
};

export function JobHistoryReviews({
  userId,
  title = "Lets Work jobs & reviews",
  emptyMessage = "No completed-job reviews yet. Reviews appear here after clients rate your work.",
  className,
}: JobHistoryReviewsProps) {
  const [items, setItems] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void reviewsApi
      .listForFreelancer(userId, { limit: 20 })
      .then((data) => {
        if (!cancelled) {
          setItems(data.items);
          setTotal(data.pagination.total);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (items.length === 0) {
    return (
      <div className={className}>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <p className="text-sm font-medium">
        {title}
        <span className="ml-1 text-muted-foreground">({total})</span>
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {items.map((review) => (
          <div key={review.id} className="rounded-md border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar className="size-8">
                  <AvatarImage src={review.reviewer?.image ?? undefined} />
                  <AvatarFallback>
                    {(review.reviewer?.name ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {review.contract?.title ?? "Completed job"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {review.reviewer?.name ?? "Client"} · {formatRelativeJobDate(review.createdAt)}
                  </p>
                </div>
              </div>
              <p className="flex shrink-0 items-center gap-1 text-sm">
                <Star className="size-3.5 fill-current" aria-hidden />
                {review.rating}
              </p>
            </div>
            {review.comment ? (
              <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                {review.comment}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Standalone card used on public profiles / dashboard. */
export function PublicReviewsList({ userId }: { userId: string }) {
  return (
    <Card id="reviews">
      <CardHeader>
        <CardTitle className="text-base">Reviews</CardTitle>
      </CardHeader>
      <CardContent>
        <JobHistoryReviews userId={userId} title="Client feedback" />
      </CardContent>
    </Card>
  );
}

export function WorkHistoryWithReviews({
  userId,
  experience,
}: {
  userId: string;
  experience: Array<{
    id: string;
    title: string;
    company: string | null;
    description: string | null;
    startDate: string | null;
    endDate: string | null;
    isCurrent: boolean;
    dateLabel: string | null;
  }>;
}) {
  const hasExperience = experience.length > 0;

  return (
    <Card id="job-history">
      <CardHeader>
        <CardTitle className="text-base">Work history</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <JobHistoryReviews userId={userId} />

        {hasExperience ? (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium">Previous experience</p>
              <div className="mt-3 flex flex-col gap-4">
                {experience.map((item, index) => (
                  <div key={item.id} className="flex flex-col gap-1">
                    {index > 0 ? <Separator className="mb-4" /> : null}
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {[item.company, item.dateLabel].filter(Boolean).join(" · ")}
                    </p>
                    {item.description ? (
                      <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
