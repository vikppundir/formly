/**
 * Partners Routes - Company, Partnership & Trust partner invitations and approvals
 * Handles multi-partner workflow for company, partnership, and trust accounts
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient, PartnerStatus } from "@prisma/client";
import type { AuthService } from "../services/auth.service.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import { createPartnerRepository } from "../repositories/partner.repository.js";
import { createAccountRepository } from "../repositories/account.repository.js";
import { z } from "zod";

// Validation schemas
const addPartnerSchema = z.object({
  accountId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: z.string().optional(),
  isDirector: z.boolean().optional(),
  isShareholder: z.boolean().optional(),
  shareCount: z.number().int().min(0).optional(),
  ownershipPercent: z.number().min(0).max(100).optional(),
});

const addPartnershipPartnerSchema = z.object({
  accountId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: z.string().optional(),
  ownershipPercent: z.number().min(0).max(100).optional(),
});

const addTrustPartnerSchema = z.object({
  accountId: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: z.string().optional(),
  beneficiaryPercent: z.number().min(0).max(100).optional(),
});

const respondInvitationSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function registerPartnersRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const partnerRepo = createPartnerRepository(prisma);
  const accountRepo = createAccountRepository(prisma);
  const authMiddleware = createAuthMiddleware(authService);

  // =========================================================================
  // Partner Management (Account Owner)
  // =========================================================================

  // Add partner to company account
  app.post(
    "/partners",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = addPartnerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { accountId, email, name, role, isDirector, isShareholder, shareCount, ownershipPercent } = parsed.data;

      // Check account ownership and type
      const account = await accountRepo.findById(accountId);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }
      if (account.accountType !== "COMPANY") {
        return reply.status(400).send({ error: "Partners can only be added to company accounts" });
      }

      // Check if partner already exists
      const existingPartners = await partnerRepo.getPartners(accountId);
      if (existingPartners.some((p) => p.email === email)) {
        return reply.status(400).send({ error: "Partner already added" });
      }

      // Check if email is a registered user
      const existingUser = await partnerRepo.checkEmailExists(email);

      // Build display role from flags
      const displayRole = isDirector && isShareholder
        ? "Director & Shareholder"
        : isDirector ? "Director" : isShareholder ? "Shareholder" : role;

      // Add partner
      const partner = await partnerRepo.addPartner({
        accountId,
        email,
        name,
        role: displayRole,
        isDirector: isDirector || false,
        isShareholder: isShareholder || false,
        shareCount,
        ownershipPercent,
      });

      // Create invitation token for email
      const invitation = await partnerRepo.createInvitation({
        accountId,
        email,
        name,
      });

      // TODO: Send invitation email here using email service
      // If user exists, send approval request
      // If user doesn't exist, send registration invitation

      return reply.status(201).send({
        partner,
        isExistingUser: !!existingUser,
        invitationSent: true,
        // In production, don't expose the token - it's sent via email
        _debug_token: process.env.NODE_ENV !== "production" ? invitation.rawToken : undefined,
      });
    }
  );

  // Get partners for an account
  app.get(
    "/partners/account/:accountId",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { accountId } = request.params as { accountId: string };

      const account = await accountRepo.findById(accountId);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const partners = await partnerRepo.getPartners(accountId);
      return reply.send({ partners });
    }
  );

  // Remove partner
  app.delete(
    "/partners/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const partner = await partnerRepo.findById(id);
      if (!partner) {
        return reply.status(404).send({ error: "Partner not found" });
      }

      // Check account ownership
      const account = await accountRepo.findById(partner.accountId);
      if (!account || account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      await partnerRepo.remove(id);
      return reply.send({ ok: true });
    }
  );

  // Update partner details (edit)
  app.patch(
    "/partners/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const updateSchema = z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        isDirector: z.boolean().optional(),
        isShareholder: z.boolean().optional(),
        shareCount: z.number().int().min(0).optional().nullable(),
      });

      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const partner = await partnerRepo.findById(id);
      if (!partner) {
        return reply.status(404).send({ error: "Partner not found" });
      }

      // Check account ownership
      const account = await accountRepo.findById(partner.accountId);
      if (!account || account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const { email, isDirector, isShareholder, ...rest } = parsed.data;

      // If email changed, check for duplicate on same account
      let emailChanged = false;
      if (email && email !== partner.email) {
        const existingPartners = await partnerRepo.getPartners(partner.accountId);
        if (existingPartners.some((p) => p.email === email && p.id !== id)) {
          return reply.status(400).send({ error: "A partner with this email already exists on this account" });
        }
        emailChanged = true;
      }

      // Build display role
      const finalIsDirector = isDirector ?? partner.isDirector;
      const finalIsShareholder = isShareholder ?? partner.isShareholder;
      const displayRole = finalIsDirector && finalIsShareholder
        ? "Director & Shareholder"
        : finalIsDirector ? "Director" : finalIsShareholder ? "Shareholder" : partner.role;

      const updated = await partnerRepo.updatePartner(id, {
        ...rest,
        email,
        role: displayRole,
        isDirector: finalIsDirector,
        isShareholder: finalIsShareholder,
      });

      // If email changed, create a new invitation for the new email
      let invitationSent = false;
      if (emailChanged && email) {
        try {
          await partnerRepo.createInvitation({
            accountId: partner.accountId,
            email,
            name: rest.name || updated.name || undefined,
          });
          invitationSent = true;
          // TODO: Send invitation email to new address
        } catch { /* invitation creation might fail if one exists */ }
      }

      return reply.send({ partner: updated, emailChanged, invitationSent });
    }
  );

  // Resend invitation
  app.post(
    "/partners/:id/resend",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const partner = await partnerRepo.findById(id);
      if (!partner) {
        return reply.status(404).send({ error: "Partner not found" });
      }

      // Check account ownership
      const account = await accountRepo.findById(partner.accountId);
      if (!account || account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      if (partner.status !== "PENDING") {
        return reply.status(400).send({ error: "Can only resend pending invitations" });
      }

      // Create new invitation token
      const invitation = await partnerRepo.createInvitation({
        accountId: partner.accountId,
        email: partner.email,
        name: partner.name || undefined,
      });

      // TODO: Send invitation email

      return reply.send({
        ok: true,
        _debug_token: process.env.NODE_ENV !== "production" ? invitation.rawToken : undefined,
      });
    }
  );

  // =========================================================================
  // Partner Response (Invited User)
  // =========================================================================

  // Get pending invitations for current user
  app.get(
    "/partners/invitations",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const invitations = await partnerRepo.getPendingForUser(req.user!.sub);
      return reply.send({ invitations });
    }
  );

  // Respond to invitation (approve/reject)
  app.post(
    "/partners/invitations/:id/respond",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const parsed = respondInvitationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const partner = await partnerRepo.findById(id);
      if (!partner) {
        return reply.status(404).send({ error: "Invitation not found" });
      }

      // Get current user's email
      const user = await prisma.user.findUnique({
        where: { id: req.user!.sub },
        select: { email: true },
      });

      // Check if this invitation is for the current user
      if (partner.email !== user?.email && partner.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "This invitation is not for you" });
      }

      if (partner.status !== "PENDING") {
        return reply.status(400).send({ error: "Invitation already responded" });
      }

      const status: PartnerStatus = parsed.data.action === "approve" ? "APPROVED" : "REJECTED";
      await partnerRepo.updateStatus(id, status, req.user!.sub);

      return reply.send({ ok: true, status });
    }
  );

  // Verify invitation token (for registration flow)
  const verifyTokenSchema = z.object({
    email: z.string().email(),
    token: z.string().min(1),
  });

  app.post(
    "/partners/verify-token",
    { config: { rateLimit: { max: 10, timeWindow: 60000 } } },
    async (request, reply) => {
      const parsed = verifyTokenSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { email, token } = parsed.data;

      const invitation = await partnerRepo.verifyInvitation(email, token);
      if (!invitation) {
        return reply.status(400).send({ error: "Invalid or expired invitation" });
      }

      // Get account details
      const account = await accountRepo.findById(invitation.accountId);

      return reply.send({
        valid: true,
        accountName: account?.name,
        accountType: account?.accountType,
        inviterName: account?.user?.name,
      });
    }
  );

  // Accept invitation after registration (authenticated - verify userId matches caller)
  const acceptInvitationSchema = z.object({
    email: z.string().email(),
    token: z.string().min(1),
  });

  app.post(
    "/partners/accept-invitation",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = acceptInvitationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { email, token } = parsed.data;
      const userId = req.user!.sub;

      // Verify the email matches the authenticated user
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user || user.email !== email) {
        return reply.status(403).send({ error: "Email does not match authenticated user" });
      }

      // Verify token
      const invitation = await partnerRepo.verifyInvitation(email, token);
      if (!invitation) {
        return reply.status(400).send({ error: "Invalid or expired invitation" });
      }

      // Link partner to user
      await partnerRepo.linkToUser(email, userId);

      // Mark invitation as accepted
      await partnerRepo.acceptInvitation(invitation.id);

      // Update partner status to approved
      const partners = await partnerRepo.getPendingForEmail(email);
      for (const partner of partners) {
        if (partner.account.id === invitation.accountId) {
          await partnerRepo.updateStatus(partner.id, "APPROVED", userId);
        }
      }

      return reply.send({ ok: true });
    }
  );

  // Check if email exists (for partner invitation UI)
  app.get(
    "/partners/check-email",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { email } = request.query as { email: string };
      if (!email) {
        return reply.status(400).send({ error: "Email required" });
      }

      const user = await partnerRepo.checkEmailExists(email);
      return reply.send({ exists: !!user, name: user?.name });
    }
  );

  // =========================================================================
  // PARTNERSHIP Partners Management
  // =========================================================================

  // Add partner to partnership account
  app.post(
    "/partnership-partners",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = addPartnershipPartnerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { accountId, email, name, role, ownershipPercent } = parsed.data;

      // Check account ownership and type
      const account = await accountRepo.findById(accountId);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }
      if (account.accountType !== "PARTNERSHIP") {
        return reply.status(400).send({ error: "Partners can only be added to partnership accounts" });
      }

      // Check if partner already exists
      const existingPartners = await partnerRepo.getPartnershipPartners(accountId);
      if (existingPartners.some((p) => p.email === email)) {
        return reply.status(400).send({ error: "Partner already added" });
      }

      // Check if email is a registered user
      const existingUser = await partnerRepo.checkEmailExists(email);

      // Add partner
      const partner = await partnerRepo.addPartnershipPartner({
        accountId,
        email,
        name,
        role,
        ownershipPercent,
      });

      // Create invitation token for email
      const invitation = await partnerRepo.createPartnershipInvitation({
        accountId,
        email,
        name,
        role,
        ownershipPercent,
      });

      // TODO: Send invitation email here using email service
      // If user exists, send approval request
      // If user doesn't exist, send registration invitation

      return reply.status(201).send({
        partner,
        isExistingUser: !!existingUser,
        invitationSent: true,
        // In production, don't expose the token - it's sent via email
        _debug_token: process.env.NODE_ENV !== "production" ? invitation.rawToken : undefined,
      });
    }
  );

  // Get partnership partners for an account
  app.get(
    "/partnership-partners/account/:accountId",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { accountId } = request.params as { accountId: string };

      const account = await accountRepo.findById(accountId);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const partners = await partnerRepo.getPartnershipPartners(accountId);
      return reply.send({ partners });
    }
  );

  // Remove partnership partner
  app.delete(
    "/partnership-partners/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const partner = await partnerRepo.findPartnershipPartnerById(id);
      if (!partner) {
        return reply.status(404).send({ error: "Partner not found" });
      }

      // Check account ownership
      const account = await accountRepo.findById(partner.accountId);
      if (!account || account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      await partnerRepo.removePartnershipPartner(id);
      return reply.send({ ok: true });
    }
  );

  // Update partnership partner details (edit)
  app.patch(
    "/partnership-partners/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const updateSchema = z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.string().optional(),
        ownershipPercent: z.number().min(0).max(100).optional().nullable(),
      });

      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const partner = await partnerRepo.findPartnershipPartnerById(id);
      if (!partner) {
        return reply.status(404).send({ error: "Partner not found" });
      }

      const account = await accountRepo.findById(partner.accountId);
      if (!account || account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const { email, ...rest } = parsed.data;

      // If email changed, check for duplicate on same account
      let emailChanged = false;
      if (email && email !== partner.email) {
        const existingPartners = await partnerRepo.getPartnershipPartners(partner.accountId);
        if (existingPartners.some((p) => p.email === email && p.id !== id)) {
          return reply.status(400).send({ error: "A partner with this email already exists on this account" });
        }
        emailChanged = true;
      }

      const updated = await partnerRepo.updatePartnershipPartner(id, { ...rest, email });

      // If email changed, create a new invitation
      let invitationSent = false;
      if (emailChanged && email) {
        try {
          await partnerRepo.createPartnershipInvitation({
            accountId: partner.accountId,
            email,
            name: rest.name || updated.name || undefined,
          });
          invitationSent = true;
        } catch { /* ignore */ }
      }

      return reply.send({ partner: updated, emailChanged, invitationSent });
    }
  );

  // Resend partnership partner invitation
  app.post(
    "/partnership-partners/:id/resend",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const partner = await partnerRepo.findPartnershipPartnerById(id);
      if (!partner) {
        return reply.status(404).send({ error: "Partner not found" });
      }

      // Check account ownership
      const account = await accountRepo.findById(partner.accountId);
      if (!account || account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      if (partner.status !== "PENDING") {
        return reply.status(400).send({ error: "Can only resend pending invitations" });
      }

      // Create new invitation token
      const invitation = await partnerRepo.createPartnershipInvitation({
        accountId: partner.accountId,
        email: partner.email,
        name: partner.name || undefined,
        role: partner.role || undefined,
        ownershipPercent: partner.ownershipPercent ? Number(partner.ownershipPercent) : undefined,
      });

      // TODO: Send invitation email

      return reply.send({
        ok: true,
        _debug_token: process.env.NODE_ENV !== "production" ? invitation.rawToken : undefined,
      });
    }
  );

  // =========================================================================
  // Partnership Partner Response (Invited User)
  // =========================================================================

  // Get pending partnership invitations for current user
  app.get(
    "/partnership-partners/invitations",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const invitations = await partnerRepo.getPendingPartnershipForUser(req.user!.sub);
      return reply.send({ invitations });
    }
  );

  // Respond to partnership invitation (approve/reject)
  app.post(
    "/partnership-partners/invitations/:id/respond",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const parsed = respondInvitationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const partner = await partnerRepo.findPartnershipPartnerById(id);
      if (!partner) {
        return reply.status(404).send({ error: "Invitation not found" });
      }

      // Get current user's email
      const user = await prisma.user.findUnique({
        where: { id: req.user!.sub },
        select: { email: true },
      });

      // Check if this invitation is for the current user
      if (partner.email !== user?.email && partner.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "This invitation is not for you" });
      }

      if (partner.status !== "PENDING") {
        return reply.status(400).send({ error: "Invitation already responded" });
      }

      const status: PartnerStatus = parsed.data.action === "approve" ? "APPROVED" : "REJECTED";
      await partnerRepo.updatePartnershipPartnerStatus(id, status, req.user!.sub);

      return reply.send({ ok: true, status });
    }
  );

  // Verify partnership invitation token (for registration flow)
  app.post(
    "/partnership-partners/verify-token",
    { config: { rateLimit: { max: 10, timeWindow: 60000 } } },
    async (request, reply) => {
      const parsed = verifyTokenSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { email, token } = parsed.data;

      const invitation = await partnerRepo.verifyPartnershipInvitation(email, token);
      if (!invitation) {
        return reply.status(400).send({ error: "Invalid or expired invitation" });
      }

      // Get account details
      const account = await accountRepo.findById(invitation.accountId);

      return reply.send({
        valid: true,
        accountName: account?.name,
        accountType: account?.accountType,
        inviterName: account?.user?.name,
        partnershipName: account?.partnershipProfile?.partnershipName,
      });
    }
  );

  // Accept partnership invitation (authenticated - verify userId matches caller)
  app.post(
    "/partnership-partners/accept-invitation",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = acceptInvitationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { email, token } = parsed.data;
      const userId = req.user!.sub;

      // Verify the email matches the authenticated user
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user || user.email !== email) {
        return reply.status(403).send({ error: "Email does not match authenticated user" });
      }

      // Verify token
      const invitation = await partnerRepo.verifyPartnershipInvitation(email, token);
      if (!invitation) {
        return reply.status(400).send({ error: "Invalid or expired invitation" });
      }

      // Link partner to user
      await partnerRepo.linkPartnershipPartnerToUser(email, userId);

      // Mark invitation as accepted
      await partnerRepo.acceptPartnershipInvitation(invitation.id);

      // Update partner status to approved
      const partners = await partnerRepo.getPendingPartnershipForEmail(email);
      for (const partner of partners) {
        if (partner.account.id === invitation.accountId) {
          await partnerRepo.updatePartnershipPartnerStatus(partner.id, "APPROVED", userId);
        }
      }

      return reply.send({ ok: true });
    }
  );

  // =========================================================================
  // TRUST Partners Management (Trustees & Beneficiaries)
  // =========================================================================

  // Add partner to trust account
  app.post(
    "/trust-partners",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = addTrustPartnerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const { accountId, email, name, role, beneficiaryPercent } = parsed.data;

      // Check account ownership and type
      const account = await accountRepo.findById(accountId);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }
      if (account.accountType !== "TRUST") {
        return reply.status(400).send({ error: "Partners can only be added to trust accounts" });
      }

      // Check if partner already exists
      const existingPartners = await partnerRepo.getTrustPartners(accountId);
      if (existingPartners.some((p) => p.email === email)) {
        return reply.status(400).send({ error: "Partner already added" });
      }

      // Check if email is a registered user
      const existingUser = await partnerRepo.checkEmailExists(email);

      // Add partner
      const partner = await partnerRepo.addTrustPartner({
        accountId,
        email,
        name,
        role,
        beneficiaryPercent,
      });

      // Create invitation token for email
      const invitation = await partnerRepo.createTrustInvitation({
        accountId,
        email,
        name,
        role,
        beneficiaryPercent,
      });

      // TODO: Send invitation email here using email service
      // If user exists, send approval request
      // If user doesn't exist, send registration invitation

      return reply.status(201).send({
        partner,
        isExistingUser: !!existingUser,
        invitationSent: true,
        // In production, don't expose the token - it's sent via email
        _debug_token: process.env.NODE_ENV !== "production" ? invitation.rawToken : undefined,
      });
    }
  );

  // Get trust partners for an account
  app.get(
    "/trust-partners/account/:accountId",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { accountId } = request.params as { accountId: string };

      const account = await accountRepo.findById(accountId);
      if (!account) {
        return reply.status(404).send({ error: "Account not found" });
      }
      if (account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const partners = await partnerRepo.getTrustPartners(accountId);
      return reply.send({ partners });
    }
  );

  // Remove trust partner
  app.delete(
    "/trust-partners/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const partner = await partnerRepo.findTrustPartnerById(id);
      if (!partner) {
        return reply.status(404).send({ error: "Partner not found" });
      }

      // Check account ownership
      const account = await accountRepo.findById(partner.accountId);
      if (!account || account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      await partnerRepo.removeTrustPartner(id);
      return reply.send({ ok: true });
    }
  );

  // Resend trust partner invitation
  app.post(
    "/trust-partners/:id/resend",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const partner = await partnerRepo.findTrustPartnerById(id);
      if (!partner) {
        return reply.status(404).send({ error: "Partner not found" });
      }

      // Check account ownership
      const account = await accountRepo.findById(partner.accountId);
      if (!account || account.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      if (partner.status !== "PENDING") {
        return reply.status(400).send({ error: "Can only resend pending invitations" });
      }

      // Create new invitation token
      const invitation = await partnerRepo.createTrustInvitation({
        accountId: partner.accountId,
        email: partner.email,
        name: partner.name || undefined,
        role: partner.role || undefined,
        beneficiaryPercent: partner.beneficiaryPercent ? Number(partner.beneficiaryPercent) : undefined,
      });

      // TODO: Send invitation email

      return reply.send({
        ok: true,
        _debug_token: process.env.NODE_ENV !== "production" ? invitation.rawToken : undefined,
      });
    }
  );

  // =========================================================================
  // Trust Partner Response (Invited User)
  // =========================================================================

  // Get pending trust invitations for current user
  app.get(
    "/trust-partners/invitations",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const invitations = await partnerRepo.getPendingTrustForUser(req.user!.sub);
      return reply.send({ invitations });
    }
  );

  // Respond to trust invitation (approve/reject)
  app.post(
    "/trust-partners/invitations/:id/respond",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const parsed = respondInvitationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const partner = await partnerRepo.findTrustPartnerById(id);
      if (!partner) {
        return reply.status(404).send({ error: "Invitation not found" });
      }

      // Get current user's email
      const user = await prisma.user.findUnique({
        where: { id: req.user!.sub },
        select: { email: true },
      });

      // Check if this invitation is for the current user
      if (partner.email !== user?.email && partner.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "This invitation is not for you" });
      }

      if (partner.status !== "PENDING") {
        return reply.status(400).send({ error: "Invitation already responded" });
      }

      const status: PartnerStatus = parsed.data.action === "approve" ? "APPROVED" : "REJECTED";
      await partnerRepo.updateTrustPartnerStatus(id, status, req.user!.sub);

      return reply.send({ ok: true, status });
    }
  );

  // Verify trust invitation token (for registration flow)
  app.post(
    "/trust-partners/verify-token",
    { config: { rateLimit: { max: 10, timeWindow: 60000 } } },
    async (request, reply) => {
      const parsed = verifyTokenSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { email, token } = parsed.data;

      const invitation = await partnerRepo.verifyTrustInvitation(email, token);
      if (!invitation) {
        return reply.status(400).send({ error: "Invalid or expired invitation" });
      }

      // Get account details
      const account = await accountRepo.findById(invitation.accountId);

      return reply.send({
        valid: true,
        accountName: account?.name,
        accountType: account?.accountType,
        inviterName: account?.user?.name,
        trustName: account?.trustProfile?.trustName,
      });
    }
  );

  // Accept trust invitation (authenticated - verify userId matches caller)
  app.post(
    "/trust-partners/accept-invitation",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = acceptInvitationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      const { email, token } = parsed.data;
      const userId = req.user!.sub;

      // Verify the email matches the authenticated user
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
      if (!user || user.email !== email) {
        return reply.status(403).send({ error: "Email does not match authenticated user" });
      }

      // Verify token
      const invitation = await partnerRepo.verifyTrustInvitation(email, token);
      if (!invitation) {
        return reply.status(400).send({ error: "Invalid or expired invitation" });
      }

      // Link partner to user
      await partnerRepo.linkTrustPartnerToUser(email, userId);

      // Mark invitation as accepted
      await partnerRepo.acceptTrustInvitation(invitation.id);

      // Update partner status to approved
      const partners = await partnerRepo.getPendingTrustForEmail(email);
      for (const partner of partners) {
        if (partner.account.id === invitation.accountId) {
          await partnerRepo.updateTrustPartnerStatus(partner.id, "APPROVED", userId);
        }
      }

      return reply.send({ ok: true });
    }
  );

  // =========================================================================
  // Combined - Get All Pending Requests (Company + Partnership + Trust)
  // =========================================================================

  // Get all pending partner requests for current user
  app.get(
    "/partners/all-requests",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const requests = await partnerRepo.getAllPendingRequestsForUser(req.user!.sub);
      return reply.send(requests);
    }
  );
}
