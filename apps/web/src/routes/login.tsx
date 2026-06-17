import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import AuthMobileHeader from "@/components/marketing/auth-mobile-header";
import AuthPanel from "@/components/marketing/auth-panel";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-up");

  return (
    <div className="flex min-h-svh">
      <AuthPanel />
      <div className="flex flex-1 flex-col bg-background">
        <AuthMobileHeader />
        <div className="flex flex-1 items-center justify-center px-6 py-10 lg:px-16 xl:px-24">
          {mode === "sign-in" ? (
            <SignInForm onSwitchToSignUp={() => setMode("sign-up")} />
          ) : (
            <SignUpForm onSwitchToSignIn={() => setMode("sign-in")} />
          )}
        </div>
      </div>
    </div>
  );
}
