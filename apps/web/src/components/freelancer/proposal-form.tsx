import { Alert, AlertDescription, AlertTitle } from "@lets_work/ui/components/alert";
import { Badge } from "@lets_work/ui/components/badge";
import { Button } from "@lets_work/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@lets_work/ui/components/field";
import { Input } from "@lets_work/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@lets_work/ui/components/select";
import { Textarea } from "@lets_work/ui/components/textarea";
import { cn } from "@lets_work/ui/lib/utils";
import { FileIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { uploadProposalAttachment } from "@/lib/cloudinary-upload";
import { ESTIMATED_DURATION_OPTIONS, getDurationLabel, type EstimatedDuration } from "@/lib/job-options";
import type { PublicJob } from "@/lib/jobs-api";
import {
  getProposalStatusLabel,
  proposalsApi,
  ProposalsApiError,
  type Proposal,
  type ProposalAttachment,
} from "@/lib/proposals-api";

const inputClassName = "h-10";

type ProposalFormProps = {
  job: PublicJob;
  onSubmitted?: () => void;
};

type FormState = {
  coverLetter: string;
  proposedRate: string;
  estimatedDuration: EstimatedDuration | "";
  attachments: ProposalAttachment[];
};

function proposalToForm(proposal: Proposal | null): FormState {
  return {
    coverLetter: proposal?.coverLetter ?? "",
    proposedRate: proposal?.proposedRate ?? "",
    estimatedDuration: proposal?.estimatedDuration ?? "",
    attachments: proposal?.attachments ?? [],
  };
}

function formToPayload(form: FormState) {
  return {
    coverLetter: form.coverLetter,
    proposedRate: form.proposedRate.trim() || null,
    estimatedDuration: form.estimatedDuration || null,
    attachments: form.attachments,
  };
}

export function ProposalForm({ job, onSubmitted }: ProposalFormProps) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [form, setForm] = useState<FormState>(proposalToForm(null));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const isReadOnly =
    proposal?.status === "submitted" ||
    proposal?.status === "shortlisted" ||
    proposal?.status === "accepted" ||
    proposal?.status === "rejected";

  const rateLabel =
    job.budgetType === "hourly" ? "Your hourly rate" : "Your bid amount";
  const ratePlaceholder = job.budgetType === "hourly" ? "e.g. 55" : "e.g. 2500";

  useEffect(() => {
    setIsLoading(true);
    proposalsApi
      .getForJob(job.id)
      .then((existing) => {
        setProposal(existing);
        setForm(proposalToForm(existing));
      })
      .catch(() => toast.error("Failed to load your proposal"))
      .finally(() => setIsLoading(false));
  }, [job.id]);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const attachment = await uploadProposalAttachment(file);
      updateForm("attachments", [...form.attachments, attachment]);
      toast.success("File attached");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const saveDraft = async () => {
    setIsSaving(true);
    try {
      const saved = await proposalsApi.saveDraft(job.id, formToPayload(form));
      setProposal(saved);
      setForm(proposalToForm(saved));
      toast.success("Draft saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  const submitProposal = async () => {
    setIsSubmitting(true);
    try {
      const submitted = await proposalsApi.submit(job.id, formToPayload(form));
      setProposal(submitted);
      setForm(proposalToForm(submitted));
      toast.success("Proposal submitted");
      onSubmitted?.();
    } catch (error) {
      if (error instanceof ProposalsApiError && error.errors?.length) {
        toast.error(error.errors[0]);
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to submit proposal");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const withdrawProposal = async () => {
    if (!proposal) return;
    if (!window.confirm("Withdraw this proposal? You can submit a new one later.")) return;

    setIsWithdrawing(true);
    try {
      const withdrawn = await proposalsApi.withdraw(proposal.id);
      setProposal(withdrawn);
      setForm(proposalToForm(withdrawn));
      toast.success("Proposal withdrawn");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to withdraw");
    } finally {
      setIsWithdrawing(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading proposal form...</p>;
  }

  if (proposal?.status === "accepted") {
    return (
      <Alert>
        <AlertTitle>Proposal accepted</AlertTitle>
        <AlertDescription>
          Congratulations — the client accepted your proposal. Contract details will follow in a
          future update.
        </AlertDescription>
      </Alert>
    );
  }

  if (proposal?.status === "rejected") {
    return (
      <Alert variant="destructive">
        <AlertTitle>Proposal not selected</AlertTitle>
        <AlertDescription>
          The client chose another freelancer for this job. Keep browsing for more opportunities.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base">Your proposal</CardTitle>
            <CardDescription>
              Explain why you&apos;re a fit, share your bid, timeline, and any supporting files.
            </CardDescription>
          </div>
          {proposal ? (
            <Badge variant={proposal.status === "draft" ? "secondary" : "default"}>
              {getProposalStatusLabel(proposal.status)}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {isReadOnly ? (
          <Alert>
            <AlertTitle>Proposal submitted</AlertTitle>
            <AlertDescription>
              Your proposal is with the client. You can withdraw it if your plans change.
            </AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup>
          <Field>
            <FieldLabel>Cover letter</FieldLabel>
            <Textarea
              value={form.coverLetter}
              disabled={isReadOnly}
              onChange={(event) => updateForm("coverLetter", event.target.value)}
              placeholder="Introduce yourself, highlight relevant experience, and explain your approach..."
              rows={8}
            />
            <FieldDescription>Minimum 50 characters when submitting.</FieldDescription>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{rateLabel}</FieldLabel>
              <Input
                className={inputClassName}
                inputMode="decimal"
                disabled={isReadOnly}
                value={form.proposedRate}
                onChange={(event) => updateForm("proposedRate", event.target.value)}
                placeholder={ratePlaceholder}
              />
              <FieldDescription>
                Job budget: {job.budgetType === "hourly" ? "hourly" : "fixed price"} ({job.currency})
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Estimated timeline</FieldLabel>
              <Select
                value={form.estimatedDuration || "none"}
                disabled={isReadOnly}
                onValueChange={(value) =>
                  updateForm(
                    "estimatedDuration",
                    value === "none" ? "" : (value as EstimatedDuration),
                  )
                }
              >
                <SelectTrigger className={cn(inputClassName, "w-full")}>
                  {form.estimatedDuration
                    ? getDurationLabel(form.estimatedDuration)
                    : "Select duration"}
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">Select duration</SelectItem>
                    {ESTIMATED_DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel>Attachments (optional)</FieldLabel>
            <FieldDescription>
              Portfolio samples, case studies, or other files that support your proposal.
            </FieldDescription>
            {!isReadOnly ? (
              <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground hover:bg-muted/40">
                <input
                  type="file"
                  className="sr-only"
                  disabled={isUploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleUpload(file);
                    event.target.value = "";
                  }}
                />
                {isUploading ? "Uploading..." : "Click to upload a file"}
              </label>
            ) : null}
            {form.attachments.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-2">
                {form.attachments.map((attachment) => (
                  <li
                    key={attachment.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:underline"
                      >
                        {attachment.fileName}
                      </a>
                    </div>
                    {!isReadOnly ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove attachment"
                        onClick={() =>
                          updateForm(
                            "attachments",
                            form.attachments.filter((item) => item.id !== attachment.id),
                          )
                        }
                      >
                        <XIcon className="size-4" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </Field>
        </FieldGroup>

        <div className="flex flex-wrap gap-3">
          {!isReadOnly ? (
            <>
              <Button variant="outline" disabled={isSaving || isSubmitting} onClick={() => void saveDraft()}>
                {isSaving ? "Saving..." : "Save draft"}
              </Button>
              <Button disabled={isSaving || isSubmitting} onClick={() => void submitProposal()}>
                {isSubmitting ? "Submitting..." : "Submit proposal"}
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              disabled={isWithdrawing}
              onClick={() => void withdrawProposal()}
            >
              {isWithdrawing ? "Withdrawing..." : "Withdraw proposal"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
