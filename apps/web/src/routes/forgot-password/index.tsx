import { createFileRoute } from "@tanstack/react-router";

import ForgotPasswordForm from "@/components/forgot-password-form";
import AuthPageLayout from "@/components/marketing/auth-page-layout";

export const Route = createFileRoute("/forgot-password/")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  return (
    <AuthPageLayout>
      <ForgotPasswordForm />
    </AuthPageLayout>
  );
}
