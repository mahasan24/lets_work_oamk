import { Button } from "@lets_work/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@lets_work/ui/components/field";
import { Input } from "@lets_work/ui/components/input";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@lets_work/ui/components/toggle-group";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";
import { OAuthButtons } from "./oauth-buttons";

type AccountType = "hirer" | "freelancer";

export default function SignUpForm({
  onSwitchToSignIn,
}: {
  onSwitchToSignIn: () => void;
}) {
  const navigate = useNavigate({ from: "/" });
  const { isPending } = authClient.useSession();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      name: "",
      accountType: "freelancer" as AccountType,
    },
    onSubmit: async ({ value }) => {
      await authClient.signUp.email(
        {
          email: value.email,
          password: value.password,
          name: value.name,
        },
        {
          onSuccess: () => {
            navigate({ to: "/dashboard" });
            toast.success("Account created");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.email("Invalid email address"),
        password: z.string().min(8, "Password must be at least 8 characters"),
        accountType: z.enum(["hirer", "freelancer"]),
      }),
    },
  });

  if (isPending) {
    return <Loader />;
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Sign up
        </h1>
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={onSwitchToSignIn}
          >
            Log in
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
          <form.Field name="accountType">
            {(field) => (
              <Field>
                <FieldLabel>I want to</FieldLabel>
                <ToggleGroup
                  value={[field.state.value]}
                  onValueChange={(values) => {
                    const next = values.at(-1) as AccountType | undefined;
                    if (next) field.handleChange(next);
                  }}
                  className="grid w-full grid-cols-2"
                  spacing={0}
                  variant="outline"
                >
                  <ToggleGroupItem value="hirer" className="h-10 flex-1">
                    Hire talent
                  </ToggleGroupItem>
                  <ToggleGroupItem value="freelancer" className="h-10 flex-1">
                    Find work
                  </ToggleGroupItem>
                </ToggleGroup>
              </Field>
            )}
          </form.Field>

          <form.Field name="name">
            {(field) => (
              <Field
                data-invalid={field.state.meta.errors.length > 0 || undefined}
              >
                <FieldLabel htmlFor={field.name}>Full name</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
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

          <form.Field name="email">
            {(field) => (
              <Field
                data-invalid={field.state.meta.errors.length > 0 || undefined}
              >
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
              <Field
                data-invalid={field.state.meta.errors.length > 0 || undefined}
              >
                <FieldLabel htmlFor={field.name}>Password</FieldLabel>
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

          <FieldDescription>
            By signing up you agree to our Terms and Privacy Policy.
          </FieldDescription>

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
                {isSubmitting ? "Creating account..." : "Create account"}
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
