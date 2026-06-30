import { cors } from "@elysiajs/cors";
import { auth } from "@lets_work/auth";
import { env } from "@lets_work/env/server";
import { Elysia } from "elysia";

import { openapiPlugin } from "./plugins/openapi";
import { adminRoutes } from "./routes/admin";
import { profileRoutes } from "./routes/profile";
import { hirerJobRoutes, jobRoutes } from "./routes/jobs";

new Elysia()
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  )
  .use(openapiPlugin)
  .all(
    "/api/auth/*",
    async (context) => {
      const { request, status } = context;
      if (["POST", "GET"].includes(request.method)) {
        return auth.handler(request);
      }
      return status(405);
    },
    {
      detail: {
        hide: true,
        summary: "Better Auth handler",
        description: "Documented via Better Auth OpenAPI integration.",
      },
    },
  )
  .use(profileRoutes)
  .use(jobRoutes)
  .use(hirerJobRoutes)
  .use(adminRoutes)
  .get("/", () => "OK", {
    detail: {
      tags: ["Health"],
      summary: "Health check",
      description: "Returns OK when the API server is running.",
    },
  })
  .listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
    console.log("OpenAPI docs at http://localhost:3000/openapi");
  });
