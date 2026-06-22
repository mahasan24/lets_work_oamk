import { createFileRoute } from "@tanstack/react-router";

import ProfileEditor from "@/components/dashboard/profile-editor";

export const Route = createFileRoute("/dashboard/freelancer/profile")({
  component: FreelancerProfilePage,
});

function FreelancerProfilePage() {
  return <ProfileEditor />;
}
