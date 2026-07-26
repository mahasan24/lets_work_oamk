import { buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent } from "@lets_work/ui/components/card";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { cn } from "@lets_work/ui/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";

import { ClientPublicProfile } from "@/components/public/client-profile";
import { publicProfilesApi, type PublicClientProfile } from "@/lib/public-profiles-api";

export const Route = createFileRoute("/clients/$userId")({
  loader: async ({ params }): Promise<{ profile: PublicClientProfile | null }> => {
    try {
      return { profile: await publicProfilesApi.getClient(params.userId) };
    } catch {
      return { profile: null };
    }
  },
  head: ({ loaderData }) => {
    const profile = loaderData?.profile;
    if (!profile) return { meta: [{ title: "Client not found — Lets Work" }] };

    const displayName = profile.companyName ?? profile.name;

    return {
      meta: [
        { title: `${displayName} — Lets Work` },
        {
          name: "description",
          content:
            profile.headline ??
            profile.companyDescription?.slice(0, 160) ??
            `View ${displayName}'s hiring profile on Lets Work.`,
        },
      ],
    };
  },
  pendingComponent: () => <Skeleton className="h-64 w-full" />,
  component: ClientProfilePage,
});

function ClientProfilePage() {
  const { profile } = Route.useLoaderData();

  if (!profile) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6">
          <div>
            <p className="font-medium">Client not found</p>
            <p className="text-sm text-muted-foreground">
              This profile may have been removed or is not public yet.
            </p>
          </div>
          <Link to="/" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to home
          </Link>
        </CardContent>
      </Card>
    );
  }

  return <ClientPublicProfile profile={profile} />;
}
