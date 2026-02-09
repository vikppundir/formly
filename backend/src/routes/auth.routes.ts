/**
 * Auth routes: login, refresh, logout.
 * Rate limiting applied at server level for /auth/* (SOC 2).
 * Tokens in HTTP-only cookies for CSRF-safe architecture.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { AuthService } from "../services/auth.service.js";
import { loginSchema, refreshSchema } from "../validations/auth.validation.js";
import { getEnv } from "../config/env.js";
import { ACCESS_COOKIE } from "../middleware/auth.middleware.js";
import { writeAuditLog } from "../utils/logger.js";

const env = getEnv();
const REFRESH_COOKIE = "refresh_token";
const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: "lax" as const,
  path: "/",
  ...(env.COOKIE_DOMAIN && { domain: env.COOKIE_DOMAIN }),
};

const AUTH_RATE_LIMIT = {
  max: getEnv().RATE_LIMIT_AUTH_MAX,
  timeWindow: getEnv().RATE_LIMIT_AUTH_WINDOW_MS,
};

export async function registerAuthRoutes(
  app: FastifyInstance,
  authService: AuthService
): Promise<void> {
  app.post(
    "/auth/login",
    { config: { rateLimit: AUTH_RATE_LIMIT } },
    async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
    }
    const { email, password, rememberMe } = parsed.data;
    const result = await authService.login(email, password);
    if (!result) {
      writeAuditLog({
        action: "LOGIN_FAILED",
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        details: { email: email },
      });
      return reply.status(401).send({ error: "Invalid credentials" });
    }
    writeAuditLog({
      action: "LOGIN_SUCCESS",
      userId: result.user.id,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });
    
    // Cookie expiration based on rememberMe option:
    // - With rememberMe: 30 days persistent cookie
    // - Without rememberMe: Session cookie (no maxAge = expires when browser closes)
    if (rememberMe) {
      const accessMaxAge = 30 * 24 * 60 * 60; // 30 days in seconds
      const refreshMaxAge = 30 * 24 * 60 * 60; // 30 days
      reply
        .setCookie(ACCESS_COOKIE, result.accessToken, { ...COOKIE_OPTS, maxAge: accessMaxAge })
        .setCookie(REFRESH_COOKIE, result.refreshToken, { ...COOKIE_OPTS, maxAge: refreshMaxAge });
    } else {
      // Session cookies - no maxAge means they expire when browser closes
      reply
        .setCookie(ACCESS_COOKIE, result.accessToken, { ...COOKIE_OPTS })
        .setCookie(REFRESH_COOKIE, result.refreshToken, { ...COOKIE_OPTS });
    }
    
    reply.send({ user: result.user, rememberMe });
  }
  );

  app.post(
    "/auth/refresh",
    { config: { rateLimit: AUTH_RATE_LIMIT } },
    async (request: FastifyRequest, reply: FastifyReply) => {
    const token =
      (request.cookies?.[REFRESH_COOKIE] as string) ??
      (request.body as { refreshToken?: string })?.refreshToken;
    const parsed = refreshSchema.safeParse({ refreshToken: token });
    if (!parsed.success || !token) {
      return reply.status(400).send({ error: "Refresh token required" });
    }
    const result = await authService.refresh(token);
    if (!result) {
      reply.clearCookie(ACCESS_COOKIE).clearCookie(REFRESH_COOKIE);
      return reply.status(401).send({ error: "Invalid or expired refresh token" });
    }
    
    // Check if rememberMe was passed in body, otherwise maintain existing cookie behavior
    const rememberMe = (request.body as { rememberMe?: boolean })?.rememberMe;
    
    if (rememberMe) {
      // Extend persistent session for 30 more days
      const accessMaxAge = 30 * 24 * 60 * 60; // 30 days
      const refreshMaxAge = 30 * 24 * 60 * 60; // 30 days
      reply
        .setCookie(ACCESS_COOKIE, result.accessToken, { ...COOKIE_OPTS, maxAge: accessMaxAge })
        .setCookie(REFRESH_COOKIE, result.refreshToken, { ...COOKIE_OPTS, maxAge: refreshMaxAge });
    } else {
      // Session cookies - expire when browser closes
      reply
        .setCookie(ACCESS_COOKIE, result.accessToken, { ...COOKIE_OPTS })
        .setCookie(REFRESH_COOKIE, result.refreshToken, { ...COOKIE_OPTS });
    }
    
    reply.send({ user: result.user });
  }
  );

  app.post(
    "/auth/logout",
    { config: { rateLimit: AUTH_RATE_LIMIT } },
    async (request: FastifyRequest, reply: FastifyReply) => {
    const token =
      request.cookies?.[REFRESH_COOKIE] ??
      (request.body as { refreshToken?: string })?.refreshToken;
    if (token) await authService.logout(token);
    writeAuditLog({
      action: "LOGOUT",
      ipAddress: request.ip,
    });
    // Always clear cookies regardless of whether token was provided
    reply
      .clearCookie(ACCESS_COOKIE, { path: "/" })
      .clearCookie(REFRESH_COOKIE, { path: "/" })
      .send({ ok: true });
  }
  );
}
