import { Alert, AlertDescription, AlertTitle } from "@lets_work/ui/components/alert";
import { Button } from "@lets_work/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Checkbox } from "@lets_work/ui/components/checkbox";
import {
  Field,
  FieldContent,
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
import { Separator } from "@lets_work/ui/components/separator";
import { Textarea } from "@lets_work/ui/components/textarea";
import { cn } from "@lets_work/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { FileIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SearchableCombobox } from "@/components/dashboard/searchable-combobox";
import { SkillsTagsInput } from "@/components/dashboard/skills-tags-input";
import { uploadJobAttachment } from "@/lib/cloudinary-upload";
import { mergeJobCategorySuggestions } from "@/lib/hirer-options";
import { JOB_SKILL_SUGGESTIONS } from "@/lib/job-skill-suggestions";
import {
  BUDGET_TYPE_OPTIONS,
  ESTIMATED_DURATION_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  getBudgetTypeLabel,
  getDurationLabel,
  getExperienceLevelLabel,
  SUPPORTED_CURRENCIES,
  type BudgetType,
  type EstimatedDuration,
  type ExperienceLevel,
} from "@/lib/job-options";
import { formatBudgetRange } from "@/lib/job-utils";
import {
  JobsApiError,
  jobsApi,
  type Job,
  type JobAttachment,
  type JobPublishReadiness,
} from "@/lib/jobs-api";
import { COUNTRIES, getTimezoneOptions, resolveCountryValue } from "@/lib/profile-options";

import { JobActionsMenu } from "./job-actions-menu";
import { JobStatusBadge } from "./job-status-badge";

const WIZARD_STEPS = [
  { id: "basics", label: "Basics" },
  { id: "budget", label: "Budget" },
  { id: "skills", label: "Skills" },
  { id: "attachments", label: "Files" },
  { id: "review", label: "Review" },
] as const;

const inputClassName = "h-10";

type FormState = {
  title: string;
  description: string;
  category: string;
  requiredSkills: string[];
  budgetType: BudgetType;
  budgetMin: string;
  budgetMax: string;
  hourlyRateMin: string;
  hourlyRateMax: string;
  remoteOnly: boolean;
  country: string;
  currency: string;
  experienceLevel: ExperienceLevel | "";
  estimatedDuration: EstimatedDuration | "";
  weeklyHours: string;
  preferredTimezone: string;
  tags: string[];
  attachments: JobAttachment[];
};

function jobToFormState(job: Job): FormState {
  return {
    title: job.title,
    description: job.description,
    category: job.category,
    requiredSkills: job.requiredSkills,
    budgetType: job.budgetType,
    budgetMin: job.budgetMin ?? "",
    budgetMax: job.budgetMax ?? "",
    hourlyRateMin: job.hourlyRateMin ?? "",
    hourlyRateMax: job.hourlyRateMax ?? "",
    remoteOnly: job.remoteOnly,
    country: resolveCountryValue(job.country) || job.country || "",
    currency: job.currency,
    experienceLevel: job.experienceLevel ?? "",
    estimatedDuration: job.estimatedDuration ?? "",
    weeklyHours: job.weeklyHours != null ? String(job.weeklyHours) : "",
    preferredTimezone: job.preferredTimezone ?? "",
    tags: job.tags,
    attachments: job.attachments,
  };
}

function formToPayload(form: FormState) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    category: form.category.trim(),
    requiredSkills: form.requiredSkills,
    budgetType: form.budgetType,
    budgetMin: form.budgetType === "one_time" ? form.budgetMin || null : null,
    budgetMax: form.budgetType === "one_time" ? form.budgetMax || null : null,
    hourlyRateMin: form.budgetType === "hourly" ? form.hourlyRateMin || null : null,
    hourlyRateMax: form.budgetType === "hourly" ? form.hourlyRateMax || null : null,
    remoteOnly: form.remoteOnly,
    country: form.remoteOnly ? null : form.country || null,
    currency: form.currency,
    experienceLevel: form.experienceLevel || null,
    estimatedDuration: form.estimatedDuration || null,
    weeklyHours: form.weeklyHours ? Number(form.weeklyHours) : null,
    preferredTimezone: form.preferredTimezone || null,
    tags: form.tags,
    attachments: form.attachments,
  };
}

