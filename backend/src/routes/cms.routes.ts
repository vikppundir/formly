/**
 * CMS Routes - Content Management System for website
 * Public routes for fetching content, admin routes for managing content
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { PrismaClient, HomeSectionType } from "@prisma/client";
import type { AuthService } from "../services/auth.service.js";
import { createAuthMiddleware } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/permission.middleware.js";
import { createCmsRepository } from "../repositories/cms.repository.js";

// Validation schemas
const createPageSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  content: z.string().min(1),
  metaTitle: z.string().optional(),
  metaKeywords: z.string().optional(),
  isPublished: z.boolean().optional().default(false),
  showInNav: z.boolean().optional().default(false),
  navOrder: z.number().int().optional().default(0),
  template: z.string().optional().default("default"),
});

const updatePageSchema = createPageSchema.partial();

const createHomeSectionSchema = z.object({
  sectionType: z.enum([
    "HERO", "ABOUT", "STATISTICS", "SERVICES", "AUDIENCE",
    "TESTIMONIALS", "CONTACT_FORM", "LEADERSHIP", "CUSTOM"
  ]),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  content: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

const updateHomeSectionSchema = createHomeSectionSchema.partial();

const createTestimonialSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().optional(),
  content: z.string().min(1),
  rating: z.number().int().min(1).max(5).optional().default(5),
  imageUrl: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

const updateTestimonialSchema = createTestimonialSchema.partial();

const createServiceCardSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().optional(),
  linkUrl: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

const updateServiceCardSchema = createServiceCardSchema.partial();

const createNavMenuItemSchema = z.object({
  label: z.string().min(1).max(50),
  url: z.string().min(1),
  target: z.enum(["_self", "_blank"]).optional().default("_self"),
  parentId: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

const updateNavMenuItemSchema = createNavMenuItemSchema.partial();

export async function registerCmsRoutes(
  app: FastifyInstance,
  authService: AuthService,
  prisma: PrismaClient
) {
  const cmsRepo = createCmsRepository(prisma);
  const authMiddleware = createAuthMiddleware(authService);

  // =========================================================================
  // PUBLIC ROUTES - No authentication required
  // =========================================================================

  // Get all public homepage data
  app.get("/public/homepage", async (_request, reply) => {
    try {
      // Seed default data if none exists
      await cmsRepo.seedDefaultHomepageData();
      const data = await cmsRepo.getPublicHomepageData();
      return reply.send(data);
    } catch (error) {
      console.error("Error fetching homepage data:", error);
      return reply.status(500).send({ error: "Failed to fetch homepage data" });
    }
  });

  // Get published page by slug
  app.get("/public/pages/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    try {
      const page = await cmsRepo.getPublishedPageBySlug(slug);
      if (!page) {
        return reply.status(404).send({ error: "Page not found" });
      }
      return reply.send(page);
    } catch (error) {
      console.error("Error fetching page:", error);
      return reply.status(500).send({ error: "Failed to fetch page" });
    }
  });

  // Get navigation pages
  app.get("/public/nav-pages", async (_request, reply) => {
    try {
      const pages = await cmsRepo.getNavPages();
      return reply.send(pages);
    } catch (error) {
      console.error("Error fetching nav pages:", error);
      return reply.status(500).send({ error: "Failed to fetch navigation pages" });
    }
  });

  // Get published testimonials
  app.get("/public/testimonials", async (_request, reply) => {
    try {
      const testimonials = await cmsRepo.listTestimonials(true);
      return reply.send(testimonials);
    } catch (error) {
      console.error("Error fetching testimonials:", error);
      return reply.status(500).send({ error: "Failed to fetch testimonials" });
    }
  });

  // Get active service cards
  app.get("/public/service-cards", async (_request, reply) => {
    try {
      const cards = await cmsRepo.listServiceCards(true);
      return reply.send(cards);
    } catch (error) {
      console.error("Error fetching service cards:", error);
      return reply.status(500).send({ error: "Failed to fetch service cards" });
    }
  });

  // Get active navigation menu
  app.get("/public/nav-menu", async (_request, reply) => {
    try {
      const items = await cmsRepo.listNavMenuItems(true);
      return reply.send(items);
    } catch (error) {
      console.error("Error fetching nav menu:", error);
      return reply.status(500).send({ error: "Failed to fetch navigation menu" });
    }
  });

  // =========================================================================
  // ADMIN ROUTES - Requires authentication and admin permissions
  // =========================================================================

  // --- PAGES ---
  
  // List all pages (including unpublished)
  app.get(
    "/admin/pages",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (_request, reply) => {
      try {
        const pages = await cmsRepo.listPages(true);
        return reply.send(pages);
      } catch (error) {
        console.error("Error listing pages:", error);
        return reply.status(500).send({ error: "Failed to list pages" });
      }
    }
  );

  // Get page by ID
  app.get(
    "/admin/pages/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const page = await cmsRepo.getPageById(id);
        if (!page) {
          return reply.status(404).send({ error: "Page not found" });
        }
        return reply.send(page);
      } catch (error) {
        console.error("Error fetching page:", error);
        return reply.status(500).send({ error: "Failed to fetch page" });
      }
    }
  );

  // Create page
  app.post(
    "/admin/pages",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const parseResult = createPageSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Validation failed", details: parseResult.error.errors });
      }
      try {
        const page = await cmsRepo.createPage(parseResult.data);
        return reply.status(201).send(page);
      } catch (error: any) {
        if (error.code === "P2002") {
          return reply.status(400).send({ error: "Page with this slug already exists" });
        }
        console.error("Error creating page:", error);
        return reply.status(500).send({ error: "Failed to create page" });
      }
    }
  );

  // Update page
  app.patch(
    "/admin/pages/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = updatePageSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Validation failed", details: parseResult.error.errors });
      }
      try {
        const page = await cmsRepo.updatePage(id, parseResult.data);
        return reply.send(page);
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Page not found" });
        }
        if (error.code === "P2002") {
          return reply.status(400).send({ error: "Page with this slug already exists" });
        }
        console.error("Error updating page:", error);
        return reply.status(500).send({ error: "Failed to update page" });
      }
    }
  );

  // Delete page
  app.delete(
    "/admin/pages/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await cmsRepo.deletePage(id);
        return reply.send({ success: true });
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Page not found" });
        }
        console.error("Error deleting page:", error);
        return reply.status(500).send({ error: "Failed to delete page" });
      }
    }
  );

  // --- HOME SECTIONS ---

  // List all home sections
  app.get(
    "/admin/home-sections",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (_request, reply) => {
      try {
        // Seed defaults if needed
        await cmsRepo.seedDefaultHomepageData();
        const sections = await cmsRepo.listHomeSections(false);
        return reply.send(sections);
      } catch (error) {
        console.error("Error listing home sections:", error);
        return reply.status(500).send({ error: "Failed to list home sections" });
      }
    }
  );

  // Get home section by ID
  app.get(
    "/admin/home-sections/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const section = await cmsRepo.getHomeSectionById(id);
        if (!section) {
          return reply.status(404).send({ error: "Section not found" });
        }
        return reply.send(section);
      } catch (error) {
        console.error("Error fetching section:", error);
        return reply.status(500).send({ error: "Failed to fetch section" });
      }
    }
  );

  // Create home section
  app.post(
    "/admin/home-sections",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const parseResult = createHomeSectionSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Validation failed", details: parseResult.error.errors });
      }
      try {
        const section = await cmsRepo.createHomeSection({
          ...parseResult.data,
          sectionType: parseResult.data.sectionType as HomeSectionType,
        });
        return reply.status(201).send(section);
      } catch (error) {
        console.error("Error creating section:", error);
        return reply.status(500).send({ error: "Failed to create section" });
      }
    }
  );

  // Update home section
  app.patch(
    "/admin/home-sections/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = updateHomeSectionSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Validation failed", details: parseResult.error.errors });
      }
      try {
        const updateData = parseResult.data.sectionType
          ? { ...parseResult.data, sectionType: parseResult.data.sectionType as HomeSectionType }
          : parseResult.data;
        const section = await cmsRepo.updateHomeSection(id, updateData);
        return reply.send(section);
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Section not found" });
        }
        console.error("Error updating section:", error);
        return reply.status(500).send({ error: "Failed to update section" });
      }
    }
  );

  // Delete home section
  app.delete(
    "/admin/home-sections/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await cmsRepo.deleteHomeSection(id);
        return reply.send({ success: true });
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Section not found" });
        }
        console.error("Error deleting section:", error);
        return reply.status(500).send({ error: "Failed to delete section" });
      }
    }
  );

  // --- TESTIMONIALS ---

  // List all testimonials
  app.get(
    "/admin/testimonials",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (_request, reply) => {
      try {
        const testimonials = await cmsRepo.listTestimonials(false);
        return reply.send(testimonials);
      } catch (error) {
        console.error("Error listing testimonials:", error);
        return reply.status(500).send({ error: "Failed to list testimonials" });
      }
    }
  );

  // Create testimonial
  app.post(
    "/admin/testimonials",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const parseResult = createTestimonialSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Validation failed", details: parseResult.error.errors });
      }
      try {
        const testimonial = await cmsRepo.createTestimonial(parseResult.data);
        return reply.status(201).send(testimonial);
      } catch (error) {
        console.error("Error creating testimonial:", error);
        return reply.status(500).send({ error: "Failed to create testimonial" });
      }
    }
  );

  // Update testimonial
  app.patch(
    "/admin/testimonials/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = updateTestimonialSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Validation failed", details: parseResult.error.errors });
      }
      try {
        const testimonial = await cmsRepo.updateTestimonial(id, parseResult.data);
        return reply.send(testimonial);
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Testimonial not found" });
        }
        console.error("Error updating testimonial:", error);
        return reply.status(500).send({ error: "Failed to update testimonial" });
      }
    }
  );

  // Delete testimonial
  app.delete(
    "/admin/testimonials/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await cmsRepo.deleteTestimonial(id);
        return reply.send({ success: true });
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Testimonial not found" });
        }
        console.error("Error deleting testimonial:", error);
        return reply.status(500).send({ error: "Failed to delete testimonial" });
      }
    }
  );

  // --- SERVICE CARDS ---

  // List all service cards
  app.get(
    "/admin/service-cards",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (_request, reply) => {
      try {
        const cards = await cmsRepo.listServiceCards(false);
        return reply.send(cards);
      } catch (error) {
        console.error("Error listing service cards:", error);
        return reply.status(500).send({ error: "Failed to list service cards" });
      }
    }
  );

  // Create service card
  app.post(
    "/admin/service-cards",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const parseResult = createServiceCardSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Validation failed", details: parseResult.error.errors });
      }
      try {
        const card = await cmsRepo.createServiceCard(parseResult.data);
        return reply.status(201).send(card);
      } catch (error) {
        console.error("Error creating service card:", error);
        return reply.status(500).send({ error: "Failed to create service card" });
      }
    }
  );

  // Update service card
  app.patch(
    "/admin/service-cards/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = updateServiceCardSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Validation failed", details: parseResult.error.errors });
      }
      try {
        const card = await cmsRepo.updateServiceCard(id, parseResult.data);
        return reply.send(card);
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Service card not found" });
        }
        console.error("Error updating service card:", error);
        return reply.status(500).send({ error: "Failed to update service card" });
      }
    }
  );

  // Delete service card
  app.delete(
    "/admin/service-cards/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await cmsRepo.deleteServiceCard(id);
        return reply.send({ success: true });
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Service card not found" });
        }
        console.error("Error deleting service card:", error);
        return reply.status(500).send({ error: "Failed to delete service card" });
      }
    }
  );

  // --- NAVIGATION MENU ---

  // List all nav menu items
  app.get(
    "/admin/nav-menu",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (_request, reply) => {
      try {
        const items = await cmsRepo.listNavMenuItems(false);
        return reply.send(items);
      } catch (error) {
        console.error("Error listing nav menu items:", error);
        return reply.status(500).send({ error: "Failed to list navigation menu" });
      }
    }
  );

  // Create nav menu item
  app.post(
    "/admin/nav-menu",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const parseResult = createNavMenuItemSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Validation failed", details: parseResult.error.errors });
      }
      try {
        const item = await cmsRepo.createNavMenuItem(parseResult.data);
        return reply.status(201).send(item);
      } catch (error) {
        console.error("Error creating nav menu item:", error);
        return reply.status(500).send({ error: "Failed to create navigation item" });
      }
    }
  );

  // Update nav menu item
  app.patch(
    "/admin/nav-menu/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parseResult = updateNavMenuItemSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: "Validation failed", details: parseResult.error.errors });
      }
      try {
        const item = await cmsRepo.updateNavMenuItem(id, parseResult.data);
        return reply.send(item);
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Navigation item not found" });
        }
        console.error("Error updating nav menu item:", error);
        return reply.status(500).send({ error: "Failed to update navigation item" });
      }
    }
  );

  // Delete nav menu item
  app.delete(
    "/admin/nav-menu/:id",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await cmsRepo.deleteNavMenuItem(id);
        return reply.send({ success: true });
      } catch (error: any) {
        if (error.code === "P2025") {
          return reply.status(404).send({ error: "Navigation item not found" });
        }
        console.error("Error deleting nav menu item:", error);
        return reply.status(500).send({ error: "Failed to delete navigation item" });
      }
    }
  );

  // --- SEED DEFAULT DATA (Admin utility) ---
  app.post(
    "/admin/cms/seed-defaults",
    { preHandler: [authMiddleware, requirePermission("manage_settings")] },
    async (_request, reply) => {
      try {
        await cmsRepo.seedDefaultHomepageData();
        return reply.send({ success: true, message: "Default homepage data seeded" });
      } catch (error) {
        console.error("Error seeding defaults:", error);
        return reply.status(500).send({ error: "Failed to seed default data" });
      }
    }
  );
}
