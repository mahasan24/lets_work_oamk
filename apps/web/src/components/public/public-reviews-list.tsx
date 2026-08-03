import { Avatar, AvatarFallback, AvatarImage } from "@lets_work/ui/components/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";

import { formatRelativeJobDate } from "@/lib/job-utils";
import { reviewsApi, type Review } from "@/lib/reviews-api";

export function PublicReviewsList({ userId }: { userId: string }) {
  const [items, setItems] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void reviewsApi
      .listForFreelancer(userId, { limit: 10 })
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No public reviews yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reviews ({total})</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.map((review) => (
          <div key={review.id} className="rounded-md border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Avatar className="size-8">
                  <AvatarImage src={review.reviewer?.image ?? undefined} />
                  <AvatarFallback>
                    {(review.reviewer?.name ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{review.reviewer?.name ?? "Client"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeJobDate(review.createdAt)}
                  </p>
                </div>
              </div>
              <p className="flex items-center gap-1 text-sm">
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
      </CardContent>
    </Card>
  );
}
