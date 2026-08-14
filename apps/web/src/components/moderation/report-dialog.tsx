import { Button } from "@lets_work/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@lets_work/ui/components/dialog";
import { Label } from "@lets_work/ui/components/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@lets_work/ui/components/select";
import { Textarea } from "@lets_work/ui/components/textarea";
import { FlagIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import {
  REPORT_TYPE_OPTIONS,
  ReportsApiError,
  reportsApi,
  type CreateReportInput,
  type ReportType,
} from "@/lib/reports-api";

export type ReportTarget = Omit<CreateReportInput, "reportType" | "description">;

type ReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ReportTarget;
  title?: string;
  description?: string;
};

export function ReportDialog({
  open,
  onOpenChange,
  target,
  title = "Report content",
  description = "Tell us what is wrong. Our team will review this report.",
}: ReportDialogProps) {
  const [reportType, setReportType] = useState<ReportType>("abuse");
  const [details, setDetails] = useState("");
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setReportType("abuse");
    setDetails("");
  };

  const handleSubmit = () => {
    if (details.trim().length < 20) {
      toast.error("Please describe the issue (at least 20 characters)");
      return;
    }

    startTransition(async () => {
      try {
        await reportsApi.create({
          ...target,
          reportType,
          description: details.trim(),
        });
        toast.success("Report submitted. Thank you.");
        reset();
        onOpenChange(false);
      } catch (error) {
        toast.error(
          error instanceof ReportsApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to submit report",
        );
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="bg-card text-card-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-type">Reason</Label>
            <Select
              value={reportType}
              onValueChange={(value) => {
                if (value) setReportType(value as ReportType);
              }}
            >
              <SelectTrigger id="report-type" className="w-full">
                <span className="truncate">
                  {REPORT_TYPE_OPTIONS.find((option) => option.value === reportType)?.label ??
                    "Select a reason"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {REPORT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-details">Details</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Describe what happened and why this should be reviewed."
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending || details.trim().length < 20}
            onClick={handleSubmit}
          >
            {isPending ? "Submitting…" : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ReportButtonProps = {
  target: ReportTarget;
  label?: string;
  title?: string;
  description?: string;
  variant?: "ghost" | "outline" | "secondary" | "link";
  size?: "default" | "sm" | "icon" | "icon-sm";
  className?: string;
  requireAuth?: boolean;
};

export function ReportButton({
  target,
  label = "Report",
  title,
  description,
  variant = "ghost",
  size = "sm",
  className,
  requireAuth = true,
}: ReportButtonProps) {
  const { data: session } = authClient.useSession();
  const [open, setOpen] = useState(false);

  if (requireAuth && !session?.user) {
    return null;
  }

  if (
    requireAuth &&
    session?.user?.id &&
    target.reportedUserId &&
    target.reportedUserId === session.user.id &&
    !target.reportedJobId &&
    !target.reportedProposalId &&
    !target.reportedMessageId
  ) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
        aria-label={label}
      >
        {size === "icon" || size === "icon-sm" ? (
          <FlagIcon className="size-3.5" />
        ) : (
          <>
            <FlagIcon className="size-3.5" />
            {label}
          </>
        )}
      </Button>
      <ReportDialog
        open={open}
        onOpenChange={setOpen}
        target={target}
        title={title}
        description={description}
      />
    </>
  );
}
