"use client";

/**
 * Dynamic Page Renderer - Renders pages created in admin CMS
 * URL format: /p/[slug] e.g., /p/about, /p/services
 */

import Link from "next/link";
import { useState, useEffect } from "react";
import { notFound } from "next/navigation";

interface PageData {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: string;
  metaTitle: string | null;
  metaKeywords: string | null;
  isPublished: boolean;
  showInNav: boolean;
  navOrder: number;
}

export default function DynamicPage({ params }: { params: { slug: string } }) {
  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    async function loadPage() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/public/pages/${params.slug}`
        );
        if (res.ok) {
          const data = await res.json();
          setPage(data);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to load page:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadPage();
  }, [params.slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2E2A5E] to-[#1a1840]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-[#E91E8C] border-t-transparent rounded-full animate-spin" />
          <p className="text-white/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-white dark:from-[#2E2A5E] dark:to-[#1a1840]">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-[#2E2A5E] dark:text-white mb-4">404</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-8">Page not found</p>
          <Link
            href="/"
            className="px-6 py-3 bg-[#E91E8C] text-white rounded-lg font-semibold hover:bg-[#E91E8C]/90 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${isScrolled ? "bg-[#2E2A5E]/95 backdrop-blur-md py-3 shadow-xl" : "bg-white dark:bg-[#2E2A5E] py-4 shadow-md"}`}>
        <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-[#E91E8C] flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform">
              J
            </div>
            <span className={`text-lg font-bold tracking-tight ${isScrolled ? "text-white" : "text-[#2E2A5E] dark:text-white"}`}>
              JAP ACCOUNTANTS
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link href="/" className={`hidden sm:block text-sm font-semibold hover:text-[#E91E8C] transition-colors ${isScrolled ? "text-white" : "text-[#2E2A5E] dark:text-white"}`}>
              Home
            </Link>
            <Link href="/login" className={`hidden sm:block text-sm font-semibold hover:text-[#E91E8C] transition-colors ${isScrolled ? "text-white" : "text-[#2E2A5E] dark:text-white"}`}>
              Login
            </Link>
            <Link href="/register" className="px-4 sm:px-6 py-2 sm:py-2.5 bg-[#E91E8C] hover:bg-[#E91E8C]/90 text-white rounded-lg text-sm font-bold transition-all transform hover:scale-105 shadow-lg shadow-[#E91E8C]/30">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Page Header */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-slate-50 to-white dark:from-[#2E2A5E] dark:to-[#1a1840]">
        <div className="container mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-bold text-[#2E2A5E] dark:text-white mb-4">
            {page.title}
          </h1>
          {page.description && (
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-3xl">
              {page.description}
            </p>
          )}
        </div>
      </section>

      {/* Page Content */}
      <section className="py-16">
        <div className="container mx-auto px-6">
          <div
            className="prose prose-lg max-w-none dark:prose-invert prose-headings:text-[#2E2A5E] dark:prose-headings:text-white prose-a:text-[#E91E8C] prose-strong:text-[#2E2A5E] dark:prose-strong:text-white"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 dark:border-[#E91E8C]/20 bg-[#2E2A5E] dark:bg-[#1a1840]">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#E91E8C] flex items-center justify-center text-white font-bold shadow-lg">J</div>
              <span className="text-lg font-bold text-white">JAP ACCOUNTANTS</span>
            </div>
            <div className="text-xs text-slate-400 uppercase tracking-wider">
              ©2026 JAP Accountants — All Rights Reserved
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
