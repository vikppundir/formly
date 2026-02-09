/**
 * Backend entry - Fastify server with security (SOC 2).
 * Secure headers, CORS, HTTP-only cookies, rate limiting on auth.
 *
 * Future scalability:
 * - Microservices: split auth, users, billing into separate services; API gateway.
 * - SSO: Auth0/Okta via strategy layer in auth service; keep JWT/cookie flow for internal.
 * - Audit: centralize writeAuditLog in middleware; persist to audit_events or external.
 */
import "./load-env.js";

import Fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { PrismaClient } from "@prisma/client";
import { getEnv } from "./config/env.js";
import { createAuthService } from "./services/auth.service.js";
import {
  registerAuthRoutes,
  registerMeRoutes,
  registerUsersRoutes,
  registerRolesRoutes,
  registerRegisterRoutes,
  registerSettingsRoutes,
  registerSupportRoutes,
  // Multi-account system routes
  registerAccountsRoutes,
  registerServicesRoutes,
  registerPartnersRoutes,
  registerConsentsRoutes,
  registerPaymentRoutes,
  // ABN & Spouse routes
  registerAbnRoutes,
  registerSpouseRoutes,
  // CMS routes
  registerCmsRoutes,
  // Forgot password
  registerForgotPasswordRoutes,
} from "./routes/index.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { logger } from "./utils/logger.js";

const env = getEnv();
const prisma = new PrismaClient();
const authService = createAuthService(prisma);

async function build() {
  const app = Fastify({ logger: false });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        frameSrc: ["'self'", "https://js.stripe.com"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  });
  await app.register(cors, {
    origin: env.NODE_ENV === "production"
      ? (env.CORS_ORIGIN || "").split(",").map((o) => o.trim()).filter(Boolean)
      : true,
    credentials: true,
  });
  await app.register(cookie, { secret: env.JWT_ACCESS_SECRET });
  await app.register(rateLimit, {
    max: 60,
    timeWindow: "1 minute",
  });

  app.setErrorHandler(errorHandler);

  await registerAuthRoutes(app, authService);
  await registerRegisterRoutes(app, prisma);
  await registerMeRoutes(app, authService, prisma);
  await registerUsersRoutes(app, authService, prisma);
  await registerRolesRoutes(app, authService, prisma);
  await registerSettingsRoutes(app, authService, prisma);
  await registerSupportRoutes(app, authService, prisma);
  // Multi-account system routes
  await registerAccountsRoutes(app, authService, prisma);
  await registerServicesRoutes(app, authService, prisma);
  await registerPartnersRoutes(app, authService, prisma);
  await registerConsentsRoutes(app, authService, prisma);
  await registerPaymentRoutes(app, authService, prisma);
  // ABN & Spouse routes
  await registerAbnRoutes(app, authService, prisma);
  await registerSpouseRoutes(app, authService, prisma);
  // CMS routes (public and admin)
  await registerCmsRoutes(app, authService, prisma);
  // Forgot password (public)
  await registerForgotPasswordRoutes(app, prisma);

  app.get("/", (_req, reply) =>
    reply.send({ name: "Formly API", version: "1.0.0", health: "/health", docs: "API base" })
  );
  app.get("/health", (_req, reply) => reply.send({ ok: true }));

  return app;
}

build()
  .then((app) => {
    return app.listen({ port: env.BACKEND_PORT, host: "0.0.0.0" });
  })
  .then((addr) => {
    logger.info("Backend listening", { addr });
  })
  .catch((err) => {
    logger.error("Backend failed to start", { err });
    process.exit(1);
  });
