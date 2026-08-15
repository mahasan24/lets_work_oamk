import { Button } from "@lets_work/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lets_work/ui/components/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@lets_work/ui/components/field";
import { Input } from "@lets_work/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/admin/account/")({
  component: AdminAccountPage,
});

function AdminAccountPage() {
  const { data: session } = authClient.useSession();

  const emailForm = useForm({
    defaultValues: {
      email: "",
    },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.changeEmail({
        newEmail: value.email.trim(),
      });
      if (error) {
        toast.error(error.message || "Could not update email");
        return;
      }
      toast.success("Email updated");
      await authClient.getSession();
    },
    validators: {
      onSubmit: z.object({
        email: z.email("Invalid email address"),
      }),
    },
  });

  useEffect(() => {
    if (session?.user.email) {
      emailForm.setFieldValue("email", session.user.email);
    }
  }, [session?.user.email]);

  const passwordForm = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      if (value.newPassword !== value.confirmPassword) {
        toast.error("New passwords do not match");
        return;
      }
      const { error } = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        toast.error(error.message || "Could not update password");
        return;
      }
      toast.success("Password updated");
      passwordForm.reset();
    },
    validators: {
      onSubmit: z
        .object({
          currentPassword: z.string().min(8, "Current password is required"),
          newPassword: z.string().min(8, "Password must be at least 8 characters"),
          confirmPassword: z.string().min(8),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: "Passwords do not match",
          path: ["confirmPassword"],
        }),
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Admin account</h1>
        <p className="text-sm text-muted-foreground">
          Update the email and password used for the admin console.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>{session?.user.name ?? "Admin"}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void emailForm.handleSubmit();
            }}
          >
            <FieldGroup>
              <emailForm.Field name="email">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                      <Input
                        id={field.name}
                        type="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={isInvalid}
                        autoComplete="email"
                      />
                      {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                    </Field>
                  );
                }}
              </emailForm.Field>
            </FieldGroup>
            <Button type="submit" className="w-fit">
              Save email
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Changing password revokes other active admin sessions.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void passwordForm.handleSubmit();
            }}
          >
            <FieldGroup>
              <passwordForm.Field name="currentPassword">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Current password</FieldLabel>
                      <Input
                        id={field.name}
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
              </passwordForm.Field>
              <passwordForm.Field name="newPassword">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>New password</FieldLabel>
                      <Input
                        id={field.name}
                        type="password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={isInvalid}
                        autoComplete="new-password"
                      />
                      {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                    </Field>
                  );
                }}
              </passwordForm.Field>
              <passwordForm.Field name="confirmPassword">
                {(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel htmlFor={field.name}>Confirm new password</FieldLabel>
                      <Input
                        id={field.name}
                        type="password"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={isInvalid}
                        autoComplete="new-password"
                      />
                      {isInvalid ? <FieldError errors={field.state.meta.errors} /> : null}
                    </Field>
                  );
                }}
              </passwordForm.Field>
            </FieldGroup>
            <Button type="submit" className="w-fit">
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
