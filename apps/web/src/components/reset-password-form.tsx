import { Button, buttonVariants } from "@lets_work/ui/components/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@lets_work/ui/components/field";
import { Input } from "@lets_work/ui/components/input";
import { cn } from "@lets_work/ui/lib/utils";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

export default function ResetPasswordForm() {
  const navigate = useNavigate({ from: "/reset-password" });
  const { token, error } = useSearch({ from: "/reset-password" });

  const form = useForm({
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      if (!token) {
        toast.error("This reset link is invalid or has expired.");
        return;
      }

      await authClient.resetPassword(
        {
          newPassword: value.password,
          token,
        },
        {
          onSuccess: () => {
            toast.success("Password updated. You can log in now.");
            navigate({ to: "/login" });
          },
          onError: (resetError) => {
            toast.error(resetError.error.message || resetError.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z
        .object({
          password: z.string().min(8, "Password must be at least 8 characters"),
          confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: "Passwords do not match",
          path: ["confirmPassword"],
        }),
    },
  });

  if (error === "INVALID_TOKEN" || !token) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold tracking-tight">Link expired</h1>
          <p className="text-sm text-muted-foreground">
            This password reset link is invalid or has expired. Request a new one to continue.
          </p>
        </div>
        <Link
          to="/forgot-password"
          className={cn(buttonVariants({ size: "lg" }), "h-10 w-full justify-center")}
        >
          Request new link
        </Link>
        <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
          ← Back to log in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Reset password</h1>
        <p className="text-sm text-muted-foreground">Choose a new password for your account.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field name="password">
            {(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel htmlFor={field.name}>New password</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  autoComplete="new-password"
                  className="h-10"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
                  autoComplete="new-password"
                  className="h-10"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )}
          </form.Field>

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting,
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                type="submit"
                size="lg"
                className="h-10 w-full"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? "Updating..." : "Update password"}
              </Button>
            )}
          </form.Subscribe>
        </FieldGroup>
      </form>

      <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
        ← Back to log in
      </Link>
    </div>
  );
}
