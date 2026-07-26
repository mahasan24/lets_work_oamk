import { buttonVariants } from "@lets_work/ui/components/button";
import { Card, CardContent } from "@lets_work/ui/components/card";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { cn } from "@lets_work/ui/lib/utils";
import { createFileRoute, Link } from "@tanstack/react-router";

import { FreelancerPublicProfile } from "@/components/public/freelancer-profile";
import { publicProfilesApi, type PublicFreelancerProfile } from "@/lib/public-profiles-api";

export const Route = createFileRoute("/freelancers/$userId")({
  loader: async ({ params }): Promise<{ profile: PublicFreelancerProfile | null }> => {
    try {
      return { profile: await publicProfilesApi.getFreelancer(params.userId) };
    } catch {
      return { profile: null };
    }
  },
  head: ({ loaderData }) => {
    const profile = loaderData?.profile;
    if (!profile) return { meta: [{ title: "Freelancer not found — Lets Work" }] };

    return {
      meta: [
        { title: `${profile.name} — Lets Work` },
        {
          name: "description",
          content:
            profile.headline ??
            profile.bio?.slice(0, 160) ??
            `View ${profile.name}'s freelance profile on Lets Work.`,
        },
      ],
    };
  },
  pendingComponent: () => <Skeleton className="h-64 w-full" />,
  component: FreelancerProfilePage,
});

function FreelancerProfilePage() {
  const { profile } = Route.useLoaderData();

  if (!profile) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6">
          <div>
            <p className="font-medium">Freelancer not found</p>
            <p className="text-sm text-muted-foreground">
              This profile may have been removed or is not public yet.
            </p>
          </div>
          <Link to="/freelancers" className={cn(buttonVariants({ variant: "outline" }))}>
            Back to search
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to="/freelancers" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to search
      </Link>
      <FreelancerPublicProfile profile={profile} />
    </div>
  );
}
