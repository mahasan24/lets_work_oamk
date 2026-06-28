import { Badge } from "@lets_work/ui/components/badge";
import { buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent } from "@lets_work/ui/components/card";
import { cn } from "@lets_work/ui/lib/utils";
import { Link } from "@tanstack/react-router";

import { JobList } from "@/components/hirer/job-list";
import { Route } from "@/routes/dashboard/hirer/route";

export default function HirerHome() {
  const { profile } = Route.useRouteContext();
  const completion = profile?.profileCompletion ?? 0;
  const showProfilePrompt = completion < 100;

  return (
    <div className="flex flex-col gap-6">
      {showProfilePrompt ? (
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
      ) : null}

      <JobList />
    </div>
  );
}
