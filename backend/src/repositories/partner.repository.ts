/**
 * Partner Repository - Company & Partnership partner invitations and approvals
 * Handles multi-partner workflow for company and partnership accounts
 */

import type { PrismaClient, PartnerStatus } from "@prisma/client";
import crypto from "crypto";
import bcrypt from "bcrypt";

export function createPartnerRepository(prisma: PrismaClient) {
  return {
    // =========================================================================
    // Company Partners
    // =========================================================================

    // Add a partner to a company account
    async addCompanyPartner(data: {
      accountId: string;
      email: string;
      name?: string;
      role?: string;
      isDirector?: boolean;
      isShareholder?: boolean;
      shareCount?: number;
      ownershipPercent?: number;
    }) {
      // Check if email belongs to an existing user
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true, name: true },
      });

      return prisma.companyPartner.create({
        data: {
          accountId: data.accountId,
          email: data.email,
          name: data.name || existingUser?.name,
          role: data.role,
          isDirector: data.isDirector ?? false,
          isShareholder: data.isShareholder ?? false,
          shareCount: data.shareCount,
          ownershipPercent: data.ownershipPercent,
          userId: existingUser?.id,
          status: "PENDING",
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    },

    // Legacy alias for addCompanyPartner
    async addPartner(data: {
      accountId: string;
      email: string;
      name?: string;
      role?: string;
      isDirector?: boolean;
      isShareholder?: boolean;
      shareCount?: number;
      ownershipPercent?: number;
    }) {
      return this.addCompanyPartner(data);
    },

    // Get partners for an account
    async getPartners(accountId: string) {
      return prisma.companyPartner.findMany({
        where: { accountId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    },

    // Update partner status (approve/reject)
    async updateStatus(id: string, status: PartnerStatus, userId?: string) {
      return prisma.companyPartner.update({
        where: { id },
        data: {
          status,
          respondedAt: new Date(),
          ...(userId && { userId }),
        },
      });
    },

    // Get partner by ID
    async findById(id: string) {
      return prisma.companyPartner.findUnique({
        where: { id },
        include: {
          account: { include: { user: { select: { id: true, name: true, email: true } } } },
          user: { select: { id: true, name: true, email: true } },
        },
      });
    },

    // Get pending invitations for a user (by email)
    async getPendingForEmail(email: string) {
      return prisma.companyPartner.findMany({
        where: { email, status: "PENDING" },
        include: {
          account: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              companyProfile: true,
            },
          },
        },
      });
    },

    // Get pending invitations for a user (by userId)
    async getPendingForUser(userId: string) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!user) return [];

      return prisma.companyPartner.findMany({
        where: {
          OR: [{ userId }, { email: user.email }],
          status: "PENDING",
        },
        include: {
          account: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              companyProfile: true,
            },
          },
        },
      });
    },

    // Link partner to user after registration
    async linkToUser(email: string, userId: string) {
      return prisma.companyPartner.updateMany({
        where: { email, userId: null },
        data: { userId },
      });
    },

    // Update partner details (name, role, isDirector, isShareholder, shareCount)
    async updatePartner(id: string, data: {
      name?: string;
      email?: string;
      role?: string;
      isDirector?: boolean;
      isShareholder?: boolean;
      shareCount?: number | null;
    }) {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.isDirector !== undefined) updateData.isDirector = data.isDirector;
      if (data.isShareholder !== undefined) updateData.isShareholder = data.isShareholder;
      if (data.shareCount !== undefined) updateData.shareCount = data.shareCount;

      // If email changed, reset status to PENDING and clear userId link
      if (data.email) {
        const current = await prisma.companyPartner.findUnique({ where: { id }, select: { email: true } });
        if (current && current.email !== data.email) {
          updateData.status = "PENDING";
          updateData.userId = null;
          // Check if the new email belongs to an existing user
          const existingUser = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true, name: true } });
          if (existingUser) {
            updateData.userId = existingUser.id;
            if (!data.name) updateData.name = existingUser.name;
          }
        }
      }

      return prisma.companyPartner.update({
        where: { id },
        data: updateData,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    },

    // Remove partner (hard delete)
    async remove(id: string) {
      return prisma.companyPartner.delete({
        where: { id },
      });
    },

    // =========================================================================
    // Partner Invitations (Secure tokens)
    // =========================================================================

    // Create invitation with secure token
    async createInvitation(data: {
      accountId: string;
      email: string;
      name?: string;
    }) {
      // Generate secure token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(rawToken, 10);

      // Set expiry (7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await prisma.partnerInvitation.create({
        data: {
          accountId: data.accountId,
          email: data.email,
          name: data.name,
          token: tokenHash,
          expiresAt,
        },
      });

      // Return with raw token (only time it's available)
      return { ...invitation, rawToken };
    },

    // Verify invitation token
    async verifyInvitation(email: string, token: string) {
      const invitations = await prisma.partnerInvitation.findMany({
        where: {
          email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      for (const inv of invitations) {
        const isValid = await bcrypt.compare(token, inv.token);
        if (isValid) {
          return inv;
        }
      }
      return null;
    },

    // Accept invitation
    async acceptInvitation(id: string) {
      return prisma.partnerInvitation.update({
        where: { id },
        data: { acceptedAt: new Date() },
      });
    },

    // Clean expired invitations
    async cleanExpired() {
      return prisma.partnerInvitation.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
          acceptedAt: null,
        },
      });
    },

    // Check if user email exists
    async checkEmailExists(email: string) {
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, name: true },
      });
      return user;
    },

    // =========================================================================
    // Partnership Partners
    // =========================================================================

    // Add a partner to a partnership account
    async addPartnershipPartner(data: {
      accountId: string;
      email: string;
      name?: string;
      role?: string;
      ownershipPercent?: number;
    }) {
      // Check if email belongs to an existing user
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true, name: true },
      });

      return prisma.partnershipPartner.create({
        data: {
          accountId: data.accountId,
          email: data.email,
          name: data.name || existingUser?.name,
          role: data.role,
          ownershipPercent: data.ownershipPercent,
          userId: existingUser?.id,
          status: "PENDING",
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    },

    // Get partnership partners for an account
    async getPartnershipPartners(accountId: string) {
      return prisma.partnershipPartner.findMany({
        where: { accountId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    },

    // Update partnership partner status (approve/reject)
    async updatePartnershipPartnerStatus(id: string, status: PartnerStatus, userId?: string) {
      return prisma.partnershipPartner.update({
        where: { id },
        data: {
          status,
          respondedAt: new Date(),
          ...(userId && { userId }),
        },
      });
    },

    // Get partnership partner by ID
    async findPartnershipPartnerById(id: string) {
      return prisma.partnershipPartner.findUnique({
        where: { id },
        include: {
          account: { 
            include: { 
              user: { select: { id: true, name: true, email: true } },
              partnershipProfile: true,
            } 
          },
          user: { select: { id: true, name: true, email: true } },
        },
      });
    },

    // Get pending partnership invitations for a user (by email)
    async getPendingPartnershipForEmail(email: string) {
      return prisma.partnershipPartner.findMany({
        where: { email, status: "PENDING" },
        include: {
          account: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              partnershipProfile: true,
            },
          },
        },
      });
    },

    // Get pending partnership invitations for a user (by userId)
    async getPendingPartnershipForUser(userId: string) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!user) return [];

      return prisma.partnershipPartner.findMany({
        where: {
          OR: [{ userId }, { email: user.email }],
          status: "PENDING",
        },
        include: {
          account: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              partnershipProfile: true,
            },
          },
        },
      });
    },

    // Link partnership partner to user after registration
    async linkPartnershipPartnerToUser(email: string, userId: string) {
      return prisma.partnershipPartner.updateMany({
        where: { email, userId: null },
        data: { userId },
      });
    },

    // Remove partnership partner
    async removePartnershipPartner(id: string) {
      return prisma.partnershipPartner.delete({
        where: { id },
      });
    },

    // Update partnership partner details
    async updatePartnershipPartner(id: string, data: {
      name?: string;
      email?: string;
      role?: string;
      ownershipPercent?: number | null;
    }) {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.ownershipPercent !== undefined) updateData.ownershipPercent = data.ownershipPercent;

      // If email changed, reset status to PENDING and clear userId link
      if (data.email) {
        const current = await prisma.partnershipPartner.findUnique({ where: { id }, select: { email: true } });
        if (current && current.email !== data.email) {
          updateData.status = "PENDING";
          updateData.userId = null;
          const existingUser = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true, name: true } });
          if (existingUser) {
            updateData.userId = existingUser.id;
            if (!data.name) updateData.name = existingUser.name;
          }
        }
      }

      return prisma.partnershipPartner.update({
        where: { id },
        data: updateData,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    },

    // =========================================================================
    // Partnership Partner Invitations (Secure tokens)
    // =========================================================================

    // Create partnership invitation with secure token
    async createPartnershipInvitation(data: {
      accountId: string;
      email: string;
      name?: string;
      role?: string;
      ownershipPercent?: number;
    }) {
      // Generate secure token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(rawToken, 10);

      // Set expiry (7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await prisma.partnershipInvitation.create({
        data: {
          accountId: data.accountId,
          email: data.email,
          name: data.name,
          role: data.role,
          ownershipPercent: data.ownershipPercent,
          token: tokenHash,
          expiresAt,
        },
      });

      // Return with raw token (only time it's available)
      return { ...invitation, rawToken };
    },

    // Verify partnership invitation token
    async verifyPartnershipInvitation(email: string, token: string) {
      const invitations = await prisma.partnershipInvitation.findMany({
        where: {
          email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      for (const inv of invitations) {
        const isValid = await bcrypt.compare(token, inv.token);
        if (isValid) {
          return inv;
        }
      }
      return null;
    },

    // Accept partnership invitation
    async acceptPartnershipInvitation(id: string) {
      return prisma.partnershipInvitation.update({
        where: { id },
        data: { acceptedAt: new Date() },
      });
    },

    // Get pending partnership invitation by account
    async getPartnershipInvitationsByAccount(accountId: string) {
      return prisma.partnershipInvitation.findMany({
        where: {
          accountId,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
    },

    // Clean expired partnership invitations
    async cleanExpiredPartnershipInvitations() {
      return prisma.partnershipInvitation.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
          acceptedAt: null,
        },
      });
    },

    // =========================================================================
    // Trust Partners (Trustees & Beneficiaries)
    // =========================================================================

    // Add a partner to a trust account
    async addTrustPartner(data: {
      accountId: string;
      email: string;
      name?: string;
      role?: string;
      beneficiaryPercent?: number;
    }) {
      // Check if email belongs to an existing user
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true, name: true },
      });

      return prisma.trustPartner.create({
        data: {
          accountId: data.accountId,
          email: data.email,
          name: data.name || existingUser?.name,
          role: data.role,
          beneficiaryPercent: data.beneficiaryPercent,
          userId: existingUser?.id,
          status: "PENDING",
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    },

    // Get trust partners for an account
    async getTrustPartners(accountId: string) {
      return prisma.trustPartner.findMany({
        where: { accountId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    },

    // Update trust partner status (approve/reject)
    async updateTrustPartnerStatus(id: string, status: PartnerStatus, userId?: string) {
      return prisma.trustPartner.update({
        where: { id },
        data: {
          status,
          respondedAt: new Date(),
          ...(userId && { userId }),
        },
      });
    },

    // Get trust partner by ID
    async findTrustPartnerById(id: string) {
      return prisma.trustPartner.findUnique({
        where: { id },
        include: {
          account: { 
            include: { 
              user: { select: { id: true, name: true, email: true } },
              trustProfile: true,
            } 
          },
          user: { select: { id: true, name: true, email: true } },
        },
      });
    },

    // Get pending trust invitations for a user (by email)
    async getPendingTrustForEmail(email: string) {
      return prisma.trustPartner.findMany({
        where: { email, status: "PENDING" },
        include: {
          account: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              trustProfile: true,
            },
          },
        },
      });
    },

    // Get pending trust invitations for a user (by userId)
    async getPendingTrustForUser(userId: string) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!user) return [];

      return prisma.trustPartner.findMany({
        where: {
          OR: [{ userId }, { email: user.email }],
          status: "PENDING",
        },
        include: {
          account: {
            include: {
              user: { select: { id: true, name: true, email: true } },
              trustProfile: true,
            },
          },
        },
      });
    },

    // Link trust partner to user after registration
    async linkTrustPartnerToUser(email: string, userId: string) {
      return prisma.trustPartner.updateMany({
        where: { email, userId: null },
        data: { userId },
      });
    },

    // Remove trust partner
    async removeTrustPartner(id: string) {
      return prisma.trustPartner.update({
        where: { id },
        data: { status: "REMOVED" },
      });
    },

    // =========================================================================
    // Trust Partner Invitations (Secure tokens)
    // =========================================================================

    // Create trust invitation with secure token
    async createTrustInvitation(data: {
      accountId: string;
      email: string;
      name?: string;
      role?: string;
      beneficiaryPercent?: number;
    }) {
      // Generate secure token
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(rawToken, 10);

      // Set expiry (7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await prisma.trustInvitation.create({
        data: {
          accountId: data.accountId,
          email: data.email,
          name: data.name,
          role: data.role,
          beneficiaryPercent: data.beneficiaryPercent,
          token: tokenHash,
          expiresAt,
        },
      });

      // Return with raw token (only time it's available)
      return { ...invitation, rawToken };
    },

    // Verify trust invitation token
    async verifyTrustInvitation(email: string, token: string) {
      const invitations = await prisma.trustInvitation.findMany({
        where: {
          email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      for (const inv of invitations) {
        const isValid = await bcrypt.compare(token, inv.token);
        if (isValid) {
          return inv;
        }
      }
      return null;
    },

    // Accept trust invitation
    async acceptTrustInvitation(id: string) {
      return prisma.trustInvitation.update({
        where: { id },
        data: { acceptedAt: new Date() },
      });
    },

    // Get pending trust invitation by account
    async getTrustInvitationsByAccount(accountId: string) {
      return prisma.trustInvitation.findMany({
        where: {
          accountId,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
    },

    // Clean expired trust invitations
    async cleanExpiredTrustInvitations() {
      return prisma.trustInvitation.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
          acceptedAt: null,
        },
      });
    },

    // =========================================================================
    // Get all pending partner requests for a user (Company + Partnership + Trust)
    // =========================================================================

    async getAllPendingRequestsForUser(userId: string) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (!user) return { companyRequests: [], partnershipRequests: [], trustRequests: [] };

      const [companyRequests, partnershipRequests, trustRequests] = await Promise.all([
        prisma.companyPartner.findMany({
          where: {
            OR: [{ userId }, { email: user.email }],
            status: "PENDING",
          },
          include: {
            account: {
              include: {
                user: { select: { id: true, name: true, email: true } },
                companyProfile: true,
              },
            },
          },
        }),
        prisma.partnershipPartner.findMany({
          where: {
            OR: [{ userId }, { email: user.email }],
            status: "PENDING",
          },
          include: {
            account: {
              include: {
                user: { select: { id: true, name: true, email: true } },
                partnershipProfile: true,
              },
            },
          },
        }),
        prisma.trustPartner.findMany({
          where: {
            OR: [{ userId }, { email: user.email }],
            status: "PENDING",
          },
          include: {
            account: {
              include: {
                user: { select: { id: true, name: true, email: true } },
                trustProfile: true,
              },
            },
          },
        }),
      ]);

      return { companyRequests, partnershipRequests, trustRequests };
    },
  };
}
