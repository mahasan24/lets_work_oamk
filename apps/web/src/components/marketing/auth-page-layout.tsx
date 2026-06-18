import AuthMobileHeader from "./auth-mobile-header";
import AuthPanel from "./auth-panel";

export default function AuthPageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <AuthPanel />
      <div className="flex flex-1 flex-col bg-background">
        <AuthMobileHeader />
        <div className="flex flex-1 items-center justify-center px-6 py-10 lg:px-16 xl:px-24">
          {children}
        </div>
      </div>
    </div>
  );
}
