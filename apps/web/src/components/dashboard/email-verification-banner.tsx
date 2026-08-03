import { Alert, AlertDescription, AlertTitle } from "@lets_work/ui/components/alert";
import { Button } from "@lets_work/ui/components/button";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export function EmailVerificationBanner() {
  const { data: session } = authClient.useSession();
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  if (!session?.user || session.user.emailVerified) {
    return null;
  }

  const resend = () => {
    startTransition(async () => {
      const { error } = await authClient.sendVerificationEmail({
        email: session.user.email,
        callbackURL: `${window.location.origin}/dashboard?verified=1`,
      });
      if (error) {
        toast.error(error.message || "Failed to send verification email");
        return;
      }
      setSent(true);
      toast.success("Verification email sent");
    });
  };

  return (
    <Alert>
      <AlertTitle>Verify your email</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          We sent a link to <strong>{session.user.email}</strong>. Verify your email to unlock the
          full account experience.
          {sent ? " Check your inbox for a new link." : null}
        </span>
        <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={resend}>
          {isPending ? "Sending…" : sent ? "Resend again" : "Resend email"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
