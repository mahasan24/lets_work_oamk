import { createFileRoute } from "@tanstack/react-router";

import HirerProfileEditor from "@/components/hirer/hirer-profile-editor";

export const Route = createFileRoute("/dashboard/hirer/profile")({
  component: HirerProfilePage,
});

function HirerProfilePage() {
  return <HirerProfileEditor />;
}
