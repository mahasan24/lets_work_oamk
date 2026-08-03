import { Avatar, AvatarFallback, AvatarImage } from "@lets_work/ui/components/avatar";
import { Button } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Label } from "@lets_work/ui/components/label";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { Textarea } from "@lets_work/ui/components/textarea";
import { Star } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { formatRelativeJobDate } from "@/lib/job-utils";
import {
  ReviewsApiError,
  reviewsApi,
  type ContractReviewsResponse,
  type Review,
} from "@/lib/reviews-api";

type ContractReviewsProps = {
  contractId: string;
  counterpartName: string;
  enabled: boolean;
};

function StarRatingInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          disabled={disabled}
          className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
          onClick={() => onChange(star)}
        >
          <Star className={`size-5 ${value >= star ? "fill-current text-foreground" : ""}`} />
        </button>
      ))}
    </div>
  );
}

function ReviewCard({ review, title }: { review: Review; title: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Avatar className="size-8">
            <AvatarImage src={review.reviewer?.image ?? undefined} />
            <AvatarFallback>
              {(review.reviewer?.name ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">
              {review.reviewer?.name ?? "User"} · {formatRelativeJobDate(review.createdAt)}
            </p>
          </div>
        </div>
        <p className="flex items-center gap-1 text-sm">
          <Star className="size-3.5 fill-current" aria-hidden />
          {review.rating}
        </p>
      </div>
      {review.comment ? (
        <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{review.comment}</p>
      ) : null}
    </div>
  );
}

export function ContractReviews({ contractId, counterpartName, enabled }: ContractReviewsProps) {
  const [data, setData] = useState<ContractReviewsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setData(await reviewsApi.listForContract(contractId));
    } catch {
      toast.error("Failed to load reviews");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [contractId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!enabled) return null;

  const submit = () => {
    startTransition(async () => {
      try {
        await reviewsApi.create(contractId, {
          rating,
          comment: comment.trim() || undefined,
        });
        toast.success("Review submitted");
        setComment("");
        await load();
      } catch (error) {
        toast.error(error instanceof ReviewsApiError ? error.message : "Failed to submit review");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reviews</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? <Skeleton className="h-24 w-full" /> : null}

        {!isLoading && data?.myReview ? (
          <ReviewCard review={data.myReview} title="Your review" />
        ) : null}

        {!isLoading && data?.counterpartReview ? (
          <ReviewCard review={data.counterpartReview} title={`${counterpartName}'s review`} />
        ) : null}

        {!isLoading && data?.canReview ? (
          <div className="space-y-3 rounded-md border border-dashed border-border p-4">
            <p className="text-sm font-medium">Leave a review for {counterpartName}</p>
            <div className="space-y-2">
              <Label>Rating</Label>
              <StarRatingInput value={rating} onChange={setRating} disabled={isPending} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-comment">Comment (optional)</Label>
              <Textarea
                id="review-comment"
                value={comment}
                disabled={isPending}
                onChange={(event) => setComment(event.target.value)}
                placeholder="How was working together?"
              />
            </div>
            <Button type="button" size="sm" disabled={isPending} onClick={submit}>
              {isPending ? "Submitting…" : "Submit review"}
            </Button>
          </div>
        ) : null}

        {!isLoading && data && !data.canReview && !data.myReview && !data.counterpartReview ? (
          <p className="text-sm text-muted-foreground">No reviews yet for this contract.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
