import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import Loader from "@/components/loader";
import { jobsApi } from "@/lib/jobs-api";

export const Route = createFileRoute("/dashboard/hirer/jobs/new")({
  component: NewJobPage,
});

function NewJobPage() {
  const navigate = useNavigate();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    jobsApi
      .create({ title: "Untitled job", budgetType: "one_time" })
      .then((job) => {
        navigate({
          to: "/dashboard/hirer/jobs/$jobId",
          params: { jobId: job.id },
          replace: true,
        });
      })
      .catch(() => {
        toast.error("Failed to create job draft");
        navigate({ to: "/dashboard/hirer", replace: true });
      });
  }, [navigate]);

  return <Loader />;
}
