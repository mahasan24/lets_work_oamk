import { authOpenAPI } from "@lets_work/auth/openapi";
import { env } from "@lets_work/env/server";
import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";

import { OPENAPI_TAGS } from "../lib/openapi-tags";

const [authPaths, authComponents] = await Promise.all([
  authOpenAPI.getPaths("/api/auth"),
  authOpenAPI.getComponents(),
]);

export const openapiPlugin = new Elysia({ name: "openapi" }).use(
  openapi({
    documentation: {
      info: {
        title: "Let's Work API",
        version: "1.0.0",
        description:
          "REST API for the Let's Work freelance marketplace. Authenticated routes require a valid Better Auth session cookie.",
      },
      tags: [...OPENAPI_TAGS],
      servers: [
        {
          url: env.BETTER_AUTH_URL,
          description: "API server",
        },
      ],
      components: {
        ...(authComponents as Record<string, unknown>),
        securitySchemes: {
          cookieAuth: {
            type: "apiKey",
            in: "cookie",
            name: "better-auth.session_token",
            description: "Session cookie issued by Better Auth after sign-in",
          },
        },
      },
      paths: authPaths as never,
    },
    scalar: {
      layout: "modern",
      theme: "purple",
      defaultHttpClient: {
        targetKey: "js",
        clientKey: "fetch",
      },
    },
    exclude: {
      paths: ["/openapi", "/openapi/json"],
    },
  }),
);
