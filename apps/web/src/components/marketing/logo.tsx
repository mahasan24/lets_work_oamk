import { cn } from "@lets_work/ui/lib/utils";

type LogoProps = {
  className?: string;
  variant?: "default" | "light";
};

export default function Logo({ className, variant = "default" }: LogoProps) {
  return (
    <span
      className={cn(
        "font-display text-[1.35rem] font-extrabold leading-none tracking-[-0.04em]",
        variant === "light" ? "text-background" : "text-foreground",
        className,
      )}
    >
      letswork
    </span>
  );
}
