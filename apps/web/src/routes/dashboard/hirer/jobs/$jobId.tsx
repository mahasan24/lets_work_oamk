import { createFileRoute } from "@tanstack/react-router";

import JobFormWizard from "@/components/hirer/job-form-wizard";

export const Route = createFileRoute("/dashboard/hirer/jobs/$jobId")({
  component: EditJobPage,
});

function EditJobPage() {
  const { jobId } = Route.useParams();
  return <JobFormWizard jobId={jobId} />;
}
