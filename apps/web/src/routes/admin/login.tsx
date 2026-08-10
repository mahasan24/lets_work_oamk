import { createFileRoute, redirect } from "@tanstack/react-router";

import AdminSignInForm from "@/components/admin/admin-sign-in-form";
import AuthPageLayout from "@/components/marketing/auth-page-layout";
import { adminApi } from "@/lib/admin-api";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data) return;

    try {
      const me = await adminApi.getMe();
      if (me.isAdmin) {
        redirect({ to: "/admin", throw: true });
      }
    } catch {
      // stay on login
    }
  },
});

function AdminLoginPage() {
  return (
    <AuthPageLayout>
      <AdminSignInForm />
    </AuthPageLayout>
  );
}
