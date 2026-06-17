import { Badge } from "@lets_work/ui/components/badge";
import { Button, buttonVariants } from "@lets_work/ui/components/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@lets_work/ui/components/input-group";
import { cn } from "@lets_work/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Briefcase, Search, Sparkles, Users } from "lucide-react";

import { AUTH_BACKGROUND_IMAGE } from "./auth-image";
import LandingStatsBento from "./landing-stats-bento";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function LandingPage() {
  return (
    <div className="flex flex-col bg-background">
      <section className="bg-background">
        <motion.div
          className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-20 pt-6 md:pt-10"
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: 0.1 }}
        >
          <motion.div
            variants={fadeUp}
            className="flex max-w-2xl flex-col gap-5"
          >
            <Badge variant="secondary" className="w-fit">
              <Sparkles data-icon="inline-start" />
              AI-powered matching
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
              How work <span className="text-primary">should work</span>
            </h1>
            <p className="max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
              Connect with freelancers, submit proposals, and manage contracts —
              with escrow payments built in.
            </p>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="flex max-w-2xl flex-col gap-4"
          >
            <InputGroup className="h-11 bg-card">
              <InputGroupAddon align="inline-start">
                <Search />
              </InputGroupAddon>
              <InputGroupInput placeholder="Search by role, skill, or keyword" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton variant="default" size="sm" className="px-4">
                  Search
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link
              to="/login"
              className={cn(buttonVariants({ size: "lg" }), "h-10 px-6")}
            >
              <Briefcase data-icon="inline-start" />
              Hire talent
            </Link>
            <Link
              to="/login"
              className={cn(
                buttonVariants({ variant: "ghost", size: "lg" }),
                "h-10",
              )}
            >
              <Users data-icon="inline-start" />
              Find work
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <LandingStatsBento />

      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="relative min-h-90 overflow-hidden ring-1 ring-foreground/10 md:min-h-105">
          <img
            src={AUTH_BACKGROUND_IMAGE}
            alt=""
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-r from-foreground/90 via-foreground/75 to-foreground/35"
          />
          <div className="relative flex h-full min-h-90 flex-col justify-between gap-10 p-10 md:min-h-105 md:flex-row md:items-end md:p-14">
            <div className="flex max-w-xl flex-col gap-4">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-background md:text-4xl lg:text-5xl">
                Start your next project
              </h2>
              <p className="max-w-md text-base leading-relaxed text-background/85 md:text-lg">
                Create a free account to post jobs, send proposals, or browse
                talent from anywhere in the world.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link
                to="/login"
                className={cn(buttonVariants({ size: "lg" }), "h-11 px-6")}
              >
                Get started
                <ArrowRight data-icon="inline-end" />
              </Link>
              <Link
                to="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-11 border-background/50 bg-background/10 px-6 text-background hover:bg-background/20 hover:text-background",
                )}
              >
                Browse talent
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
