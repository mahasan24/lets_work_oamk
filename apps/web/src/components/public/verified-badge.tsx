import { Badge } from "@lets_work/ui/components/badge";
import { BadgeCheck } from "lucide-react";

export function VerifiedBadge({ verified }: { verified: boolean }) {
  if (!verified) return null;

  return (
    <Badge variant="secondary" className="gap-1">
      <BadgeCheck className="size-3.5" aria-hidden />
      Verified
    </Badge>
  );
}
