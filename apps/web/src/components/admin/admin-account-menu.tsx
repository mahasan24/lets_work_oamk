import { Button } from "@lets_work/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@lets_work/ui/components/dropdown-menu";
import { Link, useNavigate } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export default function AdminAccountMenu() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  if (!session) {
    return (
      <Button variant="ghost" size="sm" render={<Link to="/admin/login" />} nativeButton={false}>
        Sign in
      </Button>
    );
  }

  return (
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
          <DropdownMenuLabel>Admin</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="font-normal text-muted-foreground">
            <span className="block break-all">{session.user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              void navigate({ to: "/admin/account" });
            }}
          >
            Account
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              void authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    window.location.assign("/admin/login");
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
  );
}
