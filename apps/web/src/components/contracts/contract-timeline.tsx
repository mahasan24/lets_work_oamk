import { Badge } from "@lets_work/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  contractsApi,
  getContractEventLabel,
  type ContractEvent,
} from "@/lib/contracts-api";
import { formatRelativeJobDate } from "@/lib/job-utils";

type ContractTimelineProps = {
  contractId: string;
  refreshKey?: number;
};

export function ContractTimeline({ contractId, refreshKey = 0 }: ContractTimelineProps) {
  const [items, setItems] = useState<ContractEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await contractsApi.timeline(contractId);
      setItems(response.items);
    } catch {
      toast.error("Failed to load contract timeline");
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l pl-4">
            {items.map((event) => (
              <li key={event.id} className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border bg-background" />
                  <p className="text-sm font-medium">{event.title}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {getContractEventLabel(event.eventType)}
                  </Badge>
                </div>
                {event.description ? (
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {formatRelativeJobDate(event.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
