import { Button } from "@lets_work/ui/components/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@lets_work/ui/components/field";
import { Input } from "@lets_work/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import z from "zod";

import { adminApi } from "@/lib/admin-api";
import { authClient } from "@/lib/auth-client";

import Loader from "@/components/loader";

export default function AdminSignInForm() {
  const navigate = useNavigate();
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
          onSuccess: async () => {
            try {
              const me = await adminApi.getMe();
              if (!me.isAdmin) {
                await authClient.signOut();
                toast.error("This account is not an admin");
                return;
              }
              toast.success("Welcome back");
              void navigate({ to: "/admin" });
            } catch {
              await authClient.signOut();
              toast.error("Could not verify admin access");
            }
          },
          onError: (error) => {
            const message = error.error.message || error.error.statusText;
            toast.error(
              message.toLowerCase().includes("verif")
                ? "Verify your email before signing in, or re-run the admin scaffold script."
                : message,
            );
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
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Admin</p>
        <h1 className="font-display text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use the credentials from <code className="text-xs">db:scaffold-admin</code>. Marketplace
          accounts cannot access this area.
        </p>
      </div>

      <form
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field name="email">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={isInvalid}
                    autoComplete="username"
                  />
                  {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                </Field>
              );
            }}
          </form.Field>
          <form.Field name="password">
            {(field) => {
              const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={isInvalid}
                    autoComplete="current-password"
                  />
                  {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                </Field>
              );
            }}
          </form.Field>
        </FieldGroup>
        <Button type="submit" className="w-full">
          Sign in to admin
        </Button>
      </form>
    </div>
  );
}
