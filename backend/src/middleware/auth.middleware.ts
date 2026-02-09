/**
 * Auth middleware: verify JWT from cookie or Authorization header.
 * Attaches user payload to request for downstream use.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { AuthService } from "../services/auth.service.js";
import type { TokenPayload } from "../services/auth.service.js";

const ACCESS_COOKIE = "access_token";

export interface AuthenticatedRequest extends FastifyRequest {
  user?: TokenPayload;
}

export function createAuthMiddleware(authService: AuthService) {
  return async function authMiddleware(
    request: AuthenticatedRequest,
    reply: FastifyReply
  ): Promise<void> {
    let token: string | undefined =
      (request.cookies?.[ACCESS_COOKIE] as string) ??
      request.headers.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return reply.status(401).send({ error: "Unauthorized", message: "Missing or invalid token" });
    }

    const payload = authService.verifyAccessToken(token);
    if (!payload) {
      return reply.status(401).send({ error: "Unauthorized", message: "Invalid or expired token" });
    }

    request.user = payload;
  };
}

export { ACCESS_COOKIE };
