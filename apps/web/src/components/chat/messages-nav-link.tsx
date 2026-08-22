import { Badge } from "@lets_work/ui/components/badge";
import { cn } from "@lets_work/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { chatApi } from "@/lib/chat-api";
import { subscribeToRealtime } from "@/lib/realtime";

type MessagesNavLinkProps = {
  to: "/dashboard/freelancer/messages" | "/dashboard/hirer/messages";
  className?: string;
  activeClassName?: string;
  exact?: boolean;
};

export function MessagesNavLink({
  to,
  className,
  activeClassName,
  exact = false,
}: MessagesNavLinkProps) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let debounceTimer: number | null = null;

    const refresh = async () => {
      try {
        const result = await chatApi.listConversations({ limit: 50, unreadOnly: true });
        if (cancelled) return;
        const total = result.items.reduce((sum, entry) => sum + (entry.unreadCount ?? 0), 0);
        setUnreadCount(total);
      } catch {
        // Keep nav quiet on transient failures.
      }
    };

    const scheduleRefresh = () => {
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        void refresh();
      }, 400);
    };

    void refresh();

    const unsubNew = subscribeToRealtime("chat:message:new", scheduleRefresh);
    const unsubRead = subscribeToRealtime("chat:conversation:read", scheduleRefresh);

    return () => {
      cancelled = true;
      if (debounceTimer !== null) {
        window.clearTimeout(debounceTimer);
      }
      unsubNew();
      unsubRead();
    };
  }, []);

  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className={cn("inline-flex items-center gap-1.5", className)}
      activeProps={{ className: cn("inline-flex items-center gap-1.5", activeClassName) }}
    >
      Messages
      {unreadCount > 0 ? (
        <Badge
          variant="destructive"
          className="h-4 min-w-4 px-1 text-[10px] leading-none"
          aria-label={`${unreadCount} unread messages`}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      ) : null}
    </Link>
  );
}
