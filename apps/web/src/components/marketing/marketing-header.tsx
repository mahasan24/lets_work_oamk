import { useEffect, useState } from "react";
import { buttonVariants } from "@lets_work/ui/components/button";
import { cn } from "@lets_work/ui/lib/utils";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";

import UserMenu from "@/components/user-menu";
import { authClient } from "@/lib/auth-client";
import { shouldShowFindWorkActions, shouldShowHireActions } from "@/lib/dashboard-paths";
import { profileApi, type ProfileBundle } from "@/lib/profile-api";

import { AnimatedNavLink, navActions, navList, navLogo } from "./animated-nav-link";
import Logo from "./logo";

export default function MarketingHeader() {
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

  // Logged-out visitors see both paths. Signed-in users only see their role's path.
  // Platform admins manage the marketplace from /admin, not hire/find-work chrome.
  const showFindTalent = !session || (!profile?.isAdmin && shouldShowHireActions(profile));
  const showFindWork = !session || (!profile?.isAdmin && shouldShowFindWorkActions(profile));

  const navLinks = [
    ...(profile?.isAdmin ? [{ label: "Admin", href: "/admin", isRouter: true as const }] : []),
    ...(showFindTalent
      ? [{ label: "Find talent", href: "/freelancers", isRouter: true as const }]
      : []),
    ...(showFindWork
      ? [
          {
            label: "Find work",
            href: session ? "/dashboard/freelancer" : "/login",
            search: session ? undefined : { mode: "sign-up" },
            isRouter: true as const,
          },
        ]
      : []),
  ];

  return (
    <header className="bg-background">
      <motion.div
        className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6"
        initial="hidden"
        animate="show"
      >
        <div className="flex items-center gap-10">
          <motion.div variants={navLogo}>
            <Logo />
          </motion.div>

          <motion.nav
            className="hidden items-center gap-8 md:flex"
            variants={navList}
            initial="hidden"
            animate="show"
          >
            {navLinks.map(({ label, href, isRouter, search }) => (
              <AnimatedNavLink key={label} href={href} isRouter={isRouter} search={search}>
                {label}
              </AnimatedNavLink>
            ))}
          </motion.nav>
        </div>

        <motion.div variants={navActions}>
          <UserMenu
            signUpButton={
              <Link
                to="/login"
                search={{ mode: "sign-up" }}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-foreground")}
              >
                Sign up
              </Link>
            }
          />
        </motion.div>
      </motion.div>
    </header>
  );
}
