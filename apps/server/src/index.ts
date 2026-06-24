import { cors } from "@elysiajs/cors";
import { auth } from "@lets_work/auth";
import { env } from "@lets_work/env/server";
import { Elysia } from "elysia";

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
  .all("/api/auth/*", async (context) => {
    const { request, status } = context;
    if (["POST", "GET"].includes(request.method)) {
      return auth.handler(request);
    }
    return status(405);
  })
  .use(profileRoutes)
  .use(jobRoutes)
  .use(hirerJobRoutes)
  .get("/", () => "OK")
  .listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
  });
