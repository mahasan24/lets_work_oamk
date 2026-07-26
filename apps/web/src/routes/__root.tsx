import { Toaster } from "@lets_work/ui/components/sonner";
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";

import "../index.css";

// Router context is intentionally open for future providers to extend.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RouterAppContext {}

const APP_ROUTES = ["/success", "/success/"];

const AUTH_ROUTES = [
  "/login",
  "/login/",
  "/forgot-password",
  "/forgot-password/",
  "/reset-password",
  "/reset-password/",
];

const PUBLIC_CONTENT_ROUTES = ["/freelancers", "/clients"];

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "Lets Work — Hire freelancers or find work",
      },
      {
        name: "description",
        content:
          "Connect with top freelancers or find your next opportunity. Post jobs, submit proposals, and get paid securely.",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

function RootComponent() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDashboardRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isAppRoute = APP_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const isAuthRoute = AUTH_ROUTES.includes(pathname);
  const isMarketingRoute = pathname === "/" || isAuthRoute;
  const isPublicContentRoute = PUBLIC_CONTENT_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        disableTransitionOnChange
        storageKey="vite-ui-theme"
      >
        {isDashboardRoute ? (
          <div className="grid h-svh grid-rows-[1fr]">
            <Outlet />
          </div>
        ) : isAppRoute ? (
          <div className="grid h-svh grid-rows-[auto_1fr]">
            <Header />
            <Outlet />
          </div>
        ) : isPublicContentRoute ? (
          <div className="min-h-svh">
            <Header />
            <Outlet />
          </div>
        ) : (
          <div className={isMarketingRoute ? "min-h-svh" : "grid h-svh grid-rows-[auto_1fr]"}>
            {!isMarketingRoute && <Header />}
            <Outlet />
          </div>
        )}
        <Toaster richColors />
      </ThemeProvider>
      <TanStackRouterDevtools position="bottom-left" />
    </>
  );
}
