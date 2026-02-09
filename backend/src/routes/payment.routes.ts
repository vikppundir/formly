/**
 * Payment Routes - Stripe integration for service purchases
 * Handles checkout sessions, webhooks, and payment status
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient, PaymentStatus } from "@prisma/client";
import type { AuthService } from "../services/auth.service.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createServiceRepository } from "../repositories/service.repository.js";
import { createAccountRepository } from "../repositories/account.repository.js";
import { createSettingsRepository } from "../repositories/settings.repository.js";
import { logger } from "../utils/logger.js";
import { z } from "zod";
import Stripe from "stripe";

const createCheckoutSchema = z.object({
  accountId: z.string(),
  serviceId: z.string(),
  financialYear: z.string().optional(),
  notes: z.string().optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

const verifyPaymentSchema = z.object({
  sessionId: z.string().min(1),
  purchaseId: z.string().min(1),
});

export async function registerPaymentRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const serviceRepo = createServiceRepository(prisma);
  const accountRepo = createAccountRepository(prisma);
  const settingsRepo = createSettingsRepository(prisma);
  const authMiddleware = createAuthMiddleware(authService);

  // Helper to get Stripe instance
  async function getStripe(): Promise<Stripe | null> {
    const secretKey = await settingsRepo.getValue("stripe_secret_key");
    if (!secretKey) return null;
    // @ts-ignore - Stripe API version
    return new Stripe(secretKey);
  }

  // Helper to get payment settings
  async function getPaymentSettings() {
    const [currency, taxRate, paymentRequired, taxInclusive] = await Promise.all([
      settingsRepo.getValue("payment_currency"),
      settingsRepo.getValue("payment_tax_rate"),
      settingsRepo.getValue("payment_required"),
      settingsRepo.getValue("payment_tax_inclusive"),
    ]);
    return {
      currency: (currency || "AUD").toLowerCase(),
      taxRate: parseFloat(taxRate || "10"),
      paymentRequired: paymentRequired === "true",
      taxInclusive: taxInclusive === "true",
    };
  }

  // ==========================================================================
  // Create Checkout Session
  // ==========================================================================
  app.post(
    "/payments/create-checkout",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = createCheckoutSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { accountId, serviceId, financialYear, notes, successUrl, cancelUrl } = parsed.data;

      // Check if Stripe is configured
      const stripe = await getStripe();
      if (!stripe) {
        return reply.status(400).send({ error: "Payment gateway not configured" });
      }

      // Verify account ownership
      const account = await accountRepo.findById(accountId);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }
      if (account.status !== "ACTIVE") {
        return reply.status(400).send({ error: "Account must be active to purchase services" });
      }

      // Get service
      const service = await serviceRepo.findById(serviceId);
      if (!service) {
        return reply.status(404).send({ error: "Service not found" });
      }
      if (!service.isActive) {
        return reply.status(400).send({ error: "Service is not available" });
      }
      if (!service.allowedTypes.includes(account.accountType)) {
        return reply.status(400).send({ error: "Service not available for this account type" });
      }

      // Check if already purchased
      const existing = await serviceRepo.hasService(accountId, serviceId, financialYear);
      if (existing) {
        return reply.status(400).send({ error: "Service already purchased for this financial year" });
      }

      // Get price for account type
      const basePrice = service.pricing[account.accountType];
      if (basePrice === undefined) {
        return reply.status(400).send({ error: "Price not set for this account type" });
      }

      // Calculate tax
      const settings = await getPaymentSettings();
      let priceBeforeTax = basePrice;
      let taxAmount = 0;

      if (settings.taxInclusive) {
        // Price already includes tax, extract tax amount
        priceBeforeTax = basePrice / (1 + settings.taxRate / 100);
        taxAmount = basePrice - priceBeforeTax;
      } else {
        // Add tax to the price
        taxAmount = basePrice * (settings.taxRate / 100);
      }

      const totalAmount = priceBeforeTax + taxAmount;
      const amountInCents = Math.round(totalAmount * 100);

      // Create a pending purchase record
      const purchase = await serviceRepo.purchase({
        accountId,
        serviceId,
        price: basePrice,
        financialYear,
        notes,
      });

      // Update with payment info
      await prisma.accountService.update({
        where: { id: purchase.id },
        data: {
          paymentStatus: "PENDING",
          paymentMethod: "stripe",
          paymentAmount: totalAmount,
          taxAmount,
          currency: settings.currency.toUpperCase(),
          status: "PENDING",
        },
      });

      // Get user email for Stripe
      const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user?.email,
        line_items: [
          {
            price_data: {
              currency: settings.currency,
              product_data: {
                name: service.name,
                description: service.description || `Service for ${account.name}`,
                metadata: {
                  serviceId: service.id,
                  serviceCode: service.code,
                  accountType: account.accountType,
                },
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          purchaseId: purchase.id,
          accountId,
          serviceId,
          userId: req.user!.sub,
          financialYear: financialYear || "",
        },
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&purchase_id=${purchase.id}`,
        cancel_url: `${cancelUrl}?purchase_id=${purchase.id}`,
      });

      // Store session ID
      await prisma.accountService.update({
        where: { id: purchase.id },
        data: { stripeSessionId: session.id },
      });

      return reply.send({
        checkoutUrl: session.url,
        sessionId: session.id,
        purchaseId: purchase.id,
      });
    }
  );

  // ==========================================================================
  // Verify Payment (called after successful checkout)
  // ==========================================================================
  app.post(
    "/payments/verify",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = verifyPaymentSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { sessionId, purchaseId } = parsed.data;

      const stripe = await getStripe();
      if (!stripe) {
        return reply.status(400).send({ error: "Payment gateway not configured" });
      }

      // Get purchase
      const purchase = await prisma.accountService.findUnique({
        where: { id: purchaseId },
        include: { account: true },
      });

      if (!purchase) {
        return reply.status(404).send({ error: "Purchase not found" });
      }
      if (purchase.account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }
      if (purchase.stripeSessionId !== sessionId) {
        return reply.status(400).send({ error: "Session ID mismatch" });
      }

      // Retrieve session from Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });

      if (session.payment_status === "paid") {
        const paymentIntent = session.payment_intent as Stripe.PaymentIntent | undefined;

        await prisma.accountService.update({
          where: { id: purchaseId },
          data: {
            paymentStatus: "PAID",
            paidAt: new Date(),
            transactionId: paymentIntent?.id || session.id,
            paymentReceipt: (paymentIntent as any)?.latest_charge?.receipt_url || null,
            status: "IN_PROGRESS", // Move to in progress after payment
          },
        });

        return reply.send({ success: true, status: "paid" });
      }

      return reply.send({ success: false, status: session.payment_status });
    }
  );

  // ==========================================================================
  // Get Payment Status
  // ==========================================================================
  app.get(
    "/payments/status/:purchaseId",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { purchaseId } = request.params as { purchaseId: string };

      const purchase = await prisma.accountService.findUnique({
        where: { id: purchaseId },
        include: {
          account: true,
          service: true,
        },
      });

      if (!purchase) {
        return reply.status(404).send({ error: "Purchase not found" });
      }
      if (purchase.account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      return reply.send({
        purchase: {
          id: purchase.id,
          status: purchase.status,
          paymentStatus: purchase.paymentStatus,
          paymentAmount: purchase.paymentAmount,
          taxAmount: purchase.taxAmount,
          currency: purchase.currency,
          paidAt: purchase.paidAt,
          transactionId: purchase.transactionId,
          paymentReceipt: purchase.paymentReceipt,
          service: {
            id: purchase.service.id,
            name: purchase.service.name,
            code: purchase.service.code,
          },
        },
      });
    }
  );

  // ==========================================================================
  // Cancel Unpaid Purchase
  // ==========================================================================
  app.delete(
    "/payments/cancel/:purchaseId",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { purchaseId } = request.params as { purchaseId: string };

      const purchase = await prisma.accountService.findUnique({
        where: { id: purchaseId },
        include: { account: true },
      });

      if (!purchase) {
        return reply.status(404).send({ error: "Purchase not found" });
      }
      if (purchase.account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }
      if (purchase.paymentStatus === "PAID") {
        return reply.status(400).send({ error: "Cannot cancel paid purchase" });
      }

      // Delete the unpaid purchase
      await prisma.accountService.delete({ where: { id: purchaseId } });

      return reply.send({ success: true });
    }
  );

  // ==========================================================================
  // Stripe Webhook
  // ==========================================================================
  app.post(
    "/webhooks/stripe",
    {
      config: {
        rawBody: true,
      },
    },
    async (request, reply) => {
      const stripe = await getStripe();
      if (!stripe) {
        return reply.status(400).send({ error: "Stripe not configured" });
      }

      const webhookSecret = await settingsRepo.getValue("stripe_webhook_secret");
      if (!webhookSecret) {
        logger.error("Stripe webhook secret not configured");
        return reply.status(400).send({ error: "Webhook secret not configured" });
      }

      const sig = request.headers["stripe-signature"] as string;
      if (!sig) {
        return reply.status(400).send({ error: "Missing stripe-signature header" });
      }

      let event: Stripe.Event;
      try {
        // Use raw body for webhook verification
        const rawBody = (request as any).rawBody || request.body;
        event = stripe.webhooks.constructEvent(
          typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody),
          sig,
          webhookSecret
        );
      } catch (err: any) {
        logger.error("Webhook signature verification failed", { error: err.message });
        return reply.status(400).send({ error: `Webhook Error: ${err.message}` });
      }

      // Handle the event
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const purchaseId = session.metadata?.purchaseId;

          if (purchaseId && session.payment_status === "paid") {
            await prisma.accountService.update({
              where: { id: purchaseId },
              data: {
                paymentStatus: "PAID",
                paidAt: new Date(),
                transactionId: session.payment_intent as string || session.id,
                status: "IN_PROGRESS",
              },
            });
            logger.info("Payment completed", { purchaseId });
          }
          break;
        }

        case "checkout.session.expired": {
          const session = event.data.object as Stripe.Checkout.Session;
          const purchaseId = session.metadata?.purchaseId;

          if (purchaseId) {
            // Delete the pending purchase
            await prisma.accountService.delete({ where: { id: purchaseId } }).catch(() => {});
            logger.info("Checkout expired, deleted purchase", { purchaseId });
          }
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          // Find purchase by transactionId
          const purchase = await prisma.accountService.findFirst({
            where: { transactionId: paymentIntent.id },
          });

          if (purchase) {
            await prisma.accountService.update({
              where: { id: purchase.id },
              data: { paymentStatus: "FAILED" },
            });
            logger.info("Payment failed", { purchaseId: purchase.id });
          }
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object as Stripe.Charge;
          const paymentIntentId = charge.payment_intent as string;

          const purchase = await prisma.accountService.findFirst({
            where: { transactionId: paymentIntentId },
          });

          if (purchase) {
            const status: PaymentStatus = charge.amount_refunded === charge.amount 
              ? "REFUNDED" 
              : "PARTIAL_REFUND";
            
            await prisma.accountService.update({
              where: { id: purchase.id },
              data: { paymentStatus: status },
            });
            logger.info("Refund processed", { purchaseId: purchase.id, status });
          }
          break;
        }
      }

      return reply.send({ received: true });
    }
  );

  // ==========================================================================
  // Admin: Get Payment Stats
  // ==========================================================================
  app.get(
    "/admin/payments/stats",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (_request, reply) => {
      const stats = await prisma.accountService.groupBy({
        by: ["paymentStatus"],
        _count: true,
        _sum: {
          paymentAmount: true,
        },
      });

      const totalRevenue = await prisma.accountService.aggregate({
        where: { paymentStatus: "PAID" },
        _sum: {
          paymentAmount: true,
        },
      });

      const recentPayments = await prisma.accountService.findMany({
        where: { paymentStatus: "PAID" },
        orderBy: { paidAt: "desc" },
        take: 10,
        include: {
          account: { include: { user: { select: { name: true, email: true } } } },
          service: { select: { name: true, code: true } },
        },
      });

      return reply.send({
        stats,
        totalRevenue: totalRevenue._sum.paymentAmount || 0,
        recentPayments,
      });
    }
  );

  // ==========================================================================
  // Check if payment is required
  // ==========================================================================
  app.get("/payments/settings", async (_, reply) => {
    const settings = await getPaymentSettings();
    const publishableKey = await settingsRepo.getValue("stripe_publishable_key");
    const gateway = await settingsRepo.getValue("payment_gateway");

    return reply.send({
      ...settings,
      gateway: gateway || "stripe",
      enabled: gateway !== "none" && !!publishableKey,
      publishableKey: publishableKey || null,
    });
  });
}
