import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";

import AdminShellLayout from "@/components/admin/admin-shell-layout";
import { adminApi, AdminApiError } from "@/lib/admin-api";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/admin")({
  component: AdminRouteLayout,
  beforeLoad: async ({ location }) => {
    const isLogin = location.pathname === "/admin/login" || location.pathname === "/admin/login/";

    if (isLogin) {
      return { isAdminLogin: true as const };
    }

    const session = await authClient.getSession();
    if (!session.data) {
      redirect({ to: "/admin/login", throw: true });
    }

    try {
      const me = await adminApi.getMe();
      if (!me.isAdmin) {
        await authClient.signOut();
        redirect({ to: "/admin/login", throw: true });
      }
      return { isAdmin: true as const, adminMe: me };
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) {
        redirect({ to: "/admin/login", throw: true });
      }
      redirect({ to: "/admin/login", throw: true });
    }
  },
});

function AdminRouteLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isLogin = pathname === "/admin/login" || pathname === "/admin/login/";

  if (isLogin) {
    return <Outlet />;
  }

  return (
    <AdminShellLayout>
      <Outlet />
    </AdminShellLayout>
  );
}
