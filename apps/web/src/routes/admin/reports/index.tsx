import { Badge } from "@lets_work/ui/components/badge";
import { Button } from "@lets_work/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lets_work/ui/components/card";
import { Checkbox } from "@lets_work/ui/components/checkbox";
import { Field, FieldGroup, FieldLabel } from "@lets_work/ui/components/field";
import { Textarea } from "@lets_work/ui/components/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@lets_work/ui/components/select";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { adminApi, type AdminReport } from "@/lib/admin-api";
import {
  getReportOutcomeLabel,
  getReportQueueFilterLabel,
  getReportStatusLabel,
  getReportTypeLabel,
  REPORT_OUTCOME_OPTIONS,
  REPORT_QUEUE_FILTER_OPTIONS,
} from "@/lib/reports-api";

export const Route = createFileRoute("/admin/reports/")({
  component: AdminReportsPage,
});

function targetLabel(item: AdminReport) {
  if (item.reportedMessageId) return "Message";
  if (item.reportedProposalId) return "Proposal";
  if (item.reportedJobId) return "Job";
  if (item.reportedUserId) return "User";
  return "Unknown";
}

function AdminReportsPage() {
  const [items, setItems] = useState<AdminReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"queue" | "all" | "resolved" | "dismissed">(
    "queue",
  );
  const [drafts, setDrafts] = useState<
    Record<string, { note: string; suspend: boolean; outcome: "resolved" | "dismissed" }>
  >({});

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.listReports({ status: statusFilter, limit: 50 });
      setItems(response.items);
    } catch {
      toast.error("Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const updateDraft = (
    id: string,
    patch: Partial<{ note: string; suspend: boolean; outcome: "resolved" | "dismissed" }>,
  ) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        note: patch.note ?? current[id]?.note ?? "",
        suspend: patch.suspend ?? current[id]?.suspend ?? false,
        outcome: patch.outcome ?? current[id]?.outcome ?? "resolved",
      },
    }));
  };

  const handleUnderReview = async (id: string) => {
    setActingId(id);
    try {
      await adminApi.markReportUnderReview(id);
      toast.success("Marked under review");
      await loadItems();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setActingId(null);
    }
  };

  const handleResolve = async (id: string) => {
    const draft = drafts[id] ?? { note: "", suspend: false, outcome: "resolved" as const };
    if (draft.note.trim().length > 0 && draft.note.trim().length < 10) {
      toast.error("Resolution note must be at least 10 characters (or leave blank)");
      return;
    }
    setActingId(id);
    try {
      await adminApi.resolveReport(id, {
        status: draft.outcome,
        note: draft.note.trim() || null,
        suspendReportedUser: draft.suspend,
        suspendReason: draft.suspend ? draft.note.trim() || "Suspended after content report" : null,
      });
      toast.success(draft.outcome === "resolved" ? "Report resolved" : "Report dismissed");
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to close report");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Content reports</h1>
          <p className="text-sm text-muted-foreground">
            Review user-filed reports for profiles, jobs, proposals, and chat messages.
          </p>
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            if (value) setStatusFilter(value as "queue" | "all" | "resolved" | "dismissed");
          }}
        >
          <SelectTrigger className="w-44">
            <span className="truncate">{getReportQueueFilterLabel(statusFilter)}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {REPORT_QUEUE_FILTER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading reports…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No reports</CardTitle>
            <CardDescription>Nothing matches this filter right now.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => {
            const draft = drafts[item.id] ?? {
              note: "",
              suspend: false,
              outcome: "resolved" as const,
            };
            const isOpen = item.status === "open" || item.status === "under_review";

            return (
              <Card key={item.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                  <div className="flex flex-col gap-1">
                    <CardTitle className="text-base">
                      {getReportTypeLabel(item.reportType)} · {targetLabel(item)}
                    </CardTitle>
                    <CardDescription>
                      From {item.reporterName} ({item.reporterEmail}) ·{" "}
                      {new Date(item.createdAt).toLocaleString()}
                    </CardDescription>
                  </div>
                  <Badge variant={isOpen ? "destructive" : "secondary"}>
                    {getReportStatusLabel(item.status)}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-sm whitespace-pre-wrap">{item.description}</p>
                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    {item.reportedName ? (
                      <p>
                        Reported user:{" "}
                        <span className="text-foreground">
                          {item.reportedName} ({item.reportedEmail})
                        </span>
                      </p>
                    ) : null}
                    {item.jobTitle ? (
                      <p>
                        Job: <span className="text-foreground">{item.jobTitle}</span>
                      </p>
                    ) : null}
                    {item.reportedProposalId ? (
                      <p>
                        Proposal id:{" "}
                        <span className="font-mono text-foreground">{item.reportedProposalId}</span>
                      </p>
                    ) : null}
                    {item.messagePreview ? (
                      <p className="sm:col-span-2">
                        Message: <span className="text-foreground">“{item.messagePreview}”</span>
                      </p>
                    ) : null}
                  </div>

                  {isOpen ? (
                    <FieldGroup className="gap-3">
                      <Field>
                        <FieldLabel>Outcome</FieldLabel>
                        <Select
                          value={draft.outcome}
                          onValueChange={(value) => {
                            if (value)
                              updateDraft(item.id, {
                                outcome: value as "resolved" | "dismissed",
                              });
                          }}
                        >
                          <SelectTrigger>
                            <span className="truncate">{getReportOutcomeLabel(draft.outcome)}</span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {REPORT_OUTCOME_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field>
                        <FieldLabel>Note to reporter (optional)</FieldLabel>
                        <Textarea
                          value={draft.note}
                          onChange={(event) => updateDraft(item.id, { note: event.target.value })}
                          rows={3}
                          placeholder="Optional note included in the reporter notification"
                        />
                      </Field>
                      {item.reportedUserId ? (
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={draft.suspend}
                            onCheckedChange={(checked) =>
                              updateDraft(item.id, { suspend: checked === true })
                            }
                          />
                          Also suspend the reported user
                        </label>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {item.status === "open" ? (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={actingId === item.id}
                            onClick={() => void handleUnderReview(item.id)}
                          >
                            Mark under review
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          disabled={actingId === item.id}
                          onClick={() => void handleResolve(item.id)}
                        >
                          Close report
                        </Button>
                      </div>
                    </FieldGroup>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
