/**
 * ABN Lookup Routes - Australian Business Number validation
 * Uses ABR (Australian Business Register) Web Services API
 * Admin configures API key in Settings → ABN Lookup tab
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { AuthService } from "../services/auth.service.js";
import { createAuthMiddleware, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { z } from "zod";
import { logger } from "../utils/logger.js";

const abnSchema = z.object({
  abn: z.string().min(11).max(14), // ABN with or without spaces
});

export async function registerAbnRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const authMiddleware = createAuthMiddleware(authService);

  /**
   * POST /abn/lookup
   * Validates an ABN and returns registered business details
   * Requires authentication (user must be logged in)
   */
  app.post(
    "/abn/lookup",
    { preHandler: [authMiddleware], config: { rateLimit: { max: 20, timeWindow: 60000 } } },
    async (request, reply) => {
      const parsed = abnSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid ABN format", details: parsed.error.flatten() });
      }

      // Strip spaces and non-digit chars from ABN
      const abn = parsed.data.abn.replace(/\D/g, "");

      if (abn.length !== 11) {
        return reply.status(400).send({ error: "ABN must be exactly 11 digits" });
      }

      // Check if ABN Lookup is enabled in admin settings
      const enabledSetting = await prisma.appSettings.findUnique({ where: { key: "abn_lookup_enabled" } });
      if (!enabledSetting || enabledSetting.value !== "true") {
        return reply.status(400).send({
          error: "ABN Lookup is not enabled",
          message: "ABN validation is currently disabled. Contact your administrator.",
        });
      }

      // Get API key and URL from settings
      const [apiKeySetting, apiUrlSetting] = await Promise.all([
        prisma.appSettings.findUnique({ where: { key: "abn_lookup_api_key" } }),
        prisma.appSettings.findUnique({ where: { key: "abn_lookup_api_url" } }),
      ]);

      const apiKey = apiKeySetting?.value;
      if (!apiKey) {
        return reply.status(500).send({
          error: "ABN Lookup API key not configured",
          message: "ABN validation is enabled but the API key is not configured. Contact your administrator.",
        });
      }

      const apiUrl = apiUrlSetting?.value || "https://abr.business.gov.au/json/AbnDetails.aspx";

      try {
        // Call ABR Web Services API
        const callbackName = "abnCallback";
        const lookupUrl = `${apiUrl}?abn=${abn}&callback=${callbackName}&guid=${apiKey}`;

        const response = await fetch(lookupUrl);
        const text = await response.text();

        // ABR returns JSONP: callbackName({...})
        // Extract the JSON from the JSONP response
        const jsonStr = text.replace(new RegExp(`^${callbackName}\\(`), "").replace(/\)$/, "");
        const data = JSON.parse(jsonStr);

        if (!data || !data.Abn) {
          return reply.status(404).send({
            valid: false,
            error: "ABN not found",
            message: data?.Message || "The ABN could not be found in the Australian Business Register.",
          });
        }

        // Extract business name - try EntityName first, then BusinessName array
        let businessName = "";
        if (data.EntityName) {
          businessName = data.EntityName;
        }
        if (!businessName && data.BusinessName && Array.isArray(data.BusinessName) && data.BusinessName.length > 0) {
          businessName = data.BusinessName[0].Name || data.BusinessName[0];
        }

        // Determine ABN status
        const entityStatus = data.EntityStatusCode || "";
        const isActive = entityStatus.toLowerCase() === "active";

        // Extract GST registration
        const gstList = data.Gst || [];
        const hasGst = Array.isArray(gstList) && gstList.length > 0;
        const gstFrom = hasGst ? gstList[0].EffectiveFrom : null;

        logger.info("ABN lookup successful", { abn, businessName, status: entityStatus });

        return reply.send({
          valid: true,
          abn: data.Abn,
          abnStatus: entityStatus,
          isActive,
          entityName: data.EntityName || "",
          businessName,
          entityType: data.EntityTypeName || data.EntityTypeCode || "",
          gstRegistered: hasGst,
          gstEffectiveFrom: gstFrom,
          state: data.AddressState || "",
          postcode: data.AddressPostcode || "",
        });
      } catch (err) {
        logger.error("ABN lookup failed", { abn, error: err instanceof Error ? err.message : String(err) });
        return reply.status(500).send({
          valid: false,
          error: "ABN lookup failed",
          message: "Unable to verify ABN at this time. Please try again later.",
        });
      }
    }
  );

  /**
   * GET /abn/settings
   * Returns whether ABN lookup is enabled (public check for frontend)
   */
  app.get(
    "/abn/settings",
    { preHandler: [authMiddleware] },
    async (_request, reply) => {
      const enabledSetting = await prisma.appSettings.findUnique({ where: { key: "abn_lookup_enabled" } });
      return reply.send({
        enabled: enabledSetting?.value === "true",
      });
    }
  );
}
