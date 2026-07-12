import { createFileRoute } from "@tanstack/react-router";

import { JobProposalsDashboard } from "@/components/hirer/job-proposals-dashboard";

export const Route = createFileRoute("/dashboard/hirer/jobs/$jobId/proposals")({
  component: HirerJobProposalsPage,
});

function HirerJobProposalsPage() {
  const { jobId } = Route.useParams();
  return <JobProposalsDashboard jobId={jobId} />;
}
