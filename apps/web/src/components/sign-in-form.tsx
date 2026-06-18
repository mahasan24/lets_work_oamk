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
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";
import { OAuthButtons } from "./oauth-buttons";

export default function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const navigate = useNavigate({ from: "/" });
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        {
          email: value.email,
          password: value.password,
        },
        {
          onSuccess: () => {
            navigate({ to: "/dashboard" });
            toast.success("Welcome back");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Log in</h1>
        <p className="text-sm text-muted-foreground">
          New here?{" "}
          <Button type="button" variant="link" className="h-auto p-0" onClick={onSwitchToSignUp}>
            Create an account
          </Button>
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field name="email">
            {(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
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

          <form.Field name="password">
            {(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <Link
                    to="/forgot-password"
                    className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto p-0 text-xs")}
                  >
                    Forgot?
                  </Link>
                </div>
                <Input
                  id={field.name}
                  name={field.name}
                  type="password"
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
            selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button
                type="submit"
                size="lg"
                className="h-10 w-full"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? "Logging in..." : "Log in"}
              </Button>
            )}
          </form.Subscribe>
        </FieldGroup>
      </form>

      <OAuthButtons />

      <Link to="/" className="text-sm text-muted-foreground hover:text-primary">
        ← Back to home
      </Link>
    </div>
  );
}
