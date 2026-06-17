import { Link } from "@tanstack/react-router";

import { cn } from "@lets_work/ui/lib/utils";

type LogoProps = {
  className?: string;
  variant?: "default" | "light";
};

export default function Logo({ className, variant = "default" }: LogoProps) {
  return (
    <Link
      to="/"
      className={cn(
        "font-display text-[1.35rem] font-extrabold leading-none tracking-[-0.04em]",
        variant === "light" ? "text-background" : "text-foreground",
        className,
      )}
    >
      letswork
    </Link>
  );
}
