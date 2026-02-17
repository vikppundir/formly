"use client";

/**
 * Website CMS Management Page
 * Admins can manage homepage sections, testimonials, service cards, pages, and navigation
 */

import { useState, useEffect } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

type Tab = "sections" | "testimonials" | "services" | "pages" | "legal" | "navigation";

interface HomeSection {
  id: string;
  sectionType: string;
  title: string | null;
  subtitle: string | null;
  content: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  content: string;
  rating: number;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface ServiceCard {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  linkUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface Page {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string;
  isPublished: boolean;
  showInNav: boolean;
  navOrder: number;
}

interface NavMenuItem {
  id: string;
  label: string;
  url: string;
  target: string;
  isActive: boolean;
  sortOrder: number;
}

const SECTION_TYPES = [
  { value: "HERO", label: "Hero Banner" },
  { value: "ABOUT", label: "About Section" },
  { value: "STATISTICS", label: "Statistics" },
  { value: "SERVICES", label: "Services Grid" },
  { value: "AUDIENCE", label: "Who We Help" },
  { value: "TESTIMONIALS", label: "Testimonials" },
  { value: "CONTACT_FORM", label: "Contact Form" },
  { value: "LEADERSHIP", label: "Leadership" },
  { value: "CUSTOM", label: "Custom HTML" },
];

export default function WebsiteManagementPage() {
  const [activeTab, setActiveTab] = useState<Tab>("sections");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [serviceCards, setServiceCards] = useState<ServiceCard[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [navItems, setNavItems] = useState<NavMenuItem[]>([]);

  // Edit modals
  const [editingSection, setEditingSection] = useState<HomeSection | null>(null);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [editingServiceCard, setEditingServiceCard] = useState<ServiceCard | null>(null);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [editingNavItem, setEditingNavItem] = useState<NavMenuItem | null>(null);

  // Create new
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [showCreateTestimonial, setShowCreateTestimonial] = useState(false);
  const [showCreateServiceCard, setShowCreateServiceCard] = useState(false);
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [showCreateNavItem, setShowCreateNavItem] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [sectionsRes, testimonialsRes, serviceCardsRes, pagesRes, navRes] = await Promise.all([
        apiGet("/admin/home-sections"),
        apiGet("/admin/testimonials"),
        apiGet("/admin/service-cards"),
        apiGet("/admin/pages"),
        apiGet("/admin/nav-menu"),
      ]);
      setSections(sectionsRes);
      setTestimonials(testimonialsRes);
      setServiceCards(serviceCardsRes);
      setPages(pagesRes);
      setNavItems(navRes);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  // ===================== SECTIONS =====================
  async function handleSaveSection(data: Partial<HomeSection>, isNew: boolean) {
    try {
      if (isNew) {
        await apiPost("/admin/home-sections", data);
        showSuccess("Section created successfully");
      } else {
        await apiPatch(`/admin/home-sections/${data.id}`, data);
        showSuccess("Section updated successfully");
      }
      loadData();
      setEditingSection(null);
      setShowCreateSection(false);
    } catch (err: any) {
      setError(err.message || "Failed to save section");
    }
  }

  async function handleDeleteSection(id: string) {
    if (!confirm("Are you sure you want to delete this section?")) return;
    try {
      await apiDelete(`/admin/home-sections/${id}`);
      showSuccess("Section deleted");
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete section");
    }
  }

  // ===================== TESTIMONIALS =====================
  async function handleSaveTestimonial(data: Partial<Testimonial>, isNew: boolean) {
    try {
      if (isNew) {
        await apiPost("/admin/testimonials", data);
        showSuccess("Testimonial created successfully");
      } else {
        await apiPatch(`/admin/testimonials/${data.id}`, data);
        showSuccess("Testimonial updated successfully");
      }
      loadData();
      setEditingTestimonial(null);
      setShowCreateTestimonial(false);
    } catch (err: any) {
      setError(err.message || "Failed to save testimonial");
    }
  }

  async function handleDeleteTestimonial(id: string) {
    if (!confirm("Are you sure you want to delete this testimonial?")) return;
    try {
      await apiDelete(`/admin/testimonials/${id}`);
      showSuccess("Testimonial deleted");
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete testimonial");
    }
  }

  // ===================== SERVICE CARDS =====================
  async function handleSaveServiceCard(data: Partial<ServiceCard>, isNew: boolean) {
    try {
      if (isNew) {
        await apiPost("/admin/service-cards", data);
        showSuccess("Service card created successfully");
      } else {
        await apiPatch(`/admin/service-cards/${data.id}`, data);
        showSuccess("Service card updated successfully");
      }
      loadData();
      setEditingServiceCard(null);
      setShowCreateServiceCard(false);
    } catch (err: any) {
      setError(err.message || "Failed to save service card");
    }
  }

  async function handleDeleteServiceCard(id: string) {
    if (!confirm("Are you sure you want to delete this service card?")) return;
    try {
      await apiDelete(`/admin/service-cards/${id}`);
      showSuccess("Service card deleted");
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete service card");
    }
  }

  // ===================== PAGES =====================
  async function handleSavePage(data: Partial<Page>, isNew: boolean) {
    try {
      if (isNew) {
        await apiPost("/admin/pages", data);
        showSuccess("Page created successfully");
      } else {
        await apiPatch(`/admin/pages/${data.id}`, data);
        showSuccess("Page updated successfully");
      }
      loadData();
      setEditingPage(null);
      setShowCreatePage(false);
    } catch (err: any) {
      setError(err.message || "Failed to save page");
    }
  }

  async function handleDeletePage(id: string) {
    if (!confirm("Are you sure you want to delete this page?")) return;
    try {
      await apiDelete(`/admin/pages/${id}`);
      showSuccess("Page deleted");
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete page");
    }
  }

  // ===================== NAV ITEMS =====================
  async function handleSaveNavItem(data: Partial<NavMenuItem>, isNew: boolean) {
    try {
      if (isNew) {
        await apiPost("/admin/nav-menu", data);
        showSuccess("Navigation item created successfully");
      } else {
        await apiPatch(`/admin/nav-menu/${data.id}`, data);
        showSuccess("Navigation item updated successfully");
      }
      loadData();
      setEditingNavItem(null);
      setShowCreateNavItem(false);
    } catch (err: any) {
      setError(err.message || "Failed to save navigation item");
    }
  }

  async function handleDeleteNavItem(id: string) {
    if (!confirm("Are you sure you want to delete this navigation item?")) return;
    try {
      await apiDelete(`/admin/nav-menu/${id}`);
      showSuccess("Navigation item deleted");
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete navigation item");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Website Management</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Manage your public website content, homepage sections, and pages
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 pb-2">
        {([
          { key: "sections", label: "Homepage Sections" },
          { key: "testimonials", label: "Testimonials" },
          { key: "services", label: "Service Cards" },
          { key: "pages", label: "Pages" },
          { key: "legal", label: "Legal Pages" },
          { key: "navigation", label: "Navigation" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-teal-500 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        {/* ===================== SECTIONS TAB ===================== */}
        {activeTab === "sections" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Homepage Sections</h2>
              <button
                onClick={() => setShowCreateSection(true)}
                className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600"
              >
                Add Section
              </button>
            </div>
            <div className="space-y-3">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400 w-8">
                      #{section.sortOrder}
                    </span>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {SECTION_TYPES.find(t => t.value === section.sectionType)?.label || section.sectionType}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{section.title || "No title"}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      section.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                    }`}>
                      {section.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingSection(section)}
                      className="px-3 py-1 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteSection(section.id)}
                      className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {sections.length === 0 && (
                <p className="text-center py-8 text-slate-500 dark:text-slate-400">No sections found</p>
              )}
            </div>
          </div>
        )}

        {/* ===================== TESTIMONIALS TAB ===================== */}
        {activeTab === "testimonials" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Testimonials</h2>
              <button
                onClick={() => setShowCreateTestimonial(true)}
                className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600"
              >
                Add Testimonial
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {testimonials.map((t) => (
                <div key={t.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <div className="flex items-start gap-4">
                    {t.imageUrl && (
                      <img src={t.imageUrl} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white">{t.name}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t.role}</p>
                      <p className="text-sm text-yellow-500 mt-1">{"⭐".repeat(t.rating)}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">{t.content}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      t.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                    }`}>
                      {t.isActive ? "Active" : "Inactive"}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingTestimonial(t)}
                        className="px-3 py-1 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteTestimonial(t.id)}
                        className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {testimonials.length === 0 && (
                <p className="col-span-2 text-center py-8 text-slate-500 dark:text-slate-400">No testimonials found</p>
              )}
            </div>
          </div>
        )}

        {/* ===================== SERVICE CARDS TAB ===================== */}
        {activeTab === "services" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Service Cards</h2>
              <button
                onClick={() => setShowCreateServiceCard(true)}
                className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600"
              >
                Add Service Card
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {serviceCards.map((card) => (
                <div key={card.id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{card.icon || "📋"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white">{card.title}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{card.description}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      card.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                    }`}>
                      {card.isActive ? "Active" : "Inactive"}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingServiceCard(card)}
                        className="px-3 py-1 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteServiceCard(card.id)}
                        className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {serviceCards.length === 0 && (
                <p className="col-span-3 text-center py-8 text-slate-500 dark:text-slate-400">No service cards found</p>
              )}
            </div>
          </div>
        )}

        {/* ===================== PAGES TAB ===================== */}
        {activeTab === "pages" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pages</h2>
              <button
                onClick={() => setShowCreatePage(true)}
                className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600"
              >
                Create Page
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                    <th className="pb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Title</th>
                    <th className="pb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Slug</th>
                    <th className="pb-3 text-sm font-medium text-slate-500 dark:text-slate-400">Status</th>
                    <th className="pb-3 text-sm font-medium text-slate-500 dark:text-slate-400">In Nav</th>
                    <th className="pb-3 text-sm font-medium text-slate-500 dark:text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pages.map((page) => (
                    <tr key={page.id}>
                      <td className="py-3 text-slate-900 dark:text-white font-medium">{page.title}</td>
                      <td className="py-3 text-slate-500 dark:text-slate-400 font-mono text-sm">/{page.slug}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          page.isPublished
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}>
                          {page.isPublished ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          page.showInNav
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                        }`}>
                          {page.showInNav ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => setEditingPage(page)}
                          className="px-3 py-1 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg mr-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeletePage(page.id)}
                          className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pages.length === 0 && (
                <p className="text-center py-8 text-slate-500 dark:text-slate-400">No pages found</p>
              )}
            </div>
          </div>
        )}

        {/* ===================== LEGAL PAGES TAB ===================== */}
        {activeTab === "legal" && (
          <div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Legal Pages</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Manage the content of legal documents shown to users during registration and consent flows.
              </p>
            </div>

            {/* Info Banner */}
            <div className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Terms of Service</strong>, <strong>Privacy Policy</strong>, and <strong>Data Processing Agreement</strong> are accepted by users at registration.
                <br />
                <strong>Engagement Letter</strong> is signed per-account — <strong>optional for Individual</strong>, <strong>required for Company, Trust, and Partnership</strong>.
              </p>
            </div>

            <div className="space-y-4">
              {(() => {
                const LEGAL_SLUGS = [
                  { slug: "terms-of-service", label: "Terms of Service", url: "/p/terms-of-service", context: "Accepted at registration (mandatory)" },
                  { slug: "privacy-policy", label: "Privacy Policy", url: "/p/privacy-policy", context: "Accepted at registration (mandatory)" },
                  { slug: "data-processing-agreement", label: "Data Processing Agreement", url: "/p/data-processing-agreement", context: "Accepted at registration (mandatory)" },
                ];
                return LEGAL_SLUGS.map((legalPage) => {
                  const page = pages.find((p) => p.slug === legalPage.slug);
                  return (
                    <div
                      key={legalPage.slug}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900 dark:text-white">{legalPage.label}</h3>
                          {page ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              page.isPublished
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            }`}>
                              {page.isPublished ? "Published" : "Draft"}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              Not Created
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{legalPage.context}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 font-mono">{legalPage.url}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <a
                          href={legalPage.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600"
                        >
                          Preview
                        </a>
                        {page ? (
                          <button
                            onClick={() => setEditingPage(page)}
                            className="px-3 py-1.5 text-sm text-white bg-teal-500 rounded-lg hover:bg-teal-600"
                          >
                            Edit Content
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setShowCreatePage(true);
                              // Will need to manually set slug after creation
                            }}
                            className="px-3 py-1.5 text-sm text-white bg-teal-500 rounded-lg hover:bg-teal-600"
                          >
                            Create Page
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* ===================== NAVIGATION TAB ===================== */}
        {activeTab === "navigation" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Navigation Menu</h2>
              <button
                onClick={() => setShowCreateNavItem(true)}
                className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600"
              >
                Add Menu Item
              </button>
            </div>
            <div className="space-y-2">
              {navItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400 w-8">
                      #{item.sortOrder}
                    </span>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{item.label}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{item.url}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.isActive
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                    }`}>
                      {item.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingNavItem(item)}
                      className="px-3 py-1 text-sm text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/30 rounded-lg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteNavItem(item.id)}
                      className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {navItems.length === 0 && (
                <p className="text-center py-8 text-slate-500 dark:text-slate-400">No menu items found</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===================== MODALS ===================== */}
      
      {/* Section Modal */}
      {(editingSection || showCreateSection) && (
        <SectionModal
          section={editingSection}
          onSave={(data) => handleSaveSection(data, !editingSection)}
          onClose={() => { setEditingSection(null); setShowCreateSection(false); }}
        />
      )}

      {/* Testimonial Modal */}
      {(editingTestimonial || showCreateTestimonial) && (
        <TestimonialModal
          testimonial={editingTestimonial}
          onSave={(data) => handleSaveTestimonial(data, !editingTestimonial)}
          onClose={() => { setEditingTestimonial(null); setShowCreateTestimonial(false); }}
        />
      )}

      {/* Service Card Modal */}
      {(editingServiceCard || showCreateServiceCard) && (
        <ServiceCardModal
          card={editingServiceCard}
          onSave={(data) => handleSaveServiceCard(data, !editingServiceCard)}
          onClose={() => { setEditingServiceCard(null); setShowCreateServiceCard(false); }}
        />
      )}

      {/* Page Modal */}
      {(editingPage || showCreatePage) && (
        <PageModal
          page={editingPage}
          onSave={(data) => handleSavePage(data, !editingPage)}
          onClose={() => { setEditingPage(null); setShowCreatePage(false); }}
        />
      )}

      {/* Nav Item Modal */}
      {(editingNavItem || showCreateNavItem) && (
        <NavItemModal
          item={editingNavItem}
          onSave={(data) => handleSaveNavItem(data, !editingNavItem)}
          onClose={() => { setEditingNavItem(null); setShowCreateNavItem(false); }}
        />
      )}
    </div>
  );
}

// ===================== MODAL COMPONENTS =====================

function SectionModal({
  section,
  onSave,
  onClose,
}: {
  section: HomeSection | null;
  onSave: (data: Partial<HomeSection>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    id: section?.id || "",
    sectionType: section?.sectionType || "HERO",
    title: section?.title || "",
    subtitle: section?.subtitle || "",
    content: section?.content || "",
    isActive: section?.isActive ?? true,
    sortOrder: section?.sortOrder || 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {section ? "Edit Section" : "Add Section"}
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Section Type</label>
            <select
              value={form.sectionType}
              onChange={(e) => setForm({ ...form, sectionType: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            >
              {SECTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subtitle</label>
            <input
              type="text"
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Content (JSON)</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={5}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sort Order</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-teal-500"
            />
            <label htmlFor="isActive" className="text-sm text-slate-700 dark:text-slate-300">Active</label>
          </div>
        </div>
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            Cancel
          </button>
          <button onClick={() => onSave(form)} className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function TestimonialModal({
  testimonial,
  onSave,
  onClose,
}: {
  testimonial: Testimonial | null;
  onSave: (data: Partial<Testimonial>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    id: testimonial?.id || "",
    name: testimonial?.name || "",
    role: testimonial?.role || "",
    content: testimonial?.content || "",
    rating: testimonial?.rating || 5,
    imageUrl: testimonial?.imageUrl || "",
    isActive: testimonial?.isActive ?? true,
    sortOrder: testimonial?.sortOrder || 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {testimonial ? "Edit Testimonial" : "Add Testimonial"}
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Role</label>
            <input
              type="text"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Content</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={4}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rating (1-5)</label>
            <input
              type="number"
              min={1}
              max={5}
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: parseInt(e.target.value) || 5 })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Image URL</label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sort Order</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-teal-500"
            />
            <label htmlFor="isActive" className="text-sm text-slate-700 dark:text-slate-300">Active</label>
          </div>
        </div>
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            Cancel
          </button>
          <button onClick={() => onSave(form)} className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function ServiceCardModal({
  card,
  onSave,
  onClose,
}: {
  card: ServiceCard | null;
  onSave: (data: Partial<ServiceCard>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    id: card?.id || "",
    title: card?.title || "",
    description: card?.description || "",
    icon: card?.icon || "",
    linkUrl: card?.linkUrl || "",
    isActive: card?.isActive ?? true,
    sortOrder: card?.sortOrder || 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {card ? "Edit Service Card" : "Add Service Card"}
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Icon (Emoji)</label>
            <input
              type="text"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              placeholder="💼"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Link URL (optional)</label>
            <input
              type="text"
              value={form.linkUrl}
              onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sort Order</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-teal-500"
            />
            <label htmlFor="isActive" className="text-sm text-slate-700 dark:text-slate-300">Active</label>
          </div>
        </div>
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            Cancel
          </button>
          <button onClick={() => onSave(form)} className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function PageModal({
  page,
  onSave,
  onClose,
}: {
  page: Page | null;
  onSave: (data: Partial<Page>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    id: page?.id || "",
    slug: page?.slug || "",
    title: page?.title || "",
    description: page?.description || "",
    content: page?.content || "",
    isPublished: page?.isPublished ?? false,
    showInNav: page?.showInNav ?? false,
    navOrder: page?.navOrder || 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {page ? "Edit Page" : "Create Page"}
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Slug</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                placeholder="about-us"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description (SEO)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Content (HTML)</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={10}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-mono text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPublished"
                checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-teal-500"
              />
              <label htmlFor="isPublished" className="text-sm text-slate-700 dark:text-slate-300">Published</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showInNav"
                checked={form.showInNav}
                onChange={(e) => setForm({ ...form, showInNav: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-teal-500"
              />
              <label htmlFor="showInNav" className="text-sm text-slate-700 dark:text-slate-300">Show in Navigation</label>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-700 dark:text-slate-300">Nav Order:</label>
              <input
                type="number"
                value={form.navOrder}
                onChange={(e) => setForm({ ...form, navOrder: parseInt(e.target.value) || 0 })}
                className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            Cancel
          </button>
          <button onClick={() => onSave(form)} className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function NavItemModal({
  item,
  onSave,
  onClose,
}: {
  item: NavMenuItem | null;
  onSave: (data: Partial<NavMenuItem>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    id: item?.id || "",
    label: item?.label || "",
    url: item?.url || "",
    target: item?.target || "_self",
    isActive: item?.isActive ?? true,
    sortOrder: item?.sortOrder || 0,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {item ? "Edit Menu Item" : "Add Menu Item"}
          </h3>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Label</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">URL</label>
            <input
              type="text"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              placeholder="/ or /about or https://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target</label>
            <select
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="_self">Same Window</option>
              <option value="_blank">New Tab</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Sort Order</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-teal-500"
            />
            <label htmlFor="isActive" className="text-sm text-slate-700 dark:text-slate-300">Active</label>
          </div>
        </div>
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            Cancel
          </button>
          <button onClick={() => onSave(form)} className="px-4 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
