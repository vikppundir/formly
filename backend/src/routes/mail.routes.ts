import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createAuthMiddleware, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { requirePermissions } from "../middleware/permission.middleware.js";
import { createMailAgentService } from "../services/mail-agent.service.js";
import type { AuthService } from "../services/auth.service.js";

const listMessagesQuerySchema = z.object({
  folder: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

const messageDetailQuerySchema = z.object({
  folder: z.string().optional(),
});

const sendMailSchema = z.object({
  to: z.string().email(),
  cc: z.string().email().optional().or(z.literal("")),
  bcc: z.string().email().optional().or(z.literal("")),
  subject: z.string().min(1).max(400),
  html: z.string().optional(),
  text: z.string().optional(),
  attachments: z
    .array(
      z.object({
        fileName: z.string().min(1).max(260),
        mimeType: z.string().optional(),
        contentBase64: z.string().min(1),
      })
    )
    .optional(),
});

export async function registerMailRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const authMiddleware = createAuthMiddleware(authService);
  const requireMailAccess = requirePermissions(["manage_settings"]);
  const mailAgent = createMailAgentService(prisma);

  app.get(
    "/mail/runtime",
    { preHandler: [authMiddleware, requireMailAccess] },
    async (_request, reply) => {
      try {
        const runtime = await mailAgent.getRuntimeConfig();
        return reply.send(runtime);
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Failed to load mail runtime" });
      }
    }
  );

  app.delete(
    "/mail/message/:id",
    { preHandler: [authMiddleware, requireMailAccess] },
    async (request: FastifyRequest, reply) => {
      const { id } = request.params as { id: string };
      const parsed = messageDetailQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query params", details: parsed.error.flatten() });
      }
      try {
        const result = await mailAgent.deleteMessage(parsed.data.folder || "INBOX", id);
        return reply.send(result);
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Failed to delete message" });
      }
    }
  );

  app.get(
    "/mail/mailboxes",
    { preHandler: [authMiddleware, requireMailAccess] },
    async (_request, reply) => {
      try {
        const mailboxes = await mailAgent.listMailboxes();
        return reply.send({ items: mailboxes });
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Failed to load mailboxes" });
      }
    }
  );

  app.get(
    "/mail/folders",
    { preHandler: [authMiddleware, requireMailAccess] },
    async (_request, reply) => {
      try {
        const folders = await mailAgent.listFoldersWithCounts();
        return reply.send({ items: folders });
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Failed to load folders" });
      }
    }
  );

  app.get(
    "/mail/messages",
    { preHandler: [authMiddleware, requireMailAccess] },
    async (request: FastifyRequest, reply) => {
      const parsed = listMessagesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query params", details: parsed.error.flatten() });
      }
      try {
        const pageResult = await mailAgent.listMessages(
          parsed.data.folder || "inbox",
          parsed.data.search || "",
          parsed.data.limit || 25,
          parsed.data.page || 1
        );
        return reply.send(pageResult);
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Failed to fetch messages" });
      }
    }
  );

  app.get(
    "/mail/message/:id",
    { preHandler: [authMiddleware, requireMailAccess] },
    async (request: FastifyRequest, reply) => {
      const { id } = request.params as { id: string };
      const parsed = messageDetailQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query params", details: parsed.error.flatten() });
      }
      try {
        const item = await mailAgent.getMessageDetail(parsed.data.folder || "INBOX", id);
        return reply.send(item);
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Failed to fetch message detail" });
      }
    }
  );

  app.get(
    "/mail/message/:id/attachments/:index",
    { preHandler: [authMiddleware, requireMailAccess] },
    async (request: FastifyRequest, reply) => {
      const { id, index } = request.params as { id: string; index: string };
      const parsed = messageDetailQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query params", details: parsed.error.flatten() });
      }
      const idx = Number.parseInt(index, 10);
      if (!Number.isFinite(idx) || idx < 0) {
        return reply.status(400).send({ error: "Invalid attachment index" });
      }
      try {
        const attachment = await mailAgent.getAttachment(parsed.data.folder || "INBOX", id, idx);
        reply.header("Content-Type", attachment.mimeType);
        reply.header("Content-Disposition", `attachment; filename="${attachment.fileName.replace(/"/g, "")}"`);
        return reply.send(attachment.content);
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Failed to fetch attachment" });
      }
    }
  );

  app.post(
    "/mail/send",
    { preHandler: [authMiddleware, requireMailAccess] },
    async (request: FastifyRequest, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = sendMailSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }
      try {
        await mailAgent.sendMail({
          to: parsed.data.to,
          cc: parsed.data.cc || undefined,
          bcc: parsed.data.bcc || undefined,
          subject: parsed.data.subject,
          html: parsed.data.html || undefined,
          text: parsed.data.text || undefined,
          attachments: parsed.data.attachments || [],
        });
        return reply.send({ ok: true, message: "Email sent successfully", userId: req.user?.sub || null });
      } catch (error) {
        return reply.status(400).send({ error: error instanceof Error ? error.message : "Failed to send email" });
      }
    }
  );
}
