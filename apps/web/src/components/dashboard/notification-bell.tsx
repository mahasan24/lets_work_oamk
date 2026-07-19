import { Badge } from "@lets_work/ui/components/badge";
import { Button } from "@lets_work/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@lets_work/ui/components/popover";
import { ScrollArea } from "@lets_work/ui/components/scroll-area";
import { cn } from "@lets_work/ui/lib/utils";
import { useRouter } from "@tanstack/react-router";
import { BellIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { formatRelativeJobDate } from "@/lib/job-utils";
import {
  notificationsApi,
  type AppNotification,
} from "@/lib/notifications-api";

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await notificationsApi.list({ limit: 20 });
      setItems(response.items);
      setUnreadCount(response.meta.unreadCount);
    } catch {
      // Keep header quiet on transient failures.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void notificationsApi
        .unreadCount()
        .then((result) => setUnreadCount(result.unreadCount))
        .catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const handleOpenItem = async (item: AppNotification) => {
    if (!item.readAt) {
      try {
        await notificationsApi.markRead(item.id);
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
          ),
        );
        setUnreadCount((count) => Math.max(count - 1, 0));
      } catch {
        // Still allow navigation.
      }
    }

    setOpen(false);
    if (item.actionUrl?.startsWith("/")) {
      void router.navigate({ href: item.actionUrl });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const result = await notificationsApi.markAllRead();
      setUnreadCount(result.unreadCount);
      setItems((current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark notifications as read");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
            }
            className="relative"
          />
        }
      >
        <BellIcon className="size-4" />
        {unreadCount > 0 ? (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 sm:w-96">
        <PopoverHeader className="flex flex-row items-center justify-between gap-2 border-b border-border px-3 py-2">
          <PopoverTitle>Notifications</PopoverTitle>
          {unreadCount > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => void handleMarkAllRead()}>
              Mark all read
            </Button>
          ) : null}
        </PopoverHeader>
        <ScrollArea className="h-80">
          {isLoading && items.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-xs text-muted-foreground">You're all caught up.</p>
          ) : (
            <ul className="flex flex-col">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void handleOpenItem(item)}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b border-border px-3 py-3 text-left transition-colors hover:bg-muted/50",
                      !item.readAt && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{item.title}</p>
                      {!item.readAt ? (
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                      ) : null}
                    </div>
                    {item.body ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">
                      {formatRelativeJobDate(item.createdAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
