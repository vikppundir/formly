/**
 * Settings routes: App settings, email templates, test email/SMS.
 * Protected by manage_settings permission.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { PrismaClient } from "@prisma/client";
import { createSettingsRepository } from "../repositories/settings.repository.js";
import { createEmailTemplateRepository } from "../repositories/email-template.repository.js";
import { createEmailService } from "../services/email.service.js";
import { createSmsService } from "../services/sms.service.js";
import {
  updateSettingsSchema,
  emailTemplateSchema,
  emailTemplateUpdateSchema,
  testEmailSchema,
  testSmsSchema,
  templateQuerySchema,
} from "../validations/settings.validation.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { requirePermissions } from "../middleware/permission.middleware.js";
import { writeAuditLog } from "../utils/logger.js";
import type { AuthService } from "../services/auth.service.js";

export async function registerSettingsRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const settingsRepo = createSettingsRepository(prisma);
  const templateRepo = createEmailTemplateRepository(prisma);
  const emailService = createEmailService(prisma);
  const smsService = createSmsService(prisma);

  const authMiddleware = createAuthMiddleware(authService);
  const requireSettings = requirePermissions(["manage_settings"]);

  // ============= Public Settings (no auth) =============

  // Get public website settings (no auth required)
  app.get(
    "/public/settings",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const publicKeys = [
        "app_name", "website_logo", "website_tagline",
        "contact_email", "contact_phone", "contact_address",
        "social_facebook", "social_twitter", "social_linkedin",
        "social_instagram", "social_youtube"
      ];
      
      const settings: Record<string, string> = {};
      for (const key of publicKeys) {
        settings[key] = await settingsRepo.getValue(key, "");
      }
      
      return reply.send({ settings });
    }
  );

  // ============= App Settings =============

  // Get all settings (grouped by category)
  app.get(
    "/settings",
    { preHandler: [authMiddleware, requireSettings] },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const all = await settingsRepo.getAll();

      // Group by category
      const grouped: Record<string, Record<string, string>> = {};
      for (const s of all) {
        if (!grouped[s.category]) grouped[s.category] = {};
        grouped[s.category][s.key] = s.value;
      }

      return reply.send({ settings: grouped, raw: all });
    }
  );

  // Get settings by category
  app.get(
    "/settings/:category",
    { preHandler: [authMiddleware, requireSettings] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { category } = request.params as { category: string };
      const settings = await settingsRepo.getByCategory(category);

      const mapped: Record<string, string> = {};
      for (const s of settings) {
        mapped[s.key] = s.value;
      }

      return reply.send({ category, settings: mapped });
    }
  );

  // Update settings (bulk)
  app.put(
    "/settings",
    { preHandler: [authMiddleware, requireSettings] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = updateSettingsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      await settingsRepo.bulkUpdate(parsed.data.settings);
      const req = request as AuthenticatedRequest;
      writeAuditLog({
        action: "SETTINGS_UPDATED",
        userId: req.user?.sub,
        ipAddress: request.ip,
        details: { settingKeys: parsed.data.settings.map((s: { key: string }) => s.key) },
      });
      return reply.send({ ok: true, message: "Settings updated" });
    }
  );

  // Test email connection
  app.post(
    "/settings/test-email",
    { preHandler: [authMiddleware, requireSettings] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = testEmailSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      // First test connection
      const connResult = await emailService.testConnection();
      if (!connResult.success) {
        return reply.status(400).send({ ok: false, error: connResult.error });
      }

      // Then send test email
      const sendResult = await emailService.sendRaw({
        to: parsed.data.to,
        subject: "Test Email from Jab Admin",
        html: `<h2>Test Email</h2><p>If you received this, your email configuration is working correctly.</p><p>Sent at: ${new Date().toISOString()}</p>`,
      });

      if (!sendResult.success) {
        return reply.status(400).send({ ok: false, error: sendResult.error });
      }

      return reply.send({ ok: true, message: "Test email sent successfully" });
    }
  );

  // Test SMS connection
  app.post(
    "/settings/test-sms",
    { preHandler: [authMiddleware, requireSettings] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = testSmsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      // First test connection
      const connResult = await smsService.testConnection();
      if (!connResult.success) {
        return reply.status(400).send({ ok: false, error: connResult.error });
      }

      // Then send test SMS
      const sendResult = await smsService.send({
        to: parsed.data.to,
        message: `Jab Admin: Test SMS. If you received this, your SMS configuration is working. Sent at ${new Date().toISOString()}`,
      });

      if (!sendResult.success) {
        return reply.status(400).send({ ok: false, error: sendResult.error });
      }

      return reply.send({ ok: true, message: "Test SMS sent successfully", sid: sendResult.sid });
    }
  );

  // ============= Email Templates =============

  // List templates (paginated)
  app.get(
    "/settings/email-templates",
    { preHandler: [authMiddleware, requireSettings] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = templateQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query params", details: parsed.error.flatten() });
      }

      const result = await templateRepo.listPaginated(parsed.data);
      return reply.send(result);
    }
  );

  // Get single template
  app.get(
    "/settings/email-templates/:id",
    { preHandler: [authMiddleware, requireSettings] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const template = await templateRepo.findById(id);

      if (!template) {
        return reply.status(404).send({ error: "Template not found" });
      }

      return reply.send({ template });
    }
  );

  // Create template
  app.post(
    "/settings/email-templates",
    { preHandler: [authMiddleware, requireSettings] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = emailTemplateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      // Check if code exists
      const existing = await templateRepo.findByCode(parsed.data.code);
      if (existing) {
        return reply.status(409).send({ error: "Template code already exists" });
      }

      const template = await templateRepo.create(parsed.data);
      return reply.status(201).send({ template });
    }
  );

  // Update template
  app.put(
    "/settings/email-templates/:id",
    { preHandler: [authMiddleware, requireSettings] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parsed = emailTemplateUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const existing = await templateRepo.findById(id);
      if (!existing) {
        return reply.status(404).send({ error: "Template not found" });
      }

      const template = await templateRepo.update(id, parsed.data);
      return reply.send({ template });
    }
  );

  // Delete template
  app.delete(
    "/settings/email-templates/:id",
    { preHandler: [authMiddleware, requireSettings] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const existing = await templateRepo.findById(id);
      if (!existing) {
        return reply.status(404).send({ error: "Template not found" });
      }

      await templateRepo.delete(id);
      return reply.send({ ok: true, message: "Template deleted" });
    }
  );

  // Toggle template active status
  app.patch(
    "/settings/email-templates/:id/toggle",
    { preHandler: [authMiddleware, requireSettings] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      try {
        const template = await templateRepo.toggleActive(id);
        return reply.send({ template });
      } catch {
        return reply.status(404).send({ error: "Template not found" });
      }
    }
  );

  // Preview template with variables
  app.post(
    "/settings/email-templates/:id/preview",
    { preHandler: [authMiddleware, requireSettings] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { variables } = request.body as { variables?: Record<string, string> };

      const template = await templateRepo.findById(id);
      if (!template) {
        return reply.status(404).send({ error: "Template not found" });
      }

      // Get app name
      const appName = await settingsRepo.getValue("app_name", "Jab Admin");
      const vars = { ...variables, appName };

      // Replace variables
      const replaceVars = (text: string) =>
        text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);

      return reply.send({
        subject: replaceVars(template.subject),
        bodyHtml: replaceVars(template.bodyHtml),
        bodyText: template.bodyText ? replaceVars(template.bodyText) : null,
        variables: template.variables ? JSON.parse(template.variables) : [],
      });
    }
  );
}
