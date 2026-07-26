import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { shouldShowHireActions } from "@/lib/dashboard-paths";
import { profileApi, type ProfileBundle } from "@/lib/profile-api";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const { data: session } = authClient.useSession();
  const [profile, setProfile] = useState<ProfileBundle | null>(null);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    profileApi
      .getMe()
      .then((bundle) => {
        if (!cancelled) setProfile(bundle);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  // Public visitors can browse talent. Freelancer-only accounts cannot hire.
  const showFindTalent = !session || shouldShowHireActions(profile);

  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <nav className="flex gap-4 text-lg">
          <Link to="/">Home</Link>
          {showFindTalent ? <Link to="/freelancers">Find talent</Link> : null}
          <Link to="/dashboard">Dashboard</Link>
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
