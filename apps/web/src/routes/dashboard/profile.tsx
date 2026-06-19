import { createFileRoute } from "@tanstack/react-router";

import ProfileEditor from "@/components/dashboard/profile-editor";

export const Route = createFileRoute("/dashboard/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  return <ProfileEditor />;
}
