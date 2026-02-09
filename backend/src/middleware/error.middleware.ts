/**
 * Centralized error handling. No stack traces in production (SOC 2).
 * Structured errors for audit-friendly logging.
 */

import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { logger } from "../utils/logger.js";

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const statusCode = error.statusCode ?? 500;
  const isProd = process.env.NODE_ENV === "production";

  if (statusCode >= 500) {
    logger.error(error.message, {
      err: error,
      url: request.url,
      method: request.method,
      // Future: userId, tenantId for audit
    });
  }

  reply.status(statusCode).send({
    error: error.name ?? "InternalServerError",
    message: isProd && statusCode === 500 ? "Internal server error" : error.message,
    ...(isProd ? {} : { stack: error.stack }),
  });
}
