import { Elysia, t } from "elysia";

import { runAction } from "../lib/http";
import { getInvoiceForUser, getInvoiceHtmlForUser, listInvoicesForUser } from "../lib/invoices";
import { COOKIE_AUTH_SECURITY } from "../lib/openapi-tags";
import { betterAuthPlugin } from "../plugins/auth";

export const invoiceRoutes = new Elysia({
  prefix: "/api/invoices",
  detail: {
    tags: ["Invoices"],
    security: COOKIE_AUTH_SECURITY,
  },
})
  .use(betterAuthPlugin)
  .get(
    "/",
    async ({ user, query, status }) => {
      const result = await runAction(() =>
        listInvoicesForUser(user.id, {
          page: query.page,
          limit: query.limit,
          status: query.status,
        }),
      );
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      query: t.Object({
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
        status: t.Optional(
          t.Union([
            t.Literal("draft"),
            t.Literal("issued"),
            t.Literal("paid"),
            t.Literal("void"),
            t.Literal("overdue"),
          ]),
        ),
      }),
      detail: { summary: "List invoices for the current user" },
    },
  )
  .get(
    "/:invoiceId/html",
    async ({ user, params, status }) => {
      const result = await runAction(() => getInvoiceHtmlForUser(params.invoiceId, user.id));
      if (!result.ok) return status(result.status, result.body);
      return new Response(result.data.html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="${result.data.invoiceNumber}.html"`,
        },
      });
    },
    {
      auth: true,
      params: t.Object({ invoiceId: t.String() }),
      detail: { summary: "Get printable HTML invoice" },
    },
  )
  .get(
    "/:invoiceId",
    async ({ user, params, status }) => {
      const result = await runAction(() => getInvoiceForUser(params.invoiceId, user.id));
      if (!result.ok) return status(result.status, result.body);
      return result.data;
    },
    {
      auth: true,
      params: t.Object({ invoiceId: t.String() }),
      detail: { summary: "Get invoice details" },
    },
  );
