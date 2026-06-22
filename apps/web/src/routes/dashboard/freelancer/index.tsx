import { Badge } from "@lets_work/ui/components/badge";
import { Button, buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import { Input } from "@lets_work/ui/components/input";
import { cn } from "@lets_work/ui/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Search, ThumbsDown } from "lucide-react";

const MOCK_JOBS = [
  {
    id: "1",
    posted: "Posted 12 minutes ago",
    proposals: "5 proposals",
    title: "Senior SaaS UI/UX Designer & React Developer for Dashboard",
    type: "Fixed-price · Intermediate · Est. $2,500",
    description:
      "We need an experienced designer-developer to refine our analytics dashboard and ship responsive UI in React.",
  },
  {
    id: "2",
    posted: "Posted 1 hour ago",
    proposals: "12 proposals",
    title: "Full-stack engineer for marketplace MVP",
    type: "Hourly · Expert · $45-75/hr",
    description:
      "Looking for a developer familiar with TypeScript, PostgreSQL, and payment integrations to extend our platform.",
  },
  {
    id: "3",
    posted: "Posted 3 hours ago",
    proposals: "8 proposals",
    title: "Brand identity and landing page for fintech startup",
    type: "Fixed-price · Intermediate · Est. $800",
    description:
      "Create a cohesive visual identity and high-converting landing page with modern typography and illustration.",
  },
] as const;

export const Route = createFileRoute("/dashboard/freelancer/")({
  component: FreelancerDashboardHome,
});

function FreelancerDashboardHome() {
  return (
    <div className="flex flex-col gap-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex max-w-xl flex-col gap-2">
            <Badge variant="secondary" className="w-fit">
              Freelancer Plus
            </Badge>
            <h2 className="text-lg font-semibold">Stand out with a complete profile</h2>
            <p className="text-sm text-muted-foreground">
              Clients are more likely to hire freelancers with portfolios, certifications, and a
              video introduction.
            </p>
          </div>
          <Link
            to="/dashboard/freelancer/profile"
            className={cn(buttonVariants(), "shrink-0")}
          >
            Complete your profile
          </Link>
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-11 pl-10" placeholder="Search for jobs" readOnly />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold">Jobs you might like</h2>
          <Button variant="outline" size="sm" disabled>
            Filters
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {MOCK_JOBS.map((job) => (
            <Card key={job.id}>
              <CardHeader className="gap-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-muted-foreground">
                      {job.posted} · {job.proposals}
                    </p>
                    <CardTitle className="text-base leading-snug font-semibold">{job.title}</CardTitle>
                    <p className="text-sm text-muted-foreground">{job.type}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" disabled aria-label="Not interested">
                      <ThumbsDown />
                    </Button>
                    <Button variant="ghost" size="icon-sm" disabled aria-label="Save job">
                      <Heart />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="line-clamp-2 text-sm text-muted-foreground">{job.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
