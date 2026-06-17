import { Separator } from "@lets_work/ui/components/separator";
import { Link } from "@tanstack/react-router";

import Logo from "./logo";

const links = ["Terms", "Privacy", "Help", "About"] as const;

export default function MarketingFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Logo />

          <nav className="flex flex-wrap gap-6">
            {links.map((link) => (
              <Link
                key={link}
                to="/"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link}
              </Link>
            ))}
          </nav>
        </div>

        <Separator />

        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Lets Work</p>
      </div>
    </footer>
  );
}
