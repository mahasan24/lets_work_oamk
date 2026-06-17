import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";

import { cn } from "@lets_work/ui/lib/utils";

type NavLinkProps = {
  href: string;
  children: string;
  className?: string;
  isRouter?: boolean;
};

const item = {
  hidden: { opacity: 0, y: -6 },
  show: { opacity: 1, y: 0 },
};

export function AnimatedNavLink({ href, children, className, isRouter }: NavLinkProps) {
  const classes = cn(
    "relative text-sm text-muted-foreground transition-colors hover:text-foreground",
    className,
  );

  const underline = (
    <motion.span
      className="absolute -bottom-1 left-0 h-px w-full origin-left bg-foreground"
      initial={{ scaleX: 0 }}
      whileHover={{ scaleX: 1 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    />
  );

  if (isRouter) {
    return (
      <motion.div variants={item}>
        <Link to={href} className={cn(classes, "inline-block")}>
          {children}
          {underline}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.a href={href} className={cn(classes, "inline-block")} variants={item}>
      {children}
      {underline}
    </motion.a>
  );
}

export const navList = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.15 },
  },
};

export const navLogo = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

export const navActions = {
  hidden: { opacity: 0, x: 8 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const, delay: 0.2 },
  },
};
