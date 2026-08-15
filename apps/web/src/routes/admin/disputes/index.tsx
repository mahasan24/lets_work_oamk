import { Badge } from "@lets_work/ui/components/badge";
import { Button } from "@lets_work/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lets_work/ui/components/card";
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

import { adminApi, type AdminDispute } from "@/lib/admin-api";
import { getContractStatusLabel, type ContractStatus } from "@/lib/contracts-api";
import {
  DISPUTE_RESOLUTION_OPTIONS,
  getDisputeResolutionLabel,
  getDisputeStatusLabel,
  type DisputeStatus,
} from "@/lib/disputes-api";

export const Route = createFileRoute("/admin/disputes/")({
  component: AdminDisputesPage,
});

function AdminDisputesPage() {
  const [items, setItems] = useState<AdminDispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<
    Record<string, { resolutionStatus: AdminDispute["status"]; resolution: string }>
  >({});

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.listDisputes({ status: "all", limit: 50 });
      setItems(response.items);
    } catch {
      toast.error("Failed to load disputes");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const updateDraft = (
    id: string,
    patch: Partial<{ resolutionStatus: string; resolution: string }>,
  ) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        resolutionStatus:
          patch.resolutionStatus ?? current[id]?.resolutionStatus ?? "resolved_client",
        resolution: patch.resolution ?? current[id]?.resolution ?? "",
      },
    }));
  };

  const handleUnderReview = async (id: string) => {
    setActingId(id);
    try {
      await adminApi.markDisputeUnderReview(id);
      toast.success("Marked under review");
      await loadItems();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setActingId(null);
    }
  };

  const handleResolve = async (id: string) => {
    const draft = drafts[id];
    if (!draft || draft.resolution.trim().length < 10) {
      toast.error("Add a resolution note (at least 10 characters)");
      return;
    }
    setActingId(id);
    try {
      await adminApi.resolveDispute(id, {
        resolutionStatus: draft.resolutionStatus as
          "resolved_client" | "resolved_freelancer" | "closed",
        resolution: draft.resolution.trim(),
      });
      toast.success("Dispute resolved");
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resolve");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dispute mediation</h1>
        <p className="text-sm text-muted-foreground">
          Review open contract disputes, take them under review, and issue a resolution.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading disputes…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No open disputes</CardTitle>
            <CardDescription>There is nothing waiting for mediation right now.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => {
            const draft = drafts[item.id] ?? {
              resolutionStatus: "resolved_client",
              resolution: "",
            };
            return (
              <Card key={item.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{item.contractTitle}</CardTitle>
                    <Badge variant={item.status === "under_review" ? "default" : "secondary"}>
                      {getDisputeStatusLabel(item.status as DisputeStatus)}
                    </Badge>
                  </div>
                  <CardDescription>
                    Opened {new Date(item.createdAt).toLocaleString()} · Contract{" "}
                    {getContractStatusLabel(item.contractStatus as ContractStatus)}
                    {item.milestoneTitle ? ` · Milestone: ${item.milestoneTitle}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Opened by:</span> {item.openedByName}{" "}
                      ({item.openedByEmail})
                    </p>
                    <p>
                      <span className="text-muted-foreground">Respondent:</span>{" "}
                      {item.respondentName} ({item.respondentEmail})
                    </p>
                    <p>
                      <span className="text-muted-foreground">Reason:</span> {item.reason}
                    </p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{item.description}</p>
                    {item.resolution ? (
                      <p>
                        <span className="text-muted-foreground">Existing resolution:</span>{" "}
                        {item.resolution}
                      </p>
                    ) : null}
                  </div>

                  <FieldGroup>
                    <Field>
                      <FieldLabel>Resolution outcome</FieldLabel>
                      <Select
                        value={draft.resolutionStatus}
                        onValueChange={(value) => {
                          if (value) updateDraft(item.id, { resolutionStatus: value });
                        }}
                      >
                        <SelectTrigger className="w-full max-w-sm">
                          <span className="truncate">
                            {getDisputeResolutionLabel(draft.resolutionStatus)}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {DISPUTE_RESOLUTION_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>Resolution note</FieldLabel>
                      <Textarea
                        rows={3}
                        value={draft.resolution}
                        onChange={(event) =>
                          updateDraft(item.id, { resolution: event.target.value })
                        }
                        placeholder="Explain the decision for both parties…"
                      />
                    </Field>
                  </FieldGroup>

                  <div className="flex flex-wrap gap-2">
                    {item.status === "open" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actingId === item.id}
                        onClick={() => void handleUnderReview(item.id)}
                      >
                        Mark under review
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      disabled={actingId === item.id}
                      onClick={() => void handleResolve(item.id)}
                    >
                      Resolve dispute
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
