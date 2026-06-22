import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import ResetPasswordForm from "@/components/reset-password-form";
import AuthPageLayout from "@/components/marketing/auth-page-layout";

const resetPasswordSearchSchema = z.object({
  token: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/reset-password/")({
  validateSearch: resetPasswordSearchSchema,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  return (
    <AuthPageLayout>
      <ResetPasswordForm />
    </AuthPageLayout>
  );
}
