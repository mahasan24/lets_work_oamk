import { createFileRoute } from "@tanstack/react-router";

import LandingPage from "@/components/marketing/landing-page";
import MarketingFooter from "@/components/marketing/marketing-footer";
import MarketingHeader from "@/components/marketing/marketing-header";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <MarketingHeader />
      <main className="flex-1">
        <LandingPage />
      </main>
      <MarketingFooter />
    </div>
  );
}
