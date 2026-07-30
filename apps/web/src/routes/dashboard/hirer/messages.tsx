import { createFileRoute } from "@tanstack/react-router";

import { MessagingWorkspace } from "@/components/chat/messaging-workspace";

export const Route = createFileRoute("/dashboard/hirer/messages")({
  component: HirerMessagesPage,
});

function HirerMessagesPage() {
  const search = Route.useSearch() as { conversationId?: string };
  return (
    <MessagingWorkspace
      role="hirer"
      basePath="/dashboard/hirer/messages"
      conversationId={search.conversationId}
    />
  );
}
