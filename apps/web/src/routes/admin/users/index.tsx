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
import { Input } from "@lets_work/ui/components/input";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { adminApi, type AdminUserSearchResult } from "@/lib/admin-api";

export const Route = createFileRoute("/admin/users/")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AdminUserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const handleSearch = async () => {
    if (query.trim().length < 2) {
      toast.error("Enter at least 2 characters");
      return;
    }
    setIsSearching(true);
    try {
      const response = await adminApi.searchUsers(query.trim());
      setItems(response.items);
      if (response.items.length === 0) {
        toast.message("No users matched that search");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuspend = async (user: AdminUserSearchResult) => {
    const reason =
      window.prompt("Suspension reason", user.suspendReason ?? "Policy violation") ?? "";
    if (!reason.trim()) return;
    setActingId(user.id);
    try {
      await adminApi.suspendUser(user.id, reason.trim());
      toast.success("User suspended");
      setItems((current) =>
        current.map((item) =>
          item.id === user.id
            ? {
                ...item,
                suspendedAt: new Date().toISOString(),
                suspendReason: reason.trim(),
              }
            : item,
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to suspend");
    } finally {
      setActingId(null);
    }
  };

  const handleUnsuspend = async (user: AdminUserSearchResult) => {
    setActingId(user.id);
    try {
      await adminApi.unsuspendUser(user.id);
      toast.success("User reinstated");
      setItems((current) =>
        current.map((item) =>
          item.id === user.id
            ? {
                ...item,
                suspendedAt: null,
                suspendReason: null,
              }
            : item,
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unsuspend");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">User management</h1>
        <p className="text-sm text-muted-foreground">
          Search by name or email, inspect account state, and suspend or reinstate users.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search users</CardTitle>
          <CardDescription>Results are limited to 25 matches.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="flex-1">
              <FieldLabel htmlFor="admin-user-q">Name or email</FieldLabel>
              <Input
                id="admin-user-q"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleSearch();
                }}
                placeholder="alex@example.com"
              />
            </Field>
            <Button type="button" disabled={isSearching} onClick={() => void handleSearch()}>
              {isSearching ? "Searching…" : "Search"}
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {items.map((user) => (
          <Card key={user.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{user.name}</CardTitle>
                {user.platformRole ? <Badge>{user.platformRole}</Badge> : null}
                {user.suspendedAt ? <Badge variant="destructive">Suspended</Badge> : null}
                {user.identityStatus ? (
                  <Badge variant="secondary">{user.identityStatus}</Badge>
                ) : null}
              </div>
              <CardDescription>
                {user.email} · {user.accountType ?? "no profile"} · {user.profileCompletion ?? 0}%
                complete
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Joined {new Date(user.createdAt).toLocaleString()}
                {user.suspendReason ? ` · Reason: ${user.suspendReason}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {user.suspendedAt ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actingId === user.id}
                    onClick={() => void handleUnsuspend(user)}
                  >
                    Reinstate
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={actingId === user.id || user.platformRole === "admin"}
                    onClick={() => void handleSuspend(user)}
                  >
                    Suspend
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
