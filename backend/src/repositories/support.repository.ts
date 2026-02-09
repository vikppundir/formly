/**
 * Support Ticket Repository
 * CRUD operations for support tickets and replies
 */

import type { PrismaClient, TicketStatus, TicketPriority } from "@prisma/client";

export function createSupportRepository(prisma: PrismaClient) {
  return {
    // Generate unique ticket number
    async generateTicketNo(): Promise<string> {
      const date = new Date();
      const prefix = `TKT${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
      const count = await prisma.supportTicket.count({
        where: { ticketNo: { startsWith: prefix } },
      });
      return `${prefix}${String(count + 1).padStart(5, "0")}`;
    },

    // Create new ticket
    async create(data: {
      userId: string;
      subject: string;
      description: string;
      priority?: TicketPriority;
      category?: string;
    }) {
      const ticketNo = await this.generateTicketNo();
      return prisma.supportTicket.create({
        data: {
          ...data,
          ticketNo,
          priority: data.priority ?? "MEDIUM",
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    },

    // Get ticket by ID
    async findById(id: string) {
      return prisma.supportTicket.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, name: true, email: true } },
          replies: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    },

    // Get tickets for a specific user (paginated)
    async findByUser(
      userId: string,
      options: { page?: number; limit?: number; status?: TicketStatus }
    ) {
      const page = options.page ?? 1;
      const limit = options.limit ?? 10;
      const skip = (page - 1) * limit;

      const where: any = { userId };
      if (options.status) where.status = options.status;

      const [tickets, total] = await Promise.all([
        prisma.supportTicket.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { replies: true } },
          },
        }),
        prisma.supportTicket.count({ where }),
      ]);

      return { tickets, total, page, limit, totalPages: Math.ceil(total / limit) };
    },

    // Get all tickets (admin) with filters
    async findAll(options: {
      page?: number;
      limit?: number;
      status?: TicketStatus;
      priority?: TicketPriority;
      search?: string;
    }) {
      const page = options.page ?? 1;
      const limit = options.limit ?? 10;
      const skip = (page - 1) * limit;

      const where: any = {};
      if (options.status) where.status = options.status;
      if (options.priority) where.priority = options.priority;
      if (options.search) {
        where.OR = [
          { ticketNo: { contains: options.search, mode: "insensitive" } },
          { subject: { contains: options.search, mode: "insensitive" } },
          { user: { name: { contains: options.search, mode: "insensitive" } } },
          { user: { email: { contains: options.search, mode: "insensitive" } } },
        ];
      }

      const [tickets, total] = await Promise.all([
        prisma.supportTicket.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, name: true, email: true } },
            _count: { select: { replies: true } },
          },
        }),
        prisma.supportTicket.count({ where }),
      ]);

      return { tickets, total, page, limit, totalPages: Math.ceil(total / limit) };
    },

    // Update ticket status
    async updateStatus(id: string, status: TicketStatus) {
      const data: any = { status };
      if (status === "CLOSED" || status === "RESOLVED") {
        data.closedAt = new Date();
      }
      return prisma.supportTicket.update({
        where: { id },
        data,
      });
    },

    // Update ticket priority
    async updatePriority(id: string, priority: TicketPriority) {
      return prisma.supportTicket.update({
        where: { id },
        data: { priority },
      });
    },

    // Add reply to ticket
    async addReply(data: {
      ticketId: string;
      userId: string;
      message: string;
      isAdmin: boolean;
    }) {
      // Update ticket status based on who replied
      const newStatus = data.isAdmin ? "WAITING_CUSTOMER" : "OPEN";
      
      const [reply] = await Promise.all([
        prisma.ticketReply.create({
          data,
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.supportTicket.update({
          where: { id: data.ticketId },
          data: { status: newStatus },
        }),
      ]);

      return reply;
    },

    // Get ticket stats (for admin dashboard)
    async getStats() {
      const [total, open, inProgress, resolved, closed] = await Promise.all([
        prisma.supportTicket.count(),
        prisma.supportTicket.count({ where: { status: "OPEN" } }),
        prisma.supportTicket.count({ where: { status: "IN_PROGRESS" } }),
        prisma.supportTicket.count({ where: { status: "RESOLVED" } }),
        prisma.supportTicket.count({ where: { status: "CLOSED" } }),
      ]);

      return { total, open, inProgress, resolved, closed };
    },
  };
}
