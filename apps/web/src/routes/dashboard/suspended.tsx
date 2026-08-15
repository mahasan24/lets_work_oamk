import { Button } from "@lets_work/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lets_work/ui/components/card";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import Logo from "@/components/marketing/logo";
import { authClient } from "@/lib/auth-client";
import { Route as DashboardRoute } from "@/routes/dashboard/route";

export const Route = createFileRoute("/dashboard/suspended")({
  component: SuspendedPage,
});

function SuspendedPage() {
  const navigate = useNavigate();
  const { profile } = DashboardRoute.useRouteContext();
  const reason = profile?.profile.suspendReason;

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 bg-background px-4 py-16">
      <Logo />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Account suspended</CardTitle>
          <CardDescription>
            Your access to Lets Work is currently restricted by an administrator.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {reason ? <p className="text-sm text-muted-foreground">Reason: {reason}</p> : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    void navigate({ to: "/" });
                  },
                },
              });
            }}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
