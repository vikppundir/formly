/**
 * Spouse Routes - Individual account spouse invitation & linking
 * When spouse is in Australia: invitation flow (like partner invitations)
 * When overseas: details stored directly on IndividualProfile
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { AuthService } from "../services/auth.service.js";
import { createAuthMiddleware, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { z } from "zod";
import crypto from "crypto";
import { logger } from "../utils/logger.js";

const inviteSpouseSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
});

const spouseActionSchema = z.object({
  accountId: z.string().min(1),
});

export async function registerSpouseRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const authMiddleware = createAuthMiddleware(authService);

  /**
   * POST /spouse/invite
   * Send spouse invitation (when spouse is in Australia)
   * Creates SpouseInvitation and updates IndividualProfile
   */
  app.post(
    "/spouse/invite",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = inviteSpouseSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { accountId, name, email } = parsed.data;

      // Verify account ownership
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        include: { individualProfile: true },
      });

      if (!account || account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }
      if (account.accountType !== "INDIVIDUAL") {
        return reply.status(400).send({ error: "Spouse invitation only for Individual accounts" });
      }

      // Check if user with this email exists
      const existingUser = await prisma.user.findUnique({ where: { email } });

      // Create secure invitation token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Delete any existing invitations for this account
      await prisma.spouseInvitation.deleteMany({ where: { accountId } });

      // Create new invitation
      await prisma.spouseInvitation.create({
        data: {
          accountId,
          email,
          name,
          token: tokenHash,
          expiresAt,
        },
      });

      // Update the individual profile with spouse details
      if (account.individualProfile) {
        await prisma.individualProfile.update({
          where: { accountId },
          data: {
            spouseName: name,
            spouseEmail: email,
            spouseUserId: existingUser?.id || null,
            spouseStatus: "PENDING",
          },
        });
      }

      logger.info("Spouse invitation sent", {
        accountId,
        email,
        existingUser: !!existingUser,
      });

      // TODO: Send email notification to spouse
      // If existingUser: "You have a spouse linking request"
      // If !existingUser: "Register to link your account"

      return reply.status(201).send({
        ok: true,
        existingUser: !!existingUser,
        message: existingUser
          ? `Invitation sent to ${email}. They will see the request in their account.`
          : `Invitation sent to ${email}. They will be asked to create an account first.`,
      });
    }
  );

  /**
   * POST /spouse/accept
   * Accept a spouse invitation
   */
  app.post(
    "/spouse/accept",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = spouseActionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { accountId } = parsed.data;

      // Find the invitation for the current user's email
      const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      const invitation = await prisma.spouseInvitation.findFirst({
        where: { accountId, email: user.email },
      });

      if (!invitation) {
        return reply.status(404).send({ error: "Invitation not found" });
      }

      if (invitation.expiresAt < new Date()) {
        return reply.status(400).send({ error: "Invitation has expired" });
      }

      // Accept - update invitation and profile
      await prisma.$transaction([
        prisma.spouseInvitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date() },
        }),
        prisma.individualProfile.update({
          where: { accountId },
          data: {
            spouseUserId: user.id,
            spouseStatus: "APPROVED",
          },
        }),
      ]);

      logger.info("Spouse invitation accepted", { accountId, userId: user.id });

      return reply.send({ ok: true, message: "Spouse invitation accepted" });
    }
  );

  /**
   * POST /spouse/reject
   * Reject a spouse invitation
   */
  app.post(
    "/spouse/reject",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = spouseActionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { accountId } = parsed.data;

      const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
      if (!user) {
        return reply.status(404).send({ error: "User not found" });
      }

      const invitation = await prisma.spouseInvitation.findFirst({
        where: { accountId, email: user.email },
      });

      if (!invitation) {
        return reply.status(404).send({ error: "Invitation not found" });
      }

      await prisma.individualProfile.update({
        where: { accountId },
        data: { spouseStatus: "REJECTED" },
      });

      logger.info("Spouse invitation rejected", { accountId, userId: user.id });

      return reply.send({ ok: true, message: "Spouse invitation rejected" });
    }
  );

  /**
   * DELETE /spouse/:accountId
   * Remove spouse from individual profile
   */
  app.delete(
    "/spouse/:accountId",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { accountId } = request.params as { accountId: string };

      const account = await prisma.account.findUnique({ where: { id: accountId } });
      if (!account || account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      // Clear spouse data
      await prisma.individualProfile.update({
        where: { accountId },
        data: {
          spouseName: null,
          spouseEmail: null,
          spouseDob: null,
          spouseUserId: null,
          spouseStatus: null,
        },
      });

      // Delete invitation
      await prisma.spouseInvitation.deleteMany({ where: { accountId } });

      return reply.send({ ok: true });
    }
  );

  /**
   * GET /spouse/pending
   * Get pending spouse requests for the current user
   */
  app.get(
    "/spouse/pending",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
      if (!user) {
        return reply.send({ requests: [] });
      }

      // Find individual profiles where this user's email is the spouse email
      const profiles = await prisma.individualProfile.findMany({
        where: {
          spouseEmail: user.email,
          spouseStatus: "PENDING",
        },
        include: {
          account: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      const requests = profiles.map((p) => ({
        accountId: p.accountId,
        accountName: p.account.name,
        ownerName: p.account.user.name,
        ownerEmail: p.account.user.email,
        spouseName: p.spouseName,
      }));

      return reply.send({ requests });
    }
  );
}
