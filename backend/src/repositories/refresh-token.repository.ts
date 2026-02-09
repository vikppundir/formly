/**
 * Refresh token repository - token revocation support.
 * Future: use Redis for distributed revocation at scale.
 */

import type { PrismaClient } from "@prisma/client";

export function createRefreshTokenRepository(prisma: PrismaClient) {
  return {
    async create(userId: string, tokenHash: string, expiresAt: Date) {
      return prisma.refreshToken.create({
        data: { userId, tokenHash, expiresAt },
      });
    },

    async findByHash(tokenHash: string) {
      return prisma.refreshToken.findFirst({
        where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      });
    },

    async revokeByHash(tokenHash: string) {
      return prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });
    },

    async revokeAllForUser(userId: string) {
      return prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    },
  };
}