function validateStep(step: number, form: FormState) {
  const errors: string[] = [];

  if (step === 0) {
    if (form.title.trim().length < 3) errors.push("Title must be at least 3 characters");
    if (form.description.trim().length < 10) errors.push("Description must be at least 10 characters");
    if (!form.category.trim()) errors.push("Category is required");
  }

  if (step === 1) {
    if (form.budgetType === "hourly") {
      if (!form.hourlyRateMin || !form.hourlyRateMax) {
        errors.push("Enter hourly rate minimum and maximum");
      } else if (Number(form.hourlyRateMin) > Number(form.hourlyRateMax)) {
        errors.push("Hourly minimum cannot exceed maximum");
      }
    } else {
      if (!form.budgetMin || !form.budgetMax) {
        errors.push("Enter project budget minimum and maximum");
      } else if (Number(form.budgetMin) > Number(form.budgetMax)) {
        errors.push("Budget minimum cannot exceed maximum");
      }
    }
  }

  if (step === 2) {
    if (form.requiredSkills.length === 0) errors.push("Add at least one required skill");
    if (!form.remoteOnly && !form.country) errors.push("Country is required for on-site jobs");
  }

  return errors;
}

type JobFormWizardProps = {
  jobId: string;
};

export default function JobFormWizard({ jobId }: JobFormWizardProps) {
  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);
  const [job, setJob] = useState<Job | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [readiness, setReadiness] = useState<JobPublishReadiness | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  const isReadOnly =
    job?.status === "closed" || job?.status === "filled" || job?.status === "cancelled";

  const loadJob = async () => {
    setIsLoading(true);
    try {
      const loaded = await jobsApi.getMine(jobId);
      setJob(loaded);
      setForm(jobToFormState(loaded));
    } catch {
      toast.error("Failed to load job");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadJob();
  }, [jobId]);

  useEffect(() => {
    jobsApi
      .getReferenceData()
      .then((data) => setCategoryOptions([...data.categories]))
      .catch(() => setCategoryOptions([...mergeJobCategorySuggestions()]));
  }, []);

  useEffect(() => {
    if (step !== 4 || !jobId) return;

    jobsApi
      .getPublishReadiness(jobId)
      .then(setReadiness)
      .catch(() => setReadiness(null));
  }, [step, jobId, job?.updatedAt]);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const saveDraft = async (options?: { silent?: boolean }) => {
    if (!form) return null;

    setIsSaving(true);
    try {
      const updated = await jobsApi.update(jobId, formToPayload(form));
      setJob(updated);
      setForm(jobToFormState(updated));
      if (!options?.silent) toast.success("Draft saved");
      return updated;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const goNext = async () => {
    if (!form) return;

    const errors = validateStep(step, form);
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    const saved = await saveDraft({ silent: true });
    if (!saved) return;

    setStep((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await saveDraft({ silent: true });
      const updated = await jobsApi.publish(jobId);
      setJob(updated);
      setForm(jobToFormState(updated));
      toast.success("Job published");
    } catch (error) {
      if (error instanceof JobsApiError && error.errors?.length) {
        toast.error(error.errors[0]);
        setReadiness({ ready: false, errors: error.errors, status: job?.status ?? "draft" });
      } else {
        toast.error(error instanceof Error ? error.message : "Failed to publish");
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const handleAttachmentUpload = async (file: File) => {
    if (!form) return;

    setIsUploading(true);
    try {
      const attachment = await uploadJobAttachment(file);
      updateForm("attachments", [...form.attachments, attachment]);
      toast.success("File uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading || !form || !job) {
    return <p className="text-sm text-muted-foreground">Loading job...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Link
            to="/dashboard/hirer"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to jobs
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{isReadOnly ? "View job" : "Edit job"}</h1>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {isReadOnly
              ? "This job is closed and can no longer be edited."
              : "Complete each step, save your draft, and publish when ready."}
          </p>
          {job.proposalsCount > 0 ? (
            <Link
              to="/dashboard/hirer/jobs/$jobId/proposals"
              params={{ jobId }}
              className="text-sm font-medium text-primary hover:underline"
            >
              View {job.proposalsCount} proposal{job.proposalsCount === 1 ? "" : "s"}
            </Link>
          ) : null}
        </div>
        {!isReadOnly ? <JobActionsMenu job={job} onUpdated={(updated) => {
          setJob(updated);
          setForm(jobToFormState(updated));
        }} /> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {WIZARD_STEPS.map((wizardStep, index) => (
          <button
            key={wizardStep.id}
            type="button"
            disabled={isReadOnly && index !== step}
            onClick={() => setStep(index)}
            className={cn(
              "border px-3 py-1.5 text-xs font-medium transition-colors",
              step === index
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {index + 1}. {wizardStep.label}
          </button>
        ))}
      </div>

      {isReadOnly ? (
        <Alert>
          <AlertTitle>Job closed</AlertTitle>
          <AlertDescription>
            Closed jobs are read-only. You can still review the posting details below.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{WIZARD_STEPS[step]?.label}</CardTitle>
          <CardDescription>
            {step === 0 && "Describe what you need and who you are looking for."}
            {step === 1 && "Set budget, experience level, and expected timeline."}
            {step === 2 && "Add required skills, tags, and work location preferences."}
            {step === 3 && "Attach briefs, wireframes, or reference files (optional)."}
            {step === 4 && "Review everything before publishing to freelancers."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {step === 0 ? (
            <FieldGroup>
              <Field>
                <FieldLabel>Job title</FieldLabel>
                <Input
                  className={inputClassName}
                  value={form.title}
                  disabled={isReadOnly}
                  onChange={(e) => updateForm("title", e.target.value)}
                  placeholder="e.g. Full-stack developer for marketplace MVP"
                />
              </Field>
              <Field>
                <FieldLabel>Category</FieldLabel>
                <SearchableCombobox
                  value={form.category}
                  onValueChange={(value) => updateForm("category", value)}
                  options={categoryOptions.map((item) => ({ value: item, label: item }))}
                  placeholder="Select a category"
                  disabled={isReadOnly}
                />
              </Field>
              <Field>
                <FieldLabel>Description</FieldLabel>
                <Textarea
                  value={form.description}
                  disabled={isReadOnly}
                  onChange={(e) => updateForm("description", e.target.value)}
                  placeholder="Describe the project scope, deliverables, and ideal candidate..."
                  rows={8}
                />
              </Field>
            </FieldGroup>
          ) : null}

          {step === 1 ? (
            <FieldGroup>
              <Field>
                <FieldLabel>Budget type</FieldLabel>
                <Select
                  value={form.budgetType}
                  disabled={isReadOnly}
                  onValueChange={(value) => {
                    if (value) updateForm("budgetType", value as BudgetType);
                  }}
                >
                  <SelectTrigger className={cn(inputClassName, "w-full")}>
                    <span className="truncate">
                      {getBudgetTypeLabel(form.budgetType)}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {BUDGET_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Currency</FieldLabel>
                <Select
                  value={form.currency}
                  disabled={isReadOnly}
                  onValueChange={(value) => {
                    if (value) updateForm("currency", value);
                  }}
                >
                  <SelectTrigger className={cn(inputClassName, "w-full")}>
                    <span className="truncate">{form.currency}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {SUPPORTED_CURRENCIES.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              {form.budgetType === "hourly" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Hourly rate min</FieldLabel>
                    <Input
                      className={inputClassName}
                      type="number"
                      min="0"
                      disabled={isReadOnly}
                      value={form.hourlyRateMin}
                      onChange={(e) => updateForm("hourlyRateMin", e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Hourly rate max</FieldLabel>
                    <Input
                      className={inputClassName}
                      type="number"
                      min="0"
                      disabled={isReadOnly}
                      value={form.hourlyRateMax}
                      onChange={(e) => updateForm("hourlyRateMax", e.target.value)}
                    />
                  </Field>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Budget min</FieldLabel>
                    <Input
                      className={inputClassName}
                      type="number"
                      min="0"
                      disabled={isReadOnly}
                      value={form.budgetMin}
                      onChange={(e) => updateForm("budgetMin", e.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Budget max</FieldLabel>
                    <Input
                      className={inputClassName}
                      type="number"
                      min="0"
                      disabled={isReadOnly}
                      value={form.budgetMax}
                      onChange={(e) => updateForm("budgetMax", e.target.value)}
                    />
                  </Field>
                </div>
              )}
              <Field>
                <FieldLabel>Experience level</FieldLabel>
                <Select
                  value={form.experienceLevel || "none"}
                  disabled={isReadOnly}
                  onValueChange={(value) =>
                    updateForm("experienceLevel", value === "none" ? "" : (value as ExperienceLevel))
                  }
                >
                  <SelectTrigger className={cn(inputClassName, "w-full")}>
                    <span className="truncate">
                      {form.experienceLevel
                        ? getExperienceLevelLabel(form.experienceLevel)
                        : "Not specified"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {EXPERIENCE_LEVEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Estimated duration</FieldLabel>
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
                    <span className="truncate">
                      {form.estimatedDuration
                        ? getDurationLabel(form.estimatedDuration)
                        : "Not specified"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {ESTIMATED_DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Weekly hours (optional)</FieldLabel>
                <Input
                  className={inputClassName}
                  type="number"
                  min="1"
                  max="168"
                  disabled={isReadOnly}
                  value={form.weeklyHours}
                  onChange={(e) => updateForm("weeklyHours", e.target.value)}
                  placeholder="e.g. 20"
                />
              </Field>
            </FieldGroup>
          ) : null}

          {step === 2 ? (
            <FieldGroup>
              <Field>
                <FieldLabel>Required skills</FieldLabel>
                <SkillsTagsInput
                  value={form.requiredSkills}
                  onChange={(skills) => updateForm("requiredSkills", skills)}
                  suggestions={JOB_SKILL_SUGGESTIONS}
                  placeholder="Search or type a skill"
                  helperText="Pick from suggestions or type any skill and press Enter."
                  maxSuggestions={14}
                />
              </Field>
              <Field>
                <FieldLabel>Tags (optional)</FieldLabel>
                <SkillsTagsInput
                  value={form.tags}
                  onChange={(tags) => updateForm("tags", tags)}
                  suggestions={categoryOptions}
                  placeholder="Search or type a tag"
                  helperText="Optional tags to help freelancers discover this job."
                  maxSuggestions={10}
                />
              </Field>
              <Field orientation="horizontal" className="items-start">
                <Checkbox
                  id="remote-only"
                  className="mt-0.5"
                  checked={form.remoteOnly}
                  disabled={isReadOnly}
                  onCheckedChange={(checked) => updateForm("remoteOnly", checked === true)}
                />
                <FieldContent>
                  <FieldLabel htmlFor="remote-only">Remote only</FieldLabel>
                  <FieldDescription>
                    Freelancers can work from anywhere.
                  </FieldDescription>
                </FieldContent>
              </Field>
              {!form.remoteOnly ? (
                <Field>
                  <FieldLabel>Country</FieldLabel>
                  <SearchableCombobox
                    value={form.country}
                    onValueChange={(value) => updateForm("country", value)}
                    options={COUNTRIES}
                    placeholder="Select country"
                    disabled={isReadOnly}
                  />
                </Field>
              ) : null}
              <Field>
                <FieldLabel>Preferred timezone (optional)</FieldLabel>
                <SearchableCombobox
                  value={form.preferredTimezone}
                  onValueChange={(value) => updateForm("preferredTimezone", value)}
                  options={timezoneOptions}
                  placeholder="Select timezone"
                  disabled={isReadOnly}
                />
              </Field>
            </FieldGroup>
          ) : null}

          {step === 3 ? (
            <FieldGroup>
              <Field>
                <FieldLabel>Attachments</FieldLabel>
                <p className="mb-3 text-xs text-muted-foreground">
                  Upload briefs, wireframes, or reference documents. PDF, images, and office files
                  are supported.
                </p>
                {!isReadOnly ? (
                  <Input
                    type="file"
                    disabled={isUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleAttachmentUpload(file);
                      event.target.value = "";
                    }}
                  />
                ) : null}
              </Field>
              {form.attachments.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {form.attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="flex items-center justify-between gap-3 border px-3 py-2"
                    >
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-w-0 items-center gap-2 text-sm hover:underline"
                      >
                        <FileIcon className="size-4 shrink-0" />
                        <span className="truncate">{attachment.fileName}</span>
                      </a>
                      {!isReadOnly ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
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
              ) : (
                <p className="text-sm text-muted-foreground">No attachments yet.</p>
              )}
            </FieldGroup>
          ) : null}

          {step === 4 ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <ReviewItem label="Title" value={form.title} />
                <ReviewItem label="Category" value={form.category} />
                <ReviewItem label="Budget" value={formatBudgetRange({
                  budgetType: form.budgetType,
                  currency: form.currency,
                  budgetMin: form.budgetMin || null,
                  budgetMax: form.budgetMax || null,
                  hourlyRateMin: form.hourlyRateMin || null,
                  hourlyRateMax: form.hourlyRateMax || null,
                })} />
                <ReviewItem
                  label="Experience"
                  value={getExperienceLevelLabel(form.experienceLevel || null)}
                />
                <ReviewItem
                  label="Duration"
                  value={getDurationLabel(form.estimatedDuration || null)}
                />
                <ReviewItem
                  label="Location"
                  value={form.remoteOnly ? "Remote" : form.country || "On-site"}
                />
              </div>
              <Separator />
              <ReviewItem label="Description" value={form.description} />
              <ReviewItem label="Skills" value={form.requiredSkills.join(", ") || "None"} />
              {form.tags.length > 0 ? (
                <ReviewItem label="Tags" value={form.tags.join(", ")} />
              ) : null}
              <ReviewItem
                label="Attachments"
                value={
                  form.attachments.length > 0
                    ? `${form.attachments.length} file(s)`
                    : "None"
                }
              />

              {job.status === "draft" && readiness && !readiness.ready ? (
                <Alert variant="destructive">
                  <AlertTitle>Not ready to publish</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 list-disc pl-4">
                      {readiness.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}

              {job.status === "draft" && readiness?.ready ? (
                <Alert>
                  <AlertTitle>Ready to publish</AlertTitle>
                  <AlertDescription>
                    Your job meets all requirements and can be published to freelancers.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : null}

          {!isReadOnly ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={step === 0 || isSaving}
                onClick={() => setStep((current) => Math.max(current - 1, 0))}
              >
                Back
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSaving}
                  onClick={() => void saveDraft()}
                >
                  {isSaving ? "Saving..." : "Save draft"}
                </Button>
                {step < WIZARD_STEPS.length - 1 ? (
                  <Button type="button" disabled={isSaving} onClick={() => void goNext()}>
                    Continue
                  </Button>
                ) : job.status === "draft" ? (
                  <Button
                    type="button"
                    disabled={isPublishing || isSaving || readiness?.ready === false}
                    onClick={() => void handlePublish()}
                  >
                    {isPublishing ? "Publishing..." : "Publish job"}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
