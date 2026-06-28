import { Badge } from "@lets_work/ui/components/badge";
import { cn } from "@lets_work/ui/lib/utils";

import { getJobStatusLabel, type JobStatus } from "@/lib/job-options";

const STATUS_VARIANT: Record<JobStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  open: "default",
  paused: "outline",
  closed: "destructive",
};

type JobStatusBadgeProps = {
  status: JobStatus;
  className?: string;
};

export function JobStatusBadge({ status, className }: JobStatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={cn("shrink-0", className)}>
      {getJobStatusLabel(status)}
    </Badge>
  );
}
