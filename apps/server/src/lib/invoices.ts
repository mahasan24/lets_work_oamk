import { sendEmail } from "@lets_work/auth";
import { db } from "@lets_work/db";
import { user } from "@lets_work/db/schema/auth";
import { contract } from "@lets_work/db/schema/contracts";
import { invoice } from "@lets_work/db/schema/invoices";
import { milestone } from "@lets_work/db/schema/milestones";
import { payment } from "@lets_work/db/schema/payments";
import { env } from "@lets_work/env/server";
import { and, count, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { ForbiddenError, NotFoundError } from "./errors";
import { buildPaginationMeta, resolvePagination } from "./http";
import { createNotification } from "./notifications";

const PLATFORM_FEE_RATE = 0.05;

export class InvoiceNotFoundError extends NotFoundError {
  constructor() {
    super("Invoice not found", "INVOICE_NOT_FOUND");
  }
}

async function notifyQuietly(input: Parameters<typeof createNotification>[0]) {
  try {
    await createNotification(input);
  } catch (error) {
    console.error("Failed to create notification", error);
  }
}

function serializeInvoice(row: typeof invoice.$inferSelect) {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    contractId: row.contractId,
    milestoneId: row.milestoneId,
    paymentId: row.paymentId,
    billedToUserId: row.billedToUserId,
    billedFromUserId: row.billedFromUserId,
    status: row.status,
    subtotal: row.subtotal,
    platformFee: row.platformFee,
    total: row.total,
    currency: row.currency,
    dueDate: row.dueDate,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type InvoiceView = ReturnType<typeof serializeInvoice>;

function nextInvoiceNumber() {
  const now = new Date();
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
  const suffix = crypto.randomUUID().slice(0, 6).toUpperCase();
  return `LW-${stamp}-${suffix}`;
}

function money(amount: string | number, currency: string) {
  const value = typeof amount === "number" ? amount.toFixed(2) : amount;
  return currency === "USD" ? `$${value}` : `${currency} ${value}`;
}

export async function createInvoiceForPayment(paymentId: string) {
  const [existing] = await db
    .select()
    .from(invoice)
    .where(eq(invoice.paymentId, paymentId))
    .limit(1);
  if (existing) {
    return serializeInvoice(existing);
  }

  const [pay] = await db.select().from(payment).where(eq(payment.id, paymentId)).limit(1);
  if (!pay || !pay.payeeUserId) {
    return null;
  }

  const subtotal = Number(pay.amount);
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return null;
  }

  const platformFee = Math.round(subtotal * PLATFORM_FEE_RATE * 100) / 100;
  const total = Math.round((subtotal + platformFee) * 100) / 100;

  const [created] = await db
    .insert(invoice)
    .values({
      id: crypto.randomUUID(),
      invoiceNumber: nextInvoiceNumber(),
      contractId: pay.contractId,
      milestoneId: pay.milestoneId,
      paymentId: pay.id,
      billedToUserId: pay.payerUserId,
      billedFromUserId: pay.payeeUserId,
      status: "paid",
      subtotal: subtotal.toFixed(2),
      platformFee: platformFee.toFixed(2),
      total: total.toFixed(2),
      currency: pay.currency,
      paidAt: pay.paidAt ?? new Date(),
      dueDate: pay.paidAt ?? new Date(),
    })
    .onConflictDoNothing()
    .returning();

  // Unique on invoice_number only; paymentId isn't unique in schema — handle race via re-select
  if (!created) {
    const [again] = await db
      .select()
      .from(invoice)
      .where(eq(invoice.paymentId, paymentId))
      .limit(1);
    return again ? serializeInvoice(again) : null;
  }

  void emailInvoiceToParties(created.id).catch((error) => {
    console.error("[invoice] failed to email parties", created.id, error);
  });

  if (pay.payerUserId && pay.contractId) {
    await notifyQuietly({
      userId: pay.payerUserId,
      type: "payment",
      title: "Invoice available",
      body: `Invoice ${created.invoiceNumber} is ready for your funded milestone.`,
      actionUrl: `/dashboard/hirer/invoices`,
    });
  }
  if (pay.payeeUserId && pay.contractId) {
    await notifyQuietly({
      userId: pay.payeeUserId,
      type: "payment",
      title: "Invoice issued",
      body: `Invoice ${created.invoiceNumber} was issued for a funded milestone.`,
      actionUrl: `/dashboard/freelancer/invoices`,
    });
  }

  return serializeInvoice(created);
}

export async function listInvoicesForUser(
  userId: string,
  input?: { page?: number; limit?: number; status?: (typeof invoice.$inferSelect)["status"] },
) {
  const { page, limit, offset } = resolvePagination(input);
  const billedTo = alias(user, "invoice_billed_to");
  const billedFrom = alias(user, "invoice_billed_from");

  const involvement = or(eq(invoice.billedToUserId, userId), eq(invoice.billedFromUserId, userId))!;
  const conditions = [involvement];
  if (input?.status) {
    conditions.push(eq(invoice.status, input.status));
  }
  const whereClause = and(...conditions);

  const [[totalRow], rows] = await Promise.all([
    db.select({ total: count() }).from(invoice).where(whereClause),
    db
      .select({
        invoice,
        contractTitle: contract.title,
        milestoneTitle: milestone.title,
        billedToName: billedTo.name,
        billedFromName: billedFrom.name,
      })
      .from(invoice)
      .leftJoin(contract, eq(contract.id, invoice.contractId))
      .leftJoin(milestone, eq(milestone.id, invoice.milestoneId))
      .innerJoin(billedTo, eq(billedTo.id, invoice.billedToUserId))
      .leftJoin(billedFrom, eq(billedFrom.id, invoice.billedFromUserId))
      .where(whereClause)
      .orderBy(desc(invoice.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    items: rows.map((row) => ({
      ...serializeInvoice(row.invoice),
      contractTitle: row.contractTitle,
      milestoneTitle: row.milestoneTitle,
      billedToName: row.billedToName,
      billedFromName: row.billedFromName,
      direction:
        row.invoice.billedToUserId === userId ? ("payable" as const) : ("receivable" as const),
    })),
    pagination: buildPaginationMeta(page, limit, totalRow?.total ?? 0),
  };
}

export async function getInvoiceForUser(invoiceId: string, userId: string) {
  const detail = await getInvoiceDetail(invoiceId);
  if (detail.invoice.billedToUserId !== userId && detail.invoice.billedFromUserId !== userId) {
    throw new ForbiddenError("You do not have access to this invoice");
  }
  return detail;
}

async function getInvoiceDetail(invoiceId: string) {
  const [row] = await db
    .select({
      invoice,
      contractTitle: contract.title,
      milestoneTitle: milestone.title,
      billedToName: user.name,
      billedToEmail: user.email,
    })
    .from(invoice)
    .leftJoin(contract, eq(contract.id, invoice.contractId))
    .leftJoin(milestone, eq(milestone.id, invoice.milestoneId))
    .innerJoin(user, eq(user.id, invoice.billedToUserId))
    .where(eq(invoice.id, invoiceId))
    .limit(1);

  if (!row) {
    throw new InvoiceNotFoundError();
  }

  let billedFromName: string | null = null;
  let billedFromEmail: string | null = null;
  if (row.invoice.billedFromUserId) {
    const [from] = await db
      .select({ name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, row.invoice.billedFromUserId))
      .limit(1);
    billedFromName = from?.name ?? null;
    billedFromEmail = from?.email ?? null;
  }

  return {
    invoice: serializeInvoice(row.invoice),
    contractTitle: row.contractTitle,
    milestoneTitle: row.milestoneTitle,
    billedToName: row.billedToName,
    billedToEmail: row.billedToEmail,
    billedFromName,
    billedFromEmail,
  };
}

export function renderInvoiceHtml(detail: Awaited<ReturnType<typeof getInvoiceDetail>>) {
  const inv = detail.invoice;
  const issued = inv.createdAt ? new Date(inv.createdAt).toISOString().slice(0, 10) : "";
  const paid = inv.paidAt ? new Date(inv.paidAt).toISOString().slice(0, 10) : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${inv.invoiceNumber}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; color: #111; margin: 40px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    .muted { color: #666; font-size: 14px; }
    .row { display: flex; justify-content: space-between; gap: 24px; margin: 24px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #ddd; font-size: 14px; }
    th { color: #555; font-weight: 600; }
    .totals { margin-top: 16px; width: 280px; margin-left: auto; }
    .totals div { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
    .totals .grand { font-weight: 700; font-size: 16px; border-top: 1px solid #111; margin-top: 8px; padding-top: 10px; }
    .badge { display: inline-block; padding: 2px 8px; border: 1px solid #111; font-size: 12px; text-transform: uppercase; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <div class="row">
    <div>
      <h1>Lets Work</h1>
      <p class="muted">Platform invoice for milestone escrow</p>
    </div>
    <div style="text-align:right">
      <div class="badge">${inv.status}</div>
      <p><strong>${inv.invoiceNumber}</strong></p>
      <p class="muted">Issued ${issued}${paid ? ` · Paid ${paid}` : ""}</p>
    </div>
  </div>
  <div class="row">
    <div>
      <p class="muted">Billed to</p>
      <p><strong>${detail.billedToName}</strong></p>
      <p class="muted">${detail.billedToEmail}</p>
    </div>
    <div>
      <p class="muted">From</p>
      <p><strong>${detail.billedFromName ?? "Freelancer"}</strong></p>
      <p class="muted">${detail.billedFromEmail ?? ""}</p>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Contract</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${detail.milestoneTitle ?? "Milestone funding"}</td>
        <td>${detail.contractTitle ?? "—"}</td>
        <td>${money(inv.subtotal, inv.currency)}</td>
      </tr>
    </tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal</span><span>${money(inv.subtotal, inv.currency)}</span></div>
    <div><span>Platform fee</span><span>${money(inv.platformFee, inv.currency)}</span></div>
    <div class="grand"><span>Total</span><span>${money(inv.total, inv.currency)}</span></div>
  </div>
  <p class="muted" style="margin-top:32px">This invoice reflects escrow funding collected by Lets Work on behalf of the freelancer.</p>
</body>
</html>`;
}

export async function getInvoiceHtmlForUser(invoiceId: string, userId: string) {
  const detail = await getInvoiceForUser(invoiceId, userId);
  return {
    invoiceId: detail.invoice.id,
    invoiceNumber: detail.invoice.invoiceNumber,
    html: renderInvoiceHtml(detail),
  };
}

async function emailInvoiceToParties(invoiceId: string) {
  const detail = await getInvoiceDetail(invoiceId);
  const html = renderInvoiceHtml(detail);
  const appUrl = env.CORS_ORIGIN.replace(/\/$/, "");
  const subject = `Invoice ${detail.invoice.invoiceNumber} — Lets Work`;

  const recipients = [
    { email: detail.billedToEmail, name: detail.billedToName },
    detail.billedFromEmail
      ? { email: detail.billedFromEmail, name: detail.billedFromName ?? "Freelancer" }
      : null,
  ].filter(Boolean) as Array<{ email: string; name: string }>;

  for (const recipient of recipients) {
    await sendEmail({
      to: recipient.email,
      subject,
      text: `Hi ${recipient.name},\n\nInvoice ${detail.invoice.invoiceNumber} is available for ${money(detail.invoice.total, detail.invoice.currency)}.\nView invoices in your dashboard: ${appUrl}/dashboard\n\n— Lets Work`,
      html: `
        <p>Hi ${recipient.name},</p>
        <p>Invoice <strong>${detail.invoice.invoiceNumber}</strong> (${money(detail.invoice.total, detail.invoice.currency)}) is available.</p>
        ${html}
        <p><a href="${appUrl}/dashboard">Open dashboard</a></p>
        <p>— Lets Work</p>
      `,
    });
  }
}
