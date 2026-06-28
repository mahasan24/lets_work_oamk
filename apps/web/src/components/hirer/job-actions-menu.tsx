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
          <DropdownMenuItem onClick={() => runAction(() => jobsApi.pause(job.id), "Job paused")}>
            Pause
          </DropdownMenuItem>
        ) : null}
        {job.status === "paused" ? (
          <DropdownMenuItem onClick={() => runAction(() => jobsApi.resume(job.id), "Job resumed")}>
            Resume
          </DropdownMenuItem>
        ) : null}
        {job.status === "open" || job.status === "paused" ? (
          <DropdownMenuItem onClick={() => runAction(() => jobsApi.close(job.id), "Job closed")}>
            Close job
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
