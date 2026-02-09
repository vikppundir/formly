/**
 * Permission middleware: require one or more permissions (RBAC).
 * Use after auth middleware. Protects both API and can be used for route guards.
 * Logs access denials for security audit trail.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import type { AuthenticatedRequest } from "./auth.middleware.js";
import { writeAuditLog } from "../utils/logger.js";

export function requirePermissions(permissions: string[]) {
  return async function permissionMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const authReq = request as AuthenticatedRequest;
    const user = authReq.user;
    if (!user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    const userPerms = user.permissions ?? [];
    const hasAny = permissions.some((p) => userPerms.includes(p));
    if (!hasAny) {
      writeAuditLog({
        action: "ACCESS_DENIED",
        userId: user.sub,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        details: {
          requiredPermissions: permissions,
          userPermissions: userPerms,
          url: request.url,
          method: request.method,
        },
      });
      return reply.status(403).send({ error: "Forbidden", message: "Insufficient permissions" });
    }
  };
}

/** Require single permission. */
export function requirePermission(permission: string) {
  return requirePermissions([permission]);
}
