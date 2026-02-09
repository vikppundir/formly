/**
 * Auth service: login, refresh, logout, token issuance.
 * JWT access (short-lived) + refresh (rotated), HTTP-only cookies handled in routes.
 *
 * Future: External SSO (Auth0/Okta) - add strategy layer; map external identity to User;
 * keep refresh token flow for session continuity.
 */

import jwt from "jsonwebtoken";
import type { PrismaClient } from "@prisma/client";
import { getEnv } from "../config/env.js";
import { hashPassword, verifyPassword, hashToken } from "../utils/hash.js";
import { createUserRepository } from "../repositories/user.repository.js";
import { createRefreshTokenRepository } from "../repositories/refresh-token.repository.js";
const env = getEnv();

/** Parse a duration string like "7d", "15m", "24h" to milliseconds */
function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
  const [, num, unit] = match;
  const n = parseInt(num, 10);
  switch (unit) {
    case "s": return n * 1000;
    case "m": return n * 60 * 1000;
    case "h": return n * 60 * 60 * 1000;
    case "d": return n * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

export interface TokenPayload {
  sub: string;
  email: string;
  type: "access" | "refresh";
  permissions?: string[];
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  permissions: string[];
  roleNames: string[];
}

export function createAuthService(prisma: PrismaClient) {
  const userRepo = createUserRepository(prisma);
  const refreshRepo = createRefreshTokenRepository(prisma);

  async function getPermissionsForUser(userId: string): Promise<string[]> {
    const user = await userRepo.findById(userId);
    if (!user) return [];
    const roleIds = user.userRoles.map((ur) => ur.roleId);
    const rolePerms = await prisma.rolePermission.findMany({
      where: { roleId: { in: roleIds } },
      include: { permission: true },
    });
    return [...new Set(rolePerms.map((rp) => rp.permission.code))];
  }

  async function login(email: string, password: string): Promise<{ user: AuthUser; accessToken: string; refreshToken: string } | null> {
    const user = await userRepo.findByEmail(email);
    if (!user) return null;
    if (user.status !== "ACTIVE") return null;
    const valid = await verifyPassword(password, user.password);
    if (!valid) return null;

    const permissions = await getPermissionsForUser(user.id);
    const roleNames = user.userRoles.map((ur) => ur.role.name);

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      type: "access",
      permissions,
    });
    const refreshToken = signRefreshToken({ sub: user.id, email: user.email, type: "refresh" });
    const refreshHash = hashToken(refreshToken);
    const refreshTtlMs = parseDurationToMs(env.JWT_REFRESH_TTL);
    const expiresAt = new Date(Date.now() + refreshTtlMs);
    await refreshRepo.create(user.id, refreshHash, expiresAt);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        permissions,
        roleNames,
      },
      accessToken,
      refreshToken,
    };
  }

  async function refresh(refreshTokenRaw: string): Promise<{ user: AuthUser; accessToken: string; refreshToken: string } | null> {
    const tokenHash = hashToken(refreshTokenRaw);
    const stored = await refreshRepo.findByHash(tokenHash);
    if (!stored) return null;

    await refreshRepo.revokeByHash(tokenHash);

    const user = await userRepo.findById(stored.userId);
    if (!user || user.status !== "ACTIVE") return null;

    const permissions = await getPermissionsForUser(user.id);
    const roleNames = user.userRoles.map((ur) => ur.role.name);

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      type: "access",
      permissions,
    });
    const newRefresh = signRefreshToken({ sub: user.id, email: user.email, type: "refresh" });
    const newHash = hashToken(newRefresh);
    const refreshTtlMs = parseDurationToMs(env.JWT_REFRESH_TTL);
    const expiresAt = new Date(Date.now() + refreshTtlMs);
    await refreshRepo.create(user.id, newHash, expiresAt);

    return {
      user: { id: user.id, email: user.email, name: user.name, permissions, roleNames },
      accessToken,
      refreshToken: newRefresh,
    };
  }

  async function logout(refreshTokenRaw: string): Promise<void> {
    const tokenHash = hashToken(refreshTokenRaw);
    await refreshRepo.revokeByHash(tokenHash);
  }

  async function logoutAll(userId: string): Promise<void> {
    await refreshRepo.revokeAllForUser(userId);
  }

  function signAccessToken(payload: Omit<TokenPayload, "permissions"> & { permissions?: string[] }): string {
    return jwt.sign(
      { ...payload, type: "access" },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_TTL }
    );
  }

  function signRefreshToken(payload: Pick<TokenPayload, "sub" | "email" | "type">): string {
    return jwt.sign(
      { ...payload, type: "refresh" },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_TTL }
    );
  }

  function verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
      if (decoded.type !== "access") return null;
      return decoded;
    } catch {
      return null;
    }
  }

  return {
    login,
    refresh,
    logout,
    logoutAll,
    getPermissionsForUser,
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    hashPassword,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
