import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { AuthService } from "../services/auth.service.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import { requirePermissions } from "../middleware/permission.middleware.js";
import { z } from "zod";

const userParamSchema = z.object({
  id: z.string().min(1),
});

type ParsedChecklistNote = {
  checklist?: Record<
    string,
    {
      documents?: Array<{
        id?: string;
        fileName?: string;
        originalName?: string;
        fileSize?: number;
        mimeType?: string;
        filePath?: string;
        documentType?: string | null;
        createdAt?: string;
      }>;
    }
  >;
};

function getChecklistDocumentCount(notes: string | null): number {
  if (!notes) return 0;
  try {
    const parsed = JSON.parse(notes) as ParsedChecklistNote;
    if (!parsed || typeof parsed !== "object" || !parsed.checklist) return 0;
    return Object.values(parsed.checklist).reduce((sum, entry) => {
      const docs = Array.isArray(entry?.documents) ? entry.documents.length : 0;
      return sum + docs;
    }, 0);
  } catch {
    return 0;
  }
}

function toMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function registerCustomer360Routes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const authMiddleware = createAuthMiddleware(authService);

  app.get(
    "/admin/users/:id/360",
    { preHandler: [authMiddleware, requirePermissions(["manage_users", "manage_settings"])] },
    async (request, reply) => {
      const parsed = userParamSchema.safeParse((request as { params: { id?: string } }).params);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid user id" });

      const userId = parsed.data.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!user) return reply.status(404).send({ error: "User not found" });

      const [accounts, purchases, supportTickets, legalConsents, companyRoleLinks, partnershipRoleLinks, trustRoleLinks] = await Promise.all([
        prisma.account.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          include: {
            individualProfile: {
              include: { rentalProperties: true },
            },
            companyProfile: true,
            trustProfile: true,
            partnershipProfile: true,
            _count: {
              select: {
                accountServices: true,
                legalConsents: true,
                companyPartners: true,
                partnershipPartners: true,
                trustPartners: true,
              },
            },
          },
        }),
        prisma.accountService.findMany({
          where: { account: { userId } },
          orderBy: { purchasedAt: "desc" },
          include: {
            service: {
              select: { id: true, name: true, code: true, category: true },
            },
            account: {
              select: { id: true, name: true, accountType: true, status: true },
            },
          },
        }),
        prisma.supportTicket.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          include: {
            _count: {
              select: { replies: true },
            },
          },
        }),
        prisma.legalConsent.findMany({
          where: { userId },
          orderBy: { acceptedAt: "desc" },
          include: {
            account: {
              select: { id: true, name: true, accountType: true },
            },
          },
        }),
        prisma.companyPartner.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          include: {
            account: {
              select: { id: true, name: true, accountType: true, status: true, userId: true },
            },
          },
        }),
        prisma.partnershipPartner.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          include: {
            account: {
              select: { id: true, name: true, accountType: true, status: true, userId: true },
            },
          },
        }),
        prisma.trustPartner.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          include: {
            account: {
              select: { id: true, name: true, accountType: true, status: true, userId: true },
            },
          },
        }),
      ]);

      const totalSpent = purchases.reduce((sum, p) => sum + Number(p.paymentAmount ?? p.price ?? 0), 0);
      const paidPurchases = purchases.filter((p) => p.paymentStatus === "PAID").length;
      const openTickets = supportTickets.filter((t) => t.status !== "CLOSED" && t.status !== "RESOLVED").length;

      const accountTypeDistribution = accounts.reduce<Record<string, number>>((acc, account) => {
        acc[account.accountType] = (acc[account.accountType] ?? 0) + 1;
        return acc;
      }, {});

      const serviceStatusDistribution = purchases.reduce<Record<string, number>>((acc, purchase) => {
        acc[purchase.status] = (acc[purchase.status] ?? 0) + 1;
        return acc;
      }, {});

      const monthlyRequestsMap: Record<string, number> = {};
      const now = new Date();
      for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthlyRequestsMap[toMonthKey(d)] = 0;
      }
      for (const p of purchases) {
        const key = toMonthKey(new Date(p.purchasedAt));
        if (key in monthlyRequestsMap) monthlyRequestsMap[key] += 1;
      }
      const monthlyRequests = Object.entries(monthlyRequestsMap).map(([month, count]) => ({ month, count }));

      const yearlySpendMap = purchases.reduce<Record<string, number>>((acc, purchase) => {
        const y = String(new Date(purchase.purchasedAt).getFullYear());
        acc[y] = (acc[y] ?? 0) + Number(purchase.paymentAmount ?? purchase.price ?? 0);
        return acc;
      }, {});
      const yearlySpend = Object.entries(yearlySpendMap)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([year, amount]) => ({ year, amount }));

      const rentalPropertyCount = accounts.reduce((sum, account) => {
        return sum + (account.individualProfile?.rentalProperties?.length ?? 0);
      }, 0);
      const checklistDocumentCount = purchases.reduce((sum, purchase) => {
        return sum + getChecklistDocumentCount(purchase.notes);
      }, 0);

      const roleLinks = [
        ...companyRoleLinks.map((r) => ({
          relationType: "COMPANY_PARTNER",
          role: r.role || `${r.isDirector ? "Director " : ""}${r.isShareholder ? "Shareholder" : ""}`.trim() || "Partner",
          status: r.status,
          account: r.account,
          email: r.email,
          invitedAt: r.invitedAt,
          respondedAt: r.respondedAt,
        })),
        ...partnershipRoleLinks.map((r) => ({
          relationType: "PARTNERSHIP_PARTNER",
          role: r.role || "Partner",
          status: r.status,
          account: r.account,
          email: r.email,
          invitedAt: r.invitedAt,
          respondedAt: r.respondedAt,
        })),
        ...trustRoleLinks.map((r) => ({
          relationType: "TRUST_PARTNER",
          role: r.role || "Trust Partner",
          status: r.status,
          account: r.account,
          email: r.email,
          invitedAt: r.invitedAt,
          respondedAt: r.respondedAt,
        })),
      ];

      const relatedAccountIds = Array.from(
        new Set([
          ...accounts.map((a) => a.id),
          ...roleLinks.map((r) => r.account.id),
        ])
      );

      const relatedAccounts = relatedAccountIds.length
        ? await prisma.account.findMany({
            where: { id: { in: relatedAccountIds } },
            orderBy: { createdAt: "desc" },
            include: {
              user: { select: { id: true, name: true, email: true } },
              companyPartners: {
                select: {
                  id: true,
                  userId: true,
                  email: true,
                  name: true,
                  role: true,
                  status: true,
                  isDirector: true,
                  isShareholder: true,
                  invitedAt: true,
                  respondedAt: true,
                  user: { select: { id: true, name: true, email: true } },
                },
              },
              partnershipPartners: {
                select: {
                  id: true,
                  userId: true,
                  email: true,
                  name: true,
                  role: true,
                  status: true,
                  invitedAt: true,
                  respondedAt: true,
                  user: { select: { id: true, name: true, email: true } },
                },
              },
              trustPartners: {
                select: {
                  id: true,
                  userId: true,
                  email: true,
                  name: true,
                  role: true,
                  status: true,
                  invitedAt: true,
                  respondedAt: true,
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
          })
        : [];

      const accountUserLinks = relatedAccounts.map((account) => {
        const links: Array<{
          relationType: string;
          role: string;
          status: string;
          email: string;
          name: string | null;
          userId: string | null;
          invitedAt: Date | null;
          respondedAt: Date | null;
          isDirector: boolean;
          isShareholder: boolean;
        }> = [];

        // Owner link (always approved)
        links.push({
          relationType: "OWNER",
          role: "Owner",
          status: "APPROVED",
          email: account.user.email,
          name: account.user.name,
          userId: account.user.id,
          invitedAt: account.createdAt,
          respondedAt: account.createdAt,
          isDirector: false,
          isShareholder: false,
        });

        for (const cp of account.companyPartners) {
          links.push({
            relationType: "COMPANY_PARTNER",
            role: cp.role || `${cp.isDirector ? "Director " : ""}${cp.isShareholder ? "Shareholder" : ""}`.trim() || "Partner",
            status: cp.status,
            email: cp.email,
            name: cp.name || cp.user?.name || null,
            userId: cp.userId ?? cp.user?.id ?? null,
            invitedAt: cp.invitedAt,
            respondedAt: cp.respondedAt,
            isDirector: Boolean(cp.isDirector),
            isShareholder: Boolean(cp.isShareholder),
          });
        }

        for (const pp of account.partnershipPartners) {
          links.push({
            relationType: "PARTNERSHIP_PARTNER",
            role: pp.role || "Partner",
            status: pp.status,
            email: pp.email,
            name: pp.name || pp.user?.name || null,
            userId: pp.userId ?? pp.user?.id ?? null,
            invitedAt: pp.invitedAt,
            respondedAt: pp.respondedAt,
            isDirector: false,
            isShareholder: false,
          });
        }

        for (const tp of account.trustPartners) {
          links.push({
            relationType: "TRUST_PARTNER",
            role: tp.role || "Trust Partner",
            status: tp.status,
            email: tp.email,
            name: tp.name || tp.user?.name || null,
            userId: tp.userId ?? tp.user?.id ?? null,
            invitedAt: tp.invitedAt,
            respondedAt: tp.respondedAt,
            isDirector: false,
            isShareholder: false,
          });
        }

        const uniqueByEmail = new Map<string, (typeof links)[number]>();
        for (const link of links) {
          const key = link.email.toLowerCase();
          if (!uniqueByEmail.has(key)) uniqueByEmail.set(key, link);
        }
        const uniqueUsers = Array.from(uniqueByEmail.values());
        const roleText = (r: string) => r.toLowerCase();

        return {
          account: {
            id: account.id,
            name: account.name,
            accountType: account.accountType,
            status: account.status,
            ownerId: account.userId,
            ownerName: account.user.name,
            ownerEmail: account.user.email,
            createdAt: account.createdAt,
          },
          counts: {
            totalUsers: uniqueUsers.length,
            approvedUsers: uniqueUsers.filter((u) => u.status === "APPROVED").length,
            pendingUsers: uniqueUsers.filter((u) => u.status === "PENDING").length,
            directors: uniqueUsers.filter((u) => u.isDirector || roleText(u.role).includes("director")).length,
            shareholders: uniqueUsers.filter((u) => u.isShareholder || roleText(u.role).includes("shareholder")).length,
            trustees: uniqueUsers.filter((u) => roleText(u.role).includes("trustee")).length,
            beneficiaries: uniqueUsers.filter((u) => roleText(u.role).includes("beneficiary")).length,
          },
          users: uniqueUsers,
        };
      });

      return reply.send({
        user,
        summary: {
          totalAccounts: accounts.length,
          totalRelatedAccounts: relatedAccountIds.length,
          totalRoleLinks: roleLinks.length,
          totalServiceRequests: purchases.length,
          paidServiceRequests: paidPurchases,
          totalSupportTickets: supportTickets.length,
          openSupportTickets: openTickets,
          totalConsents: legalConsents.length,
          totalRentalProperties: rentalPropertyCount,
          checklistDocumentCount,
          lifetimeValue: totalSpent,
        },
        charts: {
          accountTypeDistribution,
          serviceStatusDistribution,
          monthlyRequests,
          yearlySpend,
        },
        data: {
          accounts,
          roleLinks,
          accountUserLinks,
          serviceRequests: purchases,
          supportTickets,
          legalConsents,
        },
      });
    }
  );
}
