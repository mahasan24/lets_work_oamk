import { createFileRoute } from "@tanstack/react-router";

import { MessagingWorkspace } from "@/components/chat/messaging-workspace";

export const Route = createFileRoute("/dashboard/freelancer/messages")({
  component: FreelancerMessagesPage,
});

function FreelancerMessagesPage() {
  const search = Route.useSearch() as { conversationId?: string };
  return (
    <MessagingWorkspace
      role="freelancer"
      basePath="/dashboard/freelancer/messages"
      conversationId={search.conversationId}
    />
  );
}
