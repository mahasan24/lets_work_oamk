import { Button } from "@lets_work/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@lets_work/ui/components/dropdown-menu";
import { MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { jobsApi, type Job } from "@/lib/jobs-api";

type JobActionsMenuProps = {
  job: Job;
  onUpdated: (job: Job) => void;
  onDeleted?: () => void;
};

export function JobActionsMenu({ job, onUpdated, onDeleted }: JobActionsMenuProps) {
  const [isLoading, setIsLoading] = useState(false);

  const runAction = async (action: () => Promise<Job>, successMessage: string) => {
    setIsLoading(true);
    try {
      const updated = await action();
      onUpdated(updated);
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this draft job? This cannot be undone.")) return;

    setIsLoading(true);
    try {
      await jobsApi.delete(job.id);
      toast.success("Job deleted");
      onDeleted?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete job");
    } finally {
      setIsLoading(false);
    }
  };

  const canPause = job.status === "open" || job.status === "in_review";
  const canClose = canPause || job.status === "paused";
  const canFill = canClose;
  const canCancel =
    job.status === "draft" ||
    job.status === "open" ||
    job.status === "paused" ||
    job.status === "in_review";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={isLoading}
            aria-label="Job actions"
          />
        }
      >
        <MoreHorizontalIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {job.status === "draft" ? (
          <DropdownMenuItem
            onClick={() => runAction(() => jobsApi.publish(job.id), "Job published")}
          >
            Publish
          </DropdownMenuItem>
        ) : null}
        {job.status === "open" ? (
          <DropdownMenuItem
            onClick={() => runAction(() => jobsApi.startReview(job.id), "Job moved to review")}
          >
            Start reviewing
          </DropdownMenuItem>
        ) : null}
        {canPause ? (
          <DropdownMenuItem onClick={() => runAction(() => jobsApi.pause(job.id), "Job paused")}>
            Pause
          </DropdownMenuItem>
        ) : null}
        {job.status === "paused" ? (
          <DropdownMenuItem onClick={() => runAction(() => jobsApi.resume(job.id), "Job resumed")}>
            Resume
          </DropdownMenuItem>
        ) : null}
        {canFill ? (
          <DropdownMenuItem onClick={() => runAction(() => jobsApi.fill(job.id), "Job marked as filled")}>
            Mark as filled
          </DropdownMenuItem>
        ) : null}
        {canClose ? (
          <DropdownMenuItem onClick={() => runAction(() => jobsApi.close(job.id), "Job closed")}>
            Close job
          </DropdownMenuItem>
        ) : null}
        {canCancel ? (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => runAction(() => jobsApi.cancel(job.id), "Job cancelled")}
          >
            Cancel job
          </DropdownMenuItem>
        ) : null}
        {job.status === "draft" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => void handleDelete()}>
              Delete draft
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
