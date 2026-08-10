import { Button } from "@lets_work/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lets_work/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@lets_work/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@lets_work/ui/components/field";
import { Input } from "@lets_work/ui/components/input";
import { env } from "@lets_work/env/web";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

type DeleteAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const reset = () => {
    setPassword("");
    setConfirmText("");
    setIsDeleting(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleDelete = async () => {
    if (confirmText !== "DELETE") {
      toast.error("Type DELETE to confirm");
      return;
    }

    setIsDeleting(true);
    try {
      const { error, data } = await authClient.deleteUser({
        callbackURL: env.VITE_APP_URL,
        ...(password.trim() ? { password: password.trim() } : {}),
      });

      if (error) {
        toast.error(error.message || "Could not delete account");
        return;
      }

      if (data?.message === "Verification email sent") {
        toast.success("Check your email to confirm account deletion");
        handleOpenChange(false);
        return;
      }

      toast.success("Account deleted");
      handleOpenChange(false);
      await navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete account permanently?</DialogTitle>
          <DialogDescription>
            This permanently removes your profile, jobs, proposals, contracts, messages, and payment
            records. You will receive a confirmation email — open that link while signed in to
            finish deletion.
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="delete-account-confirm">Type DELETE to confirm</FieldLabel>
            <Input
              id="delete-account-confirm"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
              placeholder="DELETE"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="delete-account-password">
              Password (if you use email login)
            </FieldLabel>
            <Input
              id="delete-account-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Optional for Google sign-in"
            />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting || confirmText !== "DELETE"}
            onClick={() => {
              void handleDelete();
            }}
          >
            {isDeleting ? "Sending…" : "Delete account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>
            Permanently delete your Lets Work account and all associated data. This cannot be
            undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
            Delete account
          </Button>
        </CardContent>
      </Card>
      <DeleteAccountDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
