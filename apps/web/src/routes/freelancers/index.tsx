import { createFileRoute } from "@tanstack/react-router";

import { FreelancerDirectory } from "@/components/public/freelancer-directory";

export const Route = createFileRoute("/freelancers/")({
  component: FreelancerDirectory,
  head: () => ({
    meta: [
      { title: "Find freelancers — Lets Work" },
      {
        name: "description",
        content:
          "Browse and filter freelancers by skill, country, hourly rate, and rating on Lets Work.",
      },
    ],
  }),
});
