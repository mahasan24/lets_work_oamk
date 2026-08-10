import type { ReactNode } from "react";
import { useState } from "react";

import { Button, buttonVariants } from "@lets_work/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@lets_work/ui/components/dropdown-menu";
import { Skeleton } from "@lets_work/ui/components/skeleton";
import { cn } from "@lets_work/ui/lib/utils";
import { Link, useNavigate } from "@tanstack/react-router";

import { DeleteAccountDialog } from "@/components/account/delete-account-section";
import { authClient } from "@/lib/auth-client";

type UserMenuProps = {
  signUpButton?: ReactNode;
};

export default function UserMenu({ signUpButton }: UserMenuProps = {}) {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (isPending) {
    return <Skeleton className="h-9 w-20" />;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-1">
        <Link
          to="/login"
          search={{ mode: "sign-in" }}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "text-muted-foreground hover:text-foreground",
          )}
        >
          Log in
        </Link>
        {signUpButton ?? (
          <Link
            to="/login"
            search={{ mode: "sign-up" }}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "text-muted-foreground hover:text-foreground",
            )}
          >
            Sign up
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            />
          }
        >
          {session.user.name}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="!w-56 min-w-56 bg-card">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              <span className="block break-all">{session.user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => {
                navigate({ to: "/dashboard" });
              }}
            >
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              Delete account
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      navigate({ to: "/" });
                    },
                  },
                });
              }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
