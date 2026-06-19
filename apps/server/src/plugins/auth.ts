import { auth } from "@lets_work/auth";
import { Elysia } from "elysia";

export const betterAuthPlugin = new Elysia({ name: "better-auth" }).macro({
  auth: {
    async resolve({ status, request: { headers } }) {
      const session = await auth.api.getSession({ headers });

      if (!session) {
        return status(401, { error: "Unauthorized" });
      }

      return {
        user: session.user,
        session: session.session,
      };
    },
  },
});
