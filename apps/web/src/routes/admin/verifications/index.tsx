import { Button } from "@lets_work/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lets_work/ui/components/card";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { adminApi, AdminApiError, type PendingVerification } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/verifications/")({
  component: AdminVerificationsPage,
});

function AdminVerificationsPage() {
  const [items, setItems] = useState<PendingVerification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await adminApi.listPendingVerifications();
      setItems(response.items);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 403) {
        toast.error("Admin access required");
      } else {
        toast.error("Failed to load verifications");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const handleApprove = async (id: string) => {
    setActingId(id);
    try {
      await adminApi.approveVerification(id);
      toast.success("Verification approved");
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    } finally {
      setActingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt("Rejection reason (optional)") ?? undefined;
    setActingId(id);
    try {
      await adminApi.rejectVerification(id, reason);
      toast.success("Verification rejected");
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reject");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Identity verification review</h1>
        <p className="text-sm text-muted-foreground">
          Approve or reject pending identity verifications submitted by users.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading queue...</p>
      ) : items.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>All caught up</CardTitle>
            <CardDescription>No pending identity verifications right now.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle>{item.user.name}</CardTitle>
                <CardDescription>
                  {item.user.email} · {item.user.accountType ?? item.user.activeRole ?? "unknown"} ·{" "}
                  {item.user.profileCompletion ?? 0}% profile complete
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-1 text-sm text-muted-foreground">
                  {item.user.headline ? <p>Headline: {item.user.headline}</p> : null}
                  {item.user.companyName ? <p>Company: {item.user.companyName}</p> : null}
                  {item.user.hirerType ? <p>Hirer type: {item.user.hirerType}</p> : null}
                  {(item.user.city || item.user.country) && (
                    <p>
                      Location: {[item.user.city, item.user.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                  <p>Submitted {new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={actingId === item.id}
                    onClick={() => void handleApprove(item.id)}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actingId === item.id}
                    onClick={() => void handleReject(item.id)}
                  >
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
