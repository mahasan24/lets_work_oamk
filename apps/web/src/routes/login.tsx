import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import AuthPageLayout from "@/components/marketing/auth-page-layout";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-up");

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
