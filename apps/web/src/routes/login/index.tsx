import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import AuthPageLayout from "@/components/marketing/auth-page-layout";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

const loginSearchSchema = z.object({
  mode: z.enum(["sign-in", "sign-up"]).optional().default("sign-in"),
});

export const Route = createFileRoute("/login/")({
  validateSearch: loginSearchSchema,
  component: LoginPage,
});

function LoginPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const setMode = (next: "sign-in" | "sign-up") => {
    void navigate({
      search: (prev) => ({ ...prev, mode: next }),
      replace: true,
    });
  };

  return (
    <AuthPageLayout>
      {mode === "sign-in" ? (
        <SignInForm onSwitchToSignUp={() => setMode("sign-up")} />
      ) : (
        <SignUpForm onSwitchToSignIn={() => setMode("sign-in")} />
      )}
    </AuthPageLayout>
  );
}
