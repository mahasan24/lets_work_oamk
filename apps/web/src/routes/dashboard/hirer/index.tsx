import { createFileRoute } from "@tanstack/react-router";

import HirerHome from "@/components/hirer/hirer-home";

export const Route = createFileRoute("/dashboard/hirer/")({
  component: HirerHome,
});
