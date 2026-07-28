import { cors } from "@elysiajs/cors";
import { auth } from "@lets_work/auth";
import { env } from "@lets_work/env/server";
import { Elysia } from "elysia";

import { resolveError } from "./lib/errors";
import { openapiPlugin } from "./plugins/openapi";
import { adminRoutes } from "./routes/admin";
import { chatRoutes } from "./routes/chat";
import { contractRoutes } from "./routes/contracts";
import { contractMilestoneRoutes, milestoneActionRoutes } from "./routes/milestones";
import { profileRoutes } from "./routes/profile";
import { hirerProposalRoutes } from "./routes/hirer-proposals";
import { hirerJobRoutes, jobRoutes } from "./routes/jobs";
import { notificationRoutes } from "./routes/notifications";
import { freelancerJobFeedRoutes } from "./routes/freelancer-jobs";
import { freelancerProposalRoutes } from "./routes/proposals";
import { clientDirectoryRoutes, freelancerDirectoryRoutes } from "./routes/public-profiles";
import { realtimeRoutes } from "./routes/realtime";

new Elysia()
  .use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  )
  .onError(({ code, error, set }) => {
    // Framework-level errors don't flow through our AppError hierarchy, so map
    // the well-known Elysia codes explicitly and let everything else resolve.
    if (code === "VALIDATION") {
      set.status = 422;
      return { error: error.message, code: "VALIDATION" };
    }
    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not found", code: "NOT_FOUND" };
    }
    if (code === "PARSE") {
      set.status = 400;
      return { error: "Malformed request body", code: "PARSE" };
    }

    const resolved = resolveError(error);
    set.status = resolved.status;
    return resolved.body;
  })
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
  .use(freelancerDirectoryRoutes)
  .use(clientDirectoryRoutes)
  .use(jobRoutes)
  .use(hirerJobRoutes)
  .use(hirerProposalRoutes)
  .use(freelancerProposalRoutes)
  .use(freelancerJobFeedRoutes)
  .use(contractRoutes)
  .use(contractMilestoneRoutes)
  .use(milestoneActionRoutes)
  .use(notificationRoutes)
  .use(chatRoutes)
  .use(adminRoutes)
  .use(realtimeRoutes)
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
