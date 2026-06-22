import { Button } from "@lets_work/ui/components/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@lets_work/ui/components/field";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@lets_work/ui/components/toggle-group";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { getDashboardHomePath } from "@/lib/dashboard-paths";
import { profileApi } from "@/lib/profile-api";

export const Route = createFileRoute("/dashboard/onboarding/role/")({
  component: RoleOnboardingPage,
  beforeLoad: ({ context }) => {
    if (context.profile?.profile.onboardingStep !== "role_selection") {
      redirect({ to: getDashboardHomePath(context.profile), throw: true });
    }
  },
});

type AccountType = "hirer" | "freelancer";

function RoleOnboardingPage() {
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState<AccountType>("freelancer");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const continueOnboarding = async () => {
    setIsSubmitting(true);
    try {
      const bundle = await profileApi.initialize(accountType);
      await navigate({ to: getDashboardHomePath(bundle) });
      toast.success("Welcome! Let's set up your profile.");
    } catch {
      toast.error("Failed to save your account type");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col justify-center gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">How will you use Lets Work?</h1>
        <p className="text-sm text-muted-foreground">
          Choose your account type to get the right dashboard and onboarding experience.
        </p>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel>I want to</FieldLabel>
          <ToggleGroup
            value={[accountType]}
            onValueChange={(values) => {
              const next = values.at(-1) as AccountType | undefined;
              if (next) setAccountType(next);
            }}
            className="grid w-full grid-cols-2"
            spacing={0}
            variant="outline"
          >
            <ToggleGroupItem value="hirer" className="h-10 flex-1">
              Hire talent
            </ToggleGroupItem>
            <ToggleGroupItem value="freelancer" className="h-10 flex-1">
              Find work
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
      </FieldGroup>

      <Button className="h-10" disabled={isSubmitting} onClick={continueOnboarding}>
        {isSubmitting ? "Continuing..." : "Continue"}
      </Button>
    </div>
  );
}
