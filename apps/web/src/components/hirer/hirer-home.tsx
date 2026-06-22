import { Badge } from "@lets_work/ui/components/badge";
import { Button, buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { cn } from "@lets_work/ui/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";

const MOCK_POSTED_JOBS = [
  {
    id: "1",
    title: "Full-stack developer for marketplace MVP",
    status: "Open",
    proposals: "8 proposals",
    posted: "Posted 2 days ago",
  },
  {
    id: "2",
    title: "UI/UX designer for mobile app redesign",
    status: "Draft",
    proposals: "0 proposals",
    posted: "Last edited yesterday",
  },
] as const;

export default function HirerHome() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-xl flex-col gap-2">
            <Badge variant="secondary" className="w-fit">
              Client account
            </Badge>
            <h2 className="text-lg font-semibold">Complete your hiring profile</h2>
            <p className="text-sm text-muted-foreground">
              Verified clients with complete company details receive better proposals from top
              talent.
            </p>
          </div>
          <Link to="/dashboard/hirer/profile" className={cn(buttonVariants(), "shrink-0")}>
            Complete your profile
          </Link>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Your job posts</h2>
        <Button disabled>Post a job</Button>
      </div>

      <div className="flex flex-col gap-3">
        {MOCK_POSTED_JOBS.map((job) => (
          <Card key={job.id}>
            <CardHeader className="gap-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">
                    {job.posted} · {job.proposals}
                  </p>
                  <CardTitle className="text-base leading-snug font-semibold">{job.title}</CardTitle>
                </div>
                <Badge variant={job.status === "Open" ? "default" : "secondary"}>{job.status}</Badge>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
