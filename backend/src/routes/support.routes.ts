/**
 * Support Ticket Routes
 * User: Create tickets, view own tickets, add replies
 * Admin: View all tickets, respond, change status/priority
 */

import type { FastifyInstance } from "fastify";
import type { PrismaClient, TicketStatus, TicketPriority } from "@prisma/client";
import type { AuthService } from "../services/auth.service.js";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createSupportRepository } from "../repositories/support.repository.js";
import { z } from "zod";

const createTicketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters").max(200),
  description: z.string().min(10, "Description must be at least 10 characters"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  category: z.string().optional(),
});

const replySchema = z.object({
  message: z.string().min(1, "Message is required"),
});

const updateStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"]),
});

const updatePrioritySchema = z.object({
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
});

export async function registerSupportRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
): Promise<void> {
  const supportRepo = createSupportRepository(prisma);
  const authMiddleware = createAuthMiddleware(authService);

  // Check if user has admin-level permissions (RBAC-based, not hardcoded role names)
  const isAdmin = async (userId: string): Promise<boolean> => {
    const permissions = await authService.getPermissionsForUser(userId);
    return permissions.includes("manage_users");
  };

  // =========================================================================
  // USER ENDPOINTS
  // =========================================================================

  // Create new ticket
  app.post(
    "/support/tickets",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const parsed = createTicketSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const ticket = await supportRepo.create({
        userId: req.user!.sub,
        ...parsed.data,
      });

      return reply.status(201).send({ ticket });
    }
  );

  // Get user's tickets
  app.get(
    "/support/tickets",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const query = request.query as { page?: string; limit?: string; status?: TicketStatus };

      const result = await supportRepo.findByUser(req.user!.sub, {
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 10,
        status: query.status,
      });

      return reply.send(result);
    }
  );

  // Get single ticket (user can only see own tickets, admin can see all)
  app.get(
    "/support/tickets/:id",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };

      const ticket = await supportRepo.findById(id);
      if (!ticket) {
        return reply.status(404).send({ error: "Ticket not found" });
      }

      // Check access
      const admin = await isAdmin(req.user!.sub);
      if (!admin && ticket.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      return reply.send({ ticket });
    }
  );

  // Add reply to ticket
  app.post(
    "/support/tickets/:id/replies",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const req = request as AuthenticatedRequest;
      const { id } = request.params as { id: string };
      const parsed = replySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const ticket = await supportRepo.findById(id);
      if (!ticket) {
        return reply.status(404).send({ error: "Ticket not found" });
      }

      // Check access
      const admin = await isAdmin(req.user!.sub);
      if (!admin && ticket.userId !== req.user!.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const ticketReply = await supportRepo.addReply({
        ticketId: id,
        userId: req.user!.sub,
        message: parsed.data.message,
        isAdmin: admin,
      });

      return reply.status(201).send({ reply: ticketReply });
    }
  );

  // =========================================================================
  // ADMIN ENDPOINTS
  // =========================================================================

  // Get all tickets (admin only)
  app.get(
    "/admin/support/tickets",
    { preHandler: [authMiddleware, requirePermission("manage_users")] },
    async (request, reply) => {
      const query = request.query as {
        page?: string;
        limit?: string;
        status?: TicketStatus;
        priority?: TicketPriority;
        search?: string;
      };

      const result = await supportRepo.findAll({
        page: query.page ? parseInt(query.page) : 1,
        limit: query.limit ? parseInt(query.limit) : 10,
        status: query.status,
        priority: query.priority,
        search: query.search,
      });

      return reply.send(result);
    }
  );

  // Get ticket stats (admin only)
  app.get(
    "/admin/support/stats",
    { preHandler: [authMiddleware, requirePermission("manage_users")] },
    async (request, reply) => {
      const stats = await supportRepo.getStats();
      return reply.send({ stats });
    }
  );

  // Update ticket status (admin only)
  app.patch(
    "/admin/support/tickets/:id/status",
    { preHandler: [authMiddleware, requirePermission("manage_users")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateStatusSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const ticket = await supportRepo.findById(id);
      if (!ticket) {
        return reply.status(404).send({ error: "Ticket not found" });
      }

      const updated = await supportRepo.updateStatus(id, parsed.data.status);
      return reply.send({ ticket: updated });
    }
  );

  // Update ticket priority (admin only)
  app.patch(
    "/admin/support/tickets/:id/priority",
    { preHandler: [authMiddleware, requirePermission("manage_users")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updatePrioritySchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: "Validation failed", details: parsed.error.flatten() });
      }

      const ticket = await supportRepo.findById(id);
      if (!ticket) {
        return reply.status(404).send({ error: "Ticket not found" });
      }

      const updated = await supportRepo.updatePriority(id, parsed.data.priority);
      return reply.send({ ticket: updated });
    }
  );
}
