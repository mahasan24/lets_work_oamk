import { buttonVariants } from "@lets_work/ui/components/button";
import { cn } from "@lets_work/ui/lib/utils";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";

import UserMenu from "@/components/user-menu";

import { AnimatedNavLink, navActions, navList, navLogo } from "./animated-nav-link";
import Logo from "./logo";

const navLinks = [
  { label: "Find talent", href: "/login", isRouter: true },
  { label: "Find work", href: "/login", isRouter: true },
] as const;

export default function MarketingHeader() {
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
            {navLinks.map(({ label, href, isRouter }) => (
              <AnimatedNavLink key={label} href={href} isRouter={isRouter}>
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
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "text-foreground",
                )}
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
