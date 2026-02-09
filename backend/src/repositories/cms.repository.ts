/**
 * CMS Repository - Data access for website content management
 * Handles pages, home sections, testimonials, service cards, and navigation
 */

import type { PrismaClient, HomeSectionType } from "@prisma/client";

export function createCmsRepository(prisma: PrismaClient) {
  return {
    // =========================================================================
    // PAGES
    // =========================================================================
    
    async createPage(data: {
      slug: string;
      title: string;
      description?: string;
      content: string;
      metaTitle?: string;
      metaKeywords?: string;
      isPublished?: boolean;
      showInNav?: boolean;
      navOrder?: number;
      template?: string;
    }) {
      return prisma.page.create({ data });
    },

    async updatePage(id: string, data: {
      slug?: string;
      title?: string;
      description?: string;
      content?: string;
      metaTitle?: string;
      metaKeywords?: string;
      isPublished?: boolean;
      showInNav?: boolean;
      navOrder?: number;
      template?: string;
    }) {
      return prisma.page.update({ where: { id }, data });
    },

    async deletePage(id: string) {
      return prisma.page.delete({ where: { id } });
    },

    async getPageById(id: string) {
      return prisma.page.findUnique({ where: { id } });
    },

    async getPageBySlug(slug: string) {
      return prisma.page.findUnique({ where: { slug } });
    },

    async getPublishedPageBySlug(slug: string) {
      return prisma.page.findFirst({
        where: { slug, isPublished: true },
      });
    },

    async listPages(includeUnpublished = false) {
      return prisma.page.findMany({
        where: includeUnpublished ? {} : { isPublished: true },
        orderBy: { navOrder: "asc" },
      });
    },

    async getNavPages() {
      return prisma.page.findMany({
        where: { isPublished: true, showInNav: true },
        orderBy: { navOrder: "asc" },
        select: { id: true, slug: true, title: true, navOrder: true },
      });
    },

    // =========================================================================
    // HOME SECTIONS
    // =========================================================================

    async createHomeSection(data: {
      sectionType: HomeSectionType;
      title?: string;
      subtitle?: string;
      content?: string;
      isActive?: boolean;
      sortOrder?: number;
    }) {
      return prisma.homeSection.create({ data });
    },

    async updateHomeSection(id: string, data: {
      sectionType?: HomeSectionType;
      title?: string;
      subtitle?: string;
      content?: string;
      isActive?: boolean;
      sortOrder?: number;
    }) {
      return prisma.homeSection.update({ where: { id }, data });
    },

    async deleteHomeSection(id: string) {
      return prisma.homeSection.delete({ where: { id } });
    },

    async getHomeSectionById(id: string) {
      return prisma.homeSection.findUnique({ where: { id } });
    },

    async listHomeSections(activeOnly = true) {
      return prisma.homeSection.findMany({
        where: activeOnly ? { isActive: true } : {},
        orderBy: { sortOrder: "asc" },
      });
    },

    async getHomeSectionByType(sectionType: HomeSectionType) {
      return prisma.homeSection.findFirst({
        where: { sectionType, isActive: true },
      });
    },

    // =========================================================================
    // TESTIMONIALS
    // =========================================================================

    async createTestimonial(data: {
      name: string;
      role?: string;
      content: string;
      rating?: number;
      imageUrl?: string;
      isActive?: boolean;
      sortOrder?: number;
    }) {
      return prisma.testimonial.create({ data });
    },

    async updateTestimonial(id: string, data: {
      name?: string;
      role?: string;
      content?: string;
      rating?: number;
      imageUrl?: string;
      isActive?: boolean;
      sortOrder?: number;
    }) {
      return prisma.testimonial.update({ where: { id }, data });
    },

    async deleteTestimonial(id: string) {
      return prisma.testimonial.delete({ where: { id } });
    },

    async getTestimonialById(id: string) {
      return prisma.testimonial.findUnique({ where: { id } });
    },

    async listTestimonials(activeOnly = true) {
      return prisma.testimonial.findMany({
        where: activeOnly ? { isActive: true } : {},
        orderBy: { sortOrder: "asc" },
      });
    },

    // =========================================================================
    // SERVICE CARDS (Display cards, not purchasable services)
    // =========================================================================

    async createServiceCard(data: {
      title: string;
      description?: string;
      icon?: string;
      linkUrl?: string;
      isActive?: boolean;
      sortOrder?: number;
    }) {
      return prisma.serviceCard.create({ data });
    },

    async updateServiceCard(id: string, data: {
      title?: string;
      description?: string;
      icon?: string;
      linkUrl?: string;
      isActive?: boolean;
      sortOrder?: number;
    }) {
      return prisma.serviceCard.update({ where: { id }, data });
    },

    async deleteServiceCard(id: string) {
      return prisma.serviceCard.delete({ where: { id } });
    },

    async getServiceCardById(id: string) {
      return prisma.serviceCard.findUnique({ where: { id } });
    },

    async listServiceCards(activeOnly = true) {
      return prisma.serviceCard.findMany({
        where: activeOnly ? { isActive: true } : {},
        orderBy: { sortOrder: "asc" },
      });
    },

    // =========================================================================
    // NAVIGATION MENU
    // =========================================================================

    async createNavMenuItem(data: {
      label: string;
      url: string;
      target?: string;
      parentId?: string;
      isActive?: boolean;
      sortOrder?: number;
    }) {
      return prisma.navMenuItem.create({ data });
    },

    async updateNavMenuItem(id: string, data: {
      label?: string;
      url?: string;
      target?: string;
      parentId?: string | null;
      isActive?: boolean;
      sortOrder?: number;
    }) {
      return prisma.navMenuItem.update({ where: { id }, data });
    },

    async deleteNavMenuItem(id: string) {
      return prisma.navMenuItem.delete({ where: { id } });
    },

    async getNavMenuItemById(id: string) {
      return prisma.navMenuItem.findUnique({ where: { id } });
    },

    async listNavMenuItems(activeOnly = true) {
      return prisma.navMenuItem.findMany({
        where: activeOnly ? { isActive: true } : {},
        orderBy: { sortOrder: "asc" },
      });
    },

    // =========================================================================
    // PUBLIC HOMEPAGE DATA - Combined data for frontend
    // =========================================================================

    async getPublicHomepageData() {
      const [sections, testimonials, serviceCards, navItems] = await Promise.all([
        prisma.homeSection.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        }),
        prisma.testimonial.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        }),
        prisma.serviceCard.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        }),
        prisma.navMenuItem.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        }),
      ]);

      return { sections, testimonials, serviceCards, navItems };
    },

    // Seed default homepage data if none exists
    async seedDefaultHomepageData() {
      const existingSections = await prisma.homeSection.count();
      if (existingSections > 0) return;

      // Create default sections
      const defaultSections = [
        {
          sectionType: "HERO" as HomeSectionType,
          title: "In-depth Perfect Analysis",
          subtitle: "Professional accounting services for individuals and businesses across Australia",
          content: JSON.stringify({
            ctaText: "Get Started",
            ctaLink: "/register",
            secondaryCta: "Our Services",
            secondaryCtaLink: "#services",
            backgroundImage: "",
          }),
          sortOrder: 1,
        },
        {
          sectionType: "ABOUT" as HomeSectionType,
          title: "We don't just prepare accounts. We protect your business.",
          subtitle: "About JAP Accountants",
          content: JSON.stringify({
            description: "At JAP Accountants, we believe accounting isn't just about numbers — it's about building confidence in your financial decisions. Based in Victoria, our team provides end-to-end accounting and tax services tailored for individuals and SMEs across Australia.",
            quote: "We optimise your tax position, and keep you compliant—so you can grow with confidence.",
            features: [
              { label: "100%", text: "ATO Ready", icon: "✓" },
              { label: "24h", text: "Support", icon: "⚡" },
              { label: "Secure", text: "Data Vault", icon: "🔒" },
              { label: "VIC", text: "Victoria Base", icon: "📍" },
            ],
          }),
          sortOrder: 2,
        },
        {
          sectionType: "STATISTICS" as HomeSectionType,
          title: "Proven Results That Speak",
          subtitle: "By The Numbers",
          content: JSON.stringify({
            stats: [
              { value: 6000, suffix: "+", label: "Happy Clients" },
              { value: 25440, prefix: "$", label: "Average Savings" },
              { value: 8.5, prefix: "$", suffix: "M", label: "Government Grants", isDecimal: true },
              { value: 98.4, suffix: "%", label: "Calls responded in 24 hrs", isDecimal: true },
            ],
          }),
          sortOrder: 3,
        },
        {
          sectionType: "SERVICES" as HomeSectionType,
          title: "Expert Solutions",
          subtitle: "Our Expertise",
          content: JSON.stringify({
            description: "Built to meet ATO / IRD / GST requirements from day one",
          }),
          sortOrder: 4,
        },
        {
          sectionType: "AUDIENCE" as HomeSectionType,
          title: "Built for You",
          subtitle: "Target Audience",
          content: JSON.stringify({
            description: "Specialised accounting for every Australian business segment.",
            segments: [
              { label: "Small to medium size business", benefit: "Scale with structural confidence" },
              { label: "Startup and New Business", benefit: "From ABN setup to cloud automation" },
              { label: "High-income individual", benefit: "Optimize your wealth & tax position" },
              { label: "Property investor", benefit: "Manage yields, deductions & CGT" },
              { label: "e-commerce, online and uber drivers", benefit: "Specialized ride-share tax support" },
              { label: "Sole Trader and contractor", benefit: "Simple, effective BAS & Bookkeeping" },
            ],
          }),
          sortOrder: 5,
        },
        {
          sectionType: "TESTIMONIALS" as HomeSectionType,
          title: "What Our Clients Say",
          subtitle: "Client Success Stories",
          content: JSON.stringify({}),
          sortOrder: 6,
        },
        {
          sectionType: "CONTACT_FORM" as HomeSectionType,
          title: "Get Started",
          subtitle: "",
          content: JSON.stringify({
            buttonText: "Start Onboarding",
          }),
          sortOrder: 7,
        },
        {
          sectionType: "LEADERSHIP" as HomeSectionType,
          title: "Amit Deol",
          subtitle: "Director, JAP Accountants",
          content: JSON.stringify({
            quote: "At JAP Accountants, we believe accounting isn't just about numbers — it's about building confidence in your financial decisions.",
            image: "https://picsum.photos/300/300?grayscale",
            verification: "AMIT KAUR DEOL",
          }),
          sortOrder: 8,
        },
      ];

      await prisma.homeSection.createMany({ data: defaultSections });

      // Create default testimonials
      const defaultTestimonials = [
        {
          name: "Sarah Mitchell",
          role: "CEO, TechStart Solutions",
          content: "JAP Accountants transformed our financial management. Their expertise saved us over $30,000 in the first year alone. Highly professional and always responsive!",
          rating: 5,
          imageUrl: "https://i.pravatar.cc/150?img=47",
          sortOrder: 1,
        },
        {
          name: "Michael Chen",
          role: "Property Investor",
          content: "As a property investor, tax compliance was overwhelming. JAP Accountants simplified everything and helped me maximize deductions. Their team is exceptional!",
          rating: 5,
          imageUrl: "https://i.pravatar.cc/150?img=12",
          sortOrder: 2,
        },
        {
          name: "Emma Thompson",
          role: "Small Business Owner",
          content: "The cloud accounting setup was seamless. I can now focus on growing my business while JAP handles all the financial complexities. Best decision ever!",
          rating: 5,
          imageUrl: "https://i.pravatar.cc/150?img=45",
          sortOrder: 3,
        },
        {
          name: "David Rodriguez",
          role: "Freelance Consultant",
          content: "From BAS lodgements to tax optimization, JAP Accountants has been a game-changer. They're always available when I need them. 98.4% response rate is real!",
          rating: 5,
          imageUrl: "https://i.pravatar.cc/150?img=33",
          sortOrder: 4,
        },
        {
          name: "Lisa Anderson",
          role: "E-commerce Entrepreneur",
          content: "Government grants assistance was outstanding. JAP helped us secure significant funding and navigate all compliance requirements. Truly grateful!",
          rating: 5,
          imageUrl: "https://i.pravatar.cc/150?img=20",
          sortOrder: 5,
        },
        {
          name: "James Wilson",
          role: "Startup Founder",
          content: "Starting a business is stressful enough. Having JAP Accountants handle all financial aspects gave me peace of mind. Professional, efficient, and reliable.",
          rating: 5,
          imageUrl: "https://i.pravatar.cc/150?img=51",
          sortOrder: 6,
        },
      ];

      await prisma.testimonial.createMany({ data: defaultTestimonials });

      // Create default service cards
      const defaultServiceCards = [
        { title: "Taxation Services", icon: "💼", description: "GST/BAS, individual and business returns, and strategic year-end planning.", sortOrder: 1 },
        { title: "Bookkeeping & Payroll", icon: "📊", description: "Day-to-day management and full superannuation compliance.", sortOrder: 2 },
        { title: "Business Advisory", icon: "💡", description: "Understanding financial positioning to improve long-term profitability.", sortOrder: 3 },
        { title: "Startup & Company Setup", icon: "🚀", description: "From business structure choice to registration and cloud accounting setup.", sortOrder: 4 },
        { title: "BAS & GST Compliance", icon: "📑", description: "Accurate, on-time lodgements every quarter without the headaches.", sortOrder: 5 },
        { title: "Financial Reporting", icon: "📝", description: "Clear, accurate reports including cash flow statements and P&L summaries.", sortOrder: 6 },
      ];

      await prisma.serviceCard.createMany({ data: defaultServiceCards });

      // Create default navigation items
      const defaultNavItems = [
        { label: "Home", url: "/", sortOrder: 1 },
        { label: "About", url: "/#about", sortOrder: 2 },
        { label: "Services", url: "/#services", sortOrder: 3 },
        { label: "Contact", url: "/#contact", sortOrder: 4 },
      ];

      await prisma.navMenuItem.createMany({ data: defaultNavItems });
    },
  };
}

export type CmsRepository = ReturnType<typeof createCmsRepository>;
