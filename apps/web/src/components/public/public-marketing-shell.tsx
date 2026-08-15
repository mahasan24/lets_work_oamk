import MarketingFooter from "@/components/marketing/marketing-footer";
import MarketingHeader from "@/components/marketing/marketing-header";

export default function PublicMarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <MarketingHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 md:px-6">{children}</main>
      <MarketingFooter />
    </div>
  );
}
