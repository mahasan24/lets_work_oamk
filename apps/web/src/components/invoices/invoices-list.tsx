import { Badge } from "@lets_work/ui/components/badge";
import { Button, buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { cn } from "@lets_work/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { formatRelativeJobDate } from "@/lib/job-utils";
import {
  formatInvoiceAmount,
  getInvoiceStatusLabel,
  invoicesApi,
  type InvoiceListItem,
  type InvoiceStatus,
} from "@/lib/invoices-api";

type InvoicesListProps = {
  role: "hirer" | "freelancer";
};

const STATUS_FILTERS: Array<{ value: "all" | InvoiceStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "issued", label: "Issued" },
  { value: "overdue", label: "Overdue" },
  { value: "void", label: "Void" },
];

export function InvoicesList({ role }: InvoicesListProps) {
  const [items, setItems] = useState<InvoiceListItem[]>([]);
  const [status, setStatus] = useState<"all" | InvoiceStatus>("all");
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await invoicesApi.list({
        status: status === "all" ? undefined : status,
        limit: 50,
      });
      setItems(response.items);
    } catch {
      toast.error("Failed to load invoices");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-sm text-muted-foreground">
          {role === "hirer"
            ? "Receipts for milestone escrow funding you paid."
            : "Invoices issued when clients fund your milestones."}
        </p>
        <Link
          to={role === "hirer" ? "/dashboard/hirer/payments" : "/dashboard/freelancer/payments"}
          className="text-sm text-muted-foreground hover:text-foreground w-fit"
        >
          ← Back to payments
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            size="sm"
            variant={status === filter.value ? "default" : "outline"}
            onClick={() => setStatus(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="font-medium">No invoices yet</p>
            <p className="text-sm text-muted-foreground">
              Invoices appear automatically when a milestone is funded into escrow.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base">{item.invoiceNumber}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {item.milestoneTitle ?? "Milestone"}
                    {item.contractTitle ? ` · ${item.contractTitle}` : ""}
                    {" · "}
                    {formatRelativeJobDate(item.createdAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.direction === "payable"
                      ? `From ${item.billedFromName ?? "freelancer"}`
                      : `To ${item.billedToName}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="font-semibold">{formatInvoiceAmount(item.total, item.currency)}</p>
                  <Badge variant={item.status === "paid" ? "default" : "secondary"}>
                    {getInvoiceStatusLabel(item.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <a
                  href={invoicesApi.getHtmlUrl(item.id)}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  View / print
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
